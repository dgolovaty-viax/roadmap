"""
Minimal MCP (Model Context Protocol) server for the viax roadmap backend.

Exposes a Streamable HTTP transport at POST /mcp that Claude/Cowork can call
as a remote MCP connector. Hand-rolled (no new deps) because the Python MCP
SDK ships an ASGI app and our backend is WSGI/gunicorn — a small amount of
JSON-RPC dispatch avoids a runtime server switch.

Tools exposed:
  - get_last_scan     → GET  /api/suggestions/last-scan
  - list_ideas        → GET  /api/ideas
  - list_epics        → GET  /api/epics
  - list_idea_tags    → GET  /api/idea-tags
  - post_scan         → POST /api/suggestions/scan

Auth: every request to /mcp requires "Authorization: Bearer <SCAN_API_SECRET>".
Stateless: no session IDs, no SSE streaming. Responses are plain JSON.

Spec followed: MCP 2025-03-26 (Streamable HTTP, stateless JSON mode).
"""

import json
import os
import traceback
from functools import wraps
from flask import Blueprint, jsonify, request, Response

bp = Blueprint("mcp", __name__)

SERVER_INFO = {"name": "viax-roadmap-mcp", "version": "1.0.0"}
SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]
DEFAULT_PROTOCOL_VERSION = "2025-03-26"

# Tool registry — populated by the @tool decorator below. Each entry is:
#   name -> { "description": str, "input_schema": dict, "handler": callable }
_TOOLS: dict = {}


def tool(name: str, description: str, input_schema: dict):
    """Register a Python function as an MCP tool."""
    def decorator(fn):
        _TOOLS[name] = {
            "description": description,
            "input_schema": input_schema,
            "handler": fn,
        }
        return fn
    return decorator


# ── Auth ───────────────────────────────────────────────────────────────

def _require_bearer():
    secret = os.getenv("SCAN_API_SECRET")
    if not secret:
        return _jsonrpc_error(None, -32000, "SCAN_API_SECRET not configured on server"), 503
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {secret}":
        return _jsonrpc_error(None, -32001, "Unauthorized"), 401
    return None


# ── JSON-RPC helpers ───────────────────────────────────────────────────

def _jsonrpc_result(req_id, result):
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _jsonrpc_error(req_id, code, message, data=None):
    err = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": req_id, "error": err}


# ── Tool implementations ───────────────────────────────────────────────
#
# Each handler takes the tool's arguments dict and returns a native Python
# value (dict/list/str) that will be JSON-serialized into a text content
# block. Raise an exception to signal a tool error; it becomes isError:true.


def _get_backend_fns():
    """Late-bind the Flask view functions from app.py so we don't import in
    a way that causes a circular import. Called per-request (cheap)."""
    from app import (
        last_scan_timestamp,
        list_ideas as http_list_ideas,
        list_epics as http_list_epics,
        list_idea_tags as http_list_idea_tags,
        ingest_scan,
    )
    return {
        "last_scan_timestamp":  last_scan_timestamp,
        "list_ideas":           http_list_ideas,
        "list_epics":           http_list_epics,
        "list_idea_tags":       http_list_idea_tags,
        "ingest_scan":          ingest_scan,
    }


def _unwrap_flask_response(flask_response):
    """Flask view fns return a Response. Pull the JSON body out."""
    if isinstance(flask_response, tuple):
        flask_response = flask_response[0]
    if hasattr(flask_response, "get_json"):
        return flask_response.get_json()
    return flask_response


@tool(
    name="get_last_scan",
    description=(
        "Return the most recent meeting_date already processed by the "
        "Granola scan task. Used as the cutoff for the next run. "
        "Returns {cutoff: iso-string | null}."
    ),
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
def _tool_get_last_scan(_args):
    fns = _get_backend_fns()
    return _unwrap_flask_response(fns["last_scan_timestamp"]())


@tool(
    name="list_ideas",
    description=(
        "List all ideas on the roadmap board, including their tag "
        "assignments. Used by the scan task to dedupe new candidate ideas "
        "against existing work. Returns an array of idea objects with "
        "id, title, description, and idea_tag_assignments."
    ),
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
def _tool_list_ideas(_args):
    fns = _get_backend_fns()
    return _unwrap_flask_response(fns["list_ideas"]())


@tool(
    name="list_epics",
    description=(
        "List all epics on the roadmap. Used by the scan task to dedupe "
        "new candidate ideas against in-flight/planned work. Returns an "
        "array of epic objects with id, title, status, and sections."
    ),
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
def _tool_list_epics(_args):
    fns = _get_backend_fns()
    return _unwrap_flask_response(fns["list_epics"]())


@tool(
    name="list_idea_tags",
    description=(
        "List all existing idea tags. The scan task uses this to prefer "
        "existing tags on new suggestions rather than proposing new ones. "
        "Returns an array of {id, name}."
    ),
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
def _tool_list_idea_tags(_args):
    fns = _get_backend_fns()
    return _unwrap_flask_response(fns["list_idea_tags"]())


@tool(
    name="post_scan",
    description=(
        "Post one meeting's suggestions to the roadmap backend. Idempotent "
        "on granolaMeetingId — re-posting replaces the meeting's pending "
        "suggestions (accepted/dismissed ones are preserved). Returns "
        "{ok: true, scan, suggestions}."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "granolaMeetingId": {"type": "string", "description": "Granola meeting UUID"},
            "meetingTitle":     {"type": "string"},
            "meetingUrl":       {"type": "string"},
            "meetingDate":      {"type": "string", "description": "ISO 8601 timestamp of meeting start"},
            "summaryTitle":     {"type": "string", "description": "6-10 word summary title"},
            "summary":          {"type": "string", "description": "2-4 sentence summary"},
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title":          {"type": "string"},
                        "description":    {"type": "string"},
                        "existingTagIds": {"type": "array", "items": {"type": "string"}},
                        "newTagNames":    {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["title", "description"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["granolaMeetingId", "suggestions"],
        "additionalProperties": False,
    },
)
def _tool_post_scan(args):
    """Invoke the existing Flask ingest_scan view by constructing a fake
    request context with the bearer secret promoted to X-Scan-Secret."""
    from flask import current_app
    fns = _get_backend_fns()

    payload = {
        "granolaMeetingId": args.get("granolaMeetingId"),
        "meetingTitle":     args.get("meetingTitle"),
        "meetingUrl":       args.get("meetingUrl"),
        "meetingDate":      args.get("meetingDate"),
        "summaryTitle":     args.get("summaryTitle"),
        "summary":          args.get("summary"),
        "suggestions":      args.get("suggestions") or [],
    }

    with current_app.test_request_context(
        "/api/suggestions/scan",
        method="POST",
        json=payload,
        headers={"X-Scan-Secret": os.getenv("SCAN_API_SECRET", "")},
    ):
        resp = fns["ingest_scan"]()
        body = _unwrap_flask_response(resp)
        # If ingest_scan returned a non-2xx, surface that as a tool error
        status = resp[1] if isinstance(resp, tuple) else 200
        if status >= 400:
            raise RuntimeError(f"ingest_scan returned {status}: {body}")
        return body


# ── MCP dispatch ───────────────────────────────────────────────────────

def _tools_list_payload():
    return {
        "tools": [
            {
                "name":        name,
                "description": spec["description"],
                "inputSchema": spec["input_schema"],
            }
            for name, spec in _TOOLS.items()
        ]
    }


def _call_tool(name, arguments):
    spec = _TOOLS.get(name)
    if not spec:
        return {
            "content": [{"type": "text", "text": f"Unknown tool: {name}"}],
            "isError": True,
        }
    try:
        result = spec["handler"](arguments or {})
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(result, default=str, ensure_ascii=False),
            }],
        }
    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
            }],
            "isError": True,
        }


def _handle_message(msg):
    """Route a single JSON-RPC message. Returns a response dict, or None
    for notifications (no response)."""
    req_id = msg.get("id")
    method = msg.get("method", "")
    params = msg.get("params") or {}

    if method == "initialize":
        client_version = params.get("protocolVersion")
        version = client_version if client_version in SUPPORTED_PROTOCOL_VERSIONS else DEFAULT_PROTOCOL_VERSION
        return _jsonrpc_result(req_id, {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo":    SERVER_INFO,
        })

    if method == "notifications/initialized":
        return None  # notification, no response

    if method == "ping":
        return _jsonrpc_result(req_id, {})

    if method == "tools/list":
        return _jsonrpc_result(req_id, _tools_list_payload())

    if method == "tools/call":
        name = params.get("name", "")
        arguments = params.get("arguments") or {}
        return _jsonrpc_result(req_id, _call_tool(name, arguments))

    return _jsonrpc_error(req_id, -32601, f"Method not found: {method}")


# ── HTTP endpoint ──────────────────────────────────────────────────────

@bp.route("/mcp", methods=["POST"])
def mcp_post():
    auth_err = _require_bearer()
    if auth_err is not None:
        body, status = auth_err
        return jsonify(body), status

    try:
        payload = request.get_json(force=True)
    except Exception:
        return jsonify(_jsonrpc_error(None, -32700, "Parse error")), 400

    # MCP no longer supports batched requests in 2025-03-26, but older clients
    # may still send arrays. Accept both for compatibility.
    if isinstance(payload, list):
        responses = [r for r in (_handle_message(m) for m in payload) if r is not None]
        if not responses:
            return Response(status=202)
        return jsonify(responses)

    if not isinstance(payload, dict):
        return jsonify(_jsonrpc_error(None, -32600, "Invalid Request")), 400

    response = _handle_message(payload)
    if response is None:
        # Notification — spec says respond 202 Accepted with no body
        return Response(status=202)
    return jsonify(response)


@bp.route("/mcp", methods=["GET", "DELETE"])
def mcp_unsupported():
    """We don't support server-initiated SSE streams or session termination
    — this server is stateless. Reply 405 per the spec."""
    return jsonify(_jsonrpc_error(None, -32000, "Method not allowed")), 405


@bp.route("/mcp/health", methods=["GET"])
def mcp_health():
    """Unauthenticated health check so you can verify the blueprint is
    mounted without exposing tools."""
    return jsonify({
        "status":           "ok",
        "server":           SERVER_INFO,
        "protocolVersions": SUPPORTED_PROTOCOL_VERSIONS,
        "tools":            sorted(_TOOLS.keys()),
    })
