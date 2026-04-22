import os
import uuid
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*"))

# Register the MCP server blueprint (mounts POST /mcp). Tools re-use the
# view functions defined below via late binding, so this import is safe
# even though mcp_server.py pulls names from this module at call time.
from mcp_server import bp as mcp_bp  # noqa: E402
app.register_blueprint(mcp_bp)


# ── Clients ────────────────────────────────────────────────────────────

_supabase_url = (
    os.environ.get("SUPABASE_URL") or
    os.environ.get("VITE_SUPABASE_URL") or
    os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
)
_supabase_key = (
    os.environ.get("SUPABASE_KEY") or
    os.environ.get("VITE_SUPABASE_KEY") or
    os.environ.get("VITE_SUPABASE_ANON_KEY") or
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
    os.environ.get("SUPABASE_ANON_KEY", "")
)

if not _supabase_url or not _supabase_key:
    import sys
    print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be set", file=sys.stderr)
    sys.exit(1)

supabase = create_client(_supabase_url, _supabase_key)

_anthropic_key = os.getenv("ANTHROPIC_API_KEY")
anthropic = Anthropic(api_key=_anthropic_key) if _anthropic_key else None


def now():
    return datetime.now(timezone.utc).isoformat()


# ── Epics ──────────────────────────────────────────────────────────────

@app.route("/api/epics", methods=["GET"])
def list_epics():
    res = supabase.table("epics").select("*").order("created_at", desc=True).execute()
    return jsonify(res.data)


@app.route("/api/epics", methods=["POST"])
def upsert_epic():
    body = request.json
    row = {
        "id":             body.get("id") or str(uuid.uuid4()),
        "title":          body.get("title", ""),
        "owner":          body.get("owner", ""),
        "status":         body.get("status", "Draft"),
        "target_quarter": body.get("targetQuarter", ""),
        "sections":       body.get("sections", {}),
        "updated_at":     now(),
    }
    res = supabase.table("epics").upsert(row, on_conflict="id").execute()
    return jsonify(res.data[0] if res.data else row), 200


@app.route("/api/epics/<epic_id>", methods=["DELETE"])
def delete_epic(epic_id):
    supabase.table("epics").delete().eq("id", epic_id).execute()
    return jsonify({"ok": True})


# ── Voting Sessions ────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["GET"])
def list_sessions():
    sessions = supabase.table("voting_sessions").select("*, session_epics(*)").order("created_at", desc=True).execute()
    votes = supabase.table("votes").select("session_id, participant_email, session_epic_id").execute()
    return jsonify({"sessions": sessions.data, "votes": votes.data})


@app.route("/api/sessions", methods=["POST"])
def create_session():
    body = request.json
    session_res = supabase.table("voting_sessions").insert({
        "title":              body["title"],
        "status":             "open",
        "participant_emails": body["participantEmails"],
    }).execute()
    session = session_res.data[0]

    epic_rows = [
        {
            "session_id":    session["id"],
            "epic_id":       e["id"],
            "epic_title":    e.get("title") or "Untitled Epic",
            "epic_summary":  (e.get("sections") or {}).get("why", "")[:280],
            "display_order": i,
        }
        for i, e in enumerate(body.get("epics", []))
    ]
    if epic_rows:
        supabase.table("session_epics").insert(epic_rows).execute()

    return jsonify(session), 201


@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    session = supabase.table("voting_sessions").select("*").eq("id", session_id).single().execute()
    epics   = supabase.table("session_epics").select("*").eq("session_id", session_id).order("display_order").execute()
    votes   = supabase.table("votes").select("*").eq("session_id", session_id).execute()
    return jsonify({
        "session": session.data,
        "epics":   epics.data,
        "votes":   votes.data,
    })


@app.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    supabase.table("voting_sessions").delete().eq("id", session_id).execute()
    return jsonify({"ok": True})


@app.route("/api/sessions/<session_id>/close", methods=["POST"])
def close_session(session_id):
    supabase.table("voting_sessions").update({"status": "closed"}).eq("id", session_id).execute()
    return jsonify({"ok": True})


@app.route("/api/sessions/<session_id>/revote", methods=["POST"])
def revote_session(session_id):
    # Clear all votes for the session and reopen it for another round
    supabase.table("votes").delete().eq("session_id", session_id).execute()
    supabase.table("voting_sessions").update({"status": "open"}).eq("id", session_id).execute()
    return jsonify({"ok": True})


@app.route("/api/sessions/<session_id>/add-participant", methods=["POST"])
def add_participant(session_id):
    data  = request.get_json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"ok": False, "error": "Email is required"}), 400
    # Fetch current participant list
    res = supabase.table("voting_sessions").select("participant_emails").eq("id", session_id).single().execute()
    current = res.data.get("participant_emails") or []
    if email in [e.lower() for e in current]:
        return jsonify({"ok": False, "error": "Participant already in session"}), 409
    updated = current + [email]
    supabase.table("voting_sessions").update({"participant_emails": updated}).eq("id", session_id).execute()
    return jsonify({"ok": True, "participant_emails": updated})


# ── Votes ──────────────────────────────────────────────────────────────

@app.route("/api/votes", methods=["POST"])
def submit_votes():
    body = request.json  # { sessionId, email, votes: [{sessionEpicId, bv, tc, rr, js}] }
    rows = [
        {
            "session_id":        body["sessionId"],
            "session_epic_id":   v["sessionEpicId"],
            "participant_email": body["email"].lower().strip(),
            "business_value":    v["bv"],
            "time_criticality":  v["tc"],
            "risk_reduction":    v["rr"],
            "job_size":          v["js"],
        }
        for v in body["votes"]
    ]
    supabase.table("votes").upsert(rows, on_conflict="session_epic_id,participant_email").execute()
    return jsonify({"ok": True})


# ── AI: Generate epic sections ─────────────────────────────────────────

@app.route("/api/ai/generate-epic", methods=["POST"])
def generate_epic():
    if not anthropic:
        return jsonify({"error": "ANTHROPIC_API_KEY not configured"}), 503
    body    = request.json
    title   = body.get("title", "")
    context = body.get("context", "")

    prompt = f"""You are a product manager at a B2B SaaS company called viax.
Generate content for a product epic with the following title: "{title}"
{f'Additional context: {context}' if context else ''}

Return a JSON object with exactly these keys:
- why: Why we are building this (problem, persona, business case)
- customerValue: What the customer gets and how their world changes
- scope: What's in scope, what's out of scope, what ships first (MVP)
- risks: Risks and open questions that could block the work
- tech: Technical approach with enough context for engineering to size and plan

Keep each section to 3-5 concise sentences. Be specific and actionable. Return only valid JSON."""

    message = anthropic.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = message.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    sections = json.loads(text)
    return jsonify({"sections": sections})


# ── AI: Suggest WSJF scores ────────────────────────────────────────────

@app.route("/api/ai/suggest-wsjf", methods=["POST"])
def suggest_wsjf():
    if not anthropic:
        return jsonify({"error": "ANTHROPIC_API_KEY not configured"}), 503
    body = request.json
    epic = body.get("epic", {})

    sections_text = "\n".join([
        f"Why: {epic.get('sections', {}).get('why', '')}",
        f"Customer Value: {epic.get('sections', {}).get('customerValue', '')}",
        f"Scope: {epic.get('sections', {}).get('scope', '')}",
        f"Risks: {epic.get('sections', {}).get('risks', '')}",
        f"Tech: {epic.get('sections', {}).get('tech', '')}",
    ])

    prompt = f"""You are a product manager scoring an epic using WSJF (Weighted Shortest Job First).

Epic title: {epic.get('title', 'Untitled')}
{sections_text}

Score each WSJF component on the Fibonacci scale [1, 2, 3, 5, 8, 13, 20]:
- Business Value (BV): Revenue impact, strategic value, customer satisfaction
- Time Criticality (TC): Urgency, cost of delay, time-sensitive opportunities
- Risk Reduction / Opportunity Enablement (RR): Technical risk mitigation, enables other work
- Job Size (JS): Effort and complexity (higher = more effort)

WSJF = (BV + TC + RR) / JS

Return a JSON object with keys: bv, tc, rr, js, wsjf, reasoning
reasoning should be 2-3 sentences explaining the scores. Return only valid JSON."""

    message = anthropic.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    result = json.loads(text)
    return jsonify(result)


# ── Idea Vote Sessions ─────────────────────────────────────────────────

def _build_snapshot(session_id):
    """Compute a result snapshot from idea_votes for the given session."""
    votes_res = supabase.table("idea_votes").select("*").eq("session_id", session_id).execute()
    votes     = votes_res.data or []

    tally = {}
    for v in votes:
        for iid in (v.get("idea_ids") or []):
            tally[iid] = tally.get(iid, 0) + 1

    snapshot_ideas = []
    if tally:
        ids_list  = list(tally.keys())
        ideas_res = supabase.table("ideas").select(
            "id, title, idea_tag_assignments(idea_tags(id, name))"
        ).in_("id", ids_list).execute()

        for idea in (ideas_res.data or []):
            assignments = idea.get("idea_tag_assignments") or []
            first_tag   = next((a["idea_tags"] for a in assignments if a.get("idea_tags")), None)
            snapshot_ideas.append({
                "id":         idea["id"],
                "title":      idea.get("title", ""),
                "tag_name":   first_tag["name"] if first_tag else None,
                "vote_count": tally.get(idea["id"], 0),
            })
        snapshot_ideas.sort(key=lambda x: x["vote_count"], reverse=True)

    return {"ideas": snapshot_ideas, "total_voters": len(votes)}


@app.route("/api/admin/backfill-snapshots", methods=["POST"])
def backfill_snapshots():
    """One-time: populate result_snapshot for all closed sessions that are missing it."""
    import traceback
    sessions_res = supabase.table("idea_vote_sessions").select("id, result_snapshot").eq("status", "closed").execute()
    sessions = sessions_res.data or []
    results = []
    for s in sessions:
        if s.get("result_snapshot") is not None:
            results.append({"id": s["id"][:8], "skipped": True})
            continue
        try:
            snap = _build_snapshot(s["id"])
            supabase.table("idea_vote_sessions").update({"result_snapshot": snap}).eq("id", s["id"]).execute()
            results.append({"id": s["id"][:8], "voters": snap["total_voters"], "ideas": len(snap["ideas"])})
        except Exception as e:
            results.append({"id": s["id"][:8], "error": str(e)})
    return jsonify({"ok": True, "sessions": results})

@app.route("/api/idea-vote-sessions", methods=["GET"])
def list_idea_vote_sessions():
    res = supabase.table("idea_vote_sessions").select("*").order("created_at", desc=True).execute()
    return jsonify(res.data)


@app.route("/api/idea-vote-sessions", methods=["POST"])
def create_idea_vote_session():
    # Reuse any existing open session
    existing = supabase.table("idea_vote_sessions").select("*").eq("status", "open").execute()
    if existing.data:
        return jsonify(existing.data[0]), 200
    res = supabase.table("idea_vote_sessions").insert({
        "id":     str(uuid.uuid4()),
        "status": "open",
    }).execute()
    return jsonify(res.data[0]), 201


@app.route("/api/idea-vote-sessions/<session_id>", methods=["GET"])
def get_idea_vote_session(session_id):
    session = supabase.table("idea_vote_sessions").select("*").eq("id", session_id).single().execute()
    votes   = supabase.table("idea_votes").select("*").eq("session_id", session_id).execute()
    return jsonify({"session": session.data, "votes": votes.data})


@app.route("/api/idea-vote-sessions/<session_id>/close", methods=["POST"])
def close_idea_vote_session(session_id):
    import traceback

    # Step 1: close the session immediately — this must always succeed
    supabase.table("idea_vote_sessions").update({
        "status": "closed",
        "closed_at": now(),
    }).eq("id", session_id).execute()

    # Step 2: build a result snapshot (best-effort — never blocks the close)
    result_snapshot = None
    try:
        result_snapshot = _build_snapshot(session_id)
        supabase.table("idea_vote_sessions").update(
            {"result_snapshot": result_snapshot}
        ).eq("id", session_id).execute()
    except Exception as e:
        print(f"[close_session] snapshot failed (session still closed): {e}\n{traceback.format_exc()}")

    return jsonify({"ok": True, "snapshot": result_snapshot})


@app.route("/api/idea-vote-sessions/<session_id>/vote", methods=["POST"])
def submit_idea_vote(session_id):
    body     = request.json
    email    = (body.get("email") or "").strip().lower()
    idea_ids = body.get("ideaIds", [])
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if len(idea_ids) > 5:
        return jsonify({"error": "Maximum 5 ideas allowed"}), 400
    sess = supabase.table("idea_vote_sessions").select("status").eq("id", session_id).single().execute()
    if not sess.data or sess.data["status"] != "open":
        return jsonify({"error": "This voting session is closed"}), 400
    row = {"session_id": session_id, "email": email, "idea_ids": idea_ids}
    res = supabase.table("idea_votes").upsert(row, on_conflict="session_id,email").execute()
    return jsonify(res.data[0] if res.data else row), 200


# ── Promote ideas → epics ───────────────────────────────────────────────

@app.route("/api/promote-ideas", methods=["POST"])
def promote_ideas():
    body       = request.json
    idea_ids   = body.get("ideaIds", [])
    session_id = body.get("sessionId")
    promoted   = []
    for idea_id in idea_ids:
        idea_res = supabase.table("ideas").select(IDEA_SELECT).eq("id", idea_id).single().execute()
        if not idea_res.data:
            continue
        idea = idea_res.data
        epic = {
            "id":             str(uuid.uuid4()),
            "title":          idea.get("title", ""),
            "owner":          "",
            "status":         "Draft",
            "target_quarter": "",
            "sections": {
                "why":           idea.get("description", ""),
                "customerValue": "",
                "scope":         "",
                "risks":         "",
                "tech":          "",
            },
            "updated_at": now(),
        }
        supabase.table("epics").insert(epic).execute()
        supabase.table("ideas").delete().eq("id", idea_id).execute()
        promoted.append(idea_id)

    # Record which idea IDs were promoted on the session
    if session_id and promoted:
        sess_res = supabase.table("idea_vote_sessions").select("promoted_idea_ids").eq("id", session_id).single().execute()
        existing = (sess_res.data or {}).get("promoted_idea_ids") or []
        merged   = list(set(existing + promoted))
        supabase.table("idea_vote_sessions").update({"promoted_idea_ids": merged}).eq("id", session_id).execute()

    return jsonify({"ok": True, "promoted": promoted})


# ── Idea Tags ──────────────────────────────────────────────────────────

@app.route("/api/idea-tags", methods=["GET"])
def list_idea_tags():
    res = supabase.table("idea_tags").select("*").order("name").execute()
    return jsonify(res.data)


@app.route("/api/idea-tags", methods=["POST"])
def create_idea_tag():
    body = request.json
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    existing = supabase.table("idea_tags").select("*").eq("name", name).execute()
    if existing.data:
        return jsonify(existing.data[0]), 200
    res = supabase.table("idea_tags").insert({
        "id":   str(uuid.uuid4()),
        "name": name,
    }).execute()
    return jsonify(res.data[0]), 201


# ── Ideas ───────────────────────────────────────────────────────────────

IDEA_SELECT = "*, idea_tag_assignments(tag_id, idea_tags(id, name))"


@app.route("/api/ideas", methods=["GET"])
def list_ideas():
    res = supabase.table("ideas").select(IDEA_SELECT).order("created_at", desc=True).execute()
    return jsonify(res.data)


@app.route("/api/ideas", methods=["POST"])
def upsert_idea():
    body    = request.json
    idea_id = body.get("id") or str(uuid.uuid4())
    row = {
        "id":          idea_id,
        "title":       body.get("title", ""),
        "description": body.get("description", ""),
        "updated_at":  now(),
    }
    supabase.table("ideas").upsert(row, on_conflict="id").execute()

    # Sync tags via junction table
    tag_ids = body.get("tagIds") or []
    supabase.table("idea_tag_assignments").delete().eq("idea_id", idea_id).execute()
    if tag_ids:
        assignments = [{"idea_id": idea_id, "tag_id": tid} for tid in tag_ids]
        supabase.table("idea_tag_assignments").insert(assignments).execute()

    full = supabase.table("ideas").select(IDEA_SELECT).eq("id", idea_id).single().execute()
    return jsonify(full.data), 200


@app.route("/api/ideas/<idea_id>", methods=["DELETE"])
def delete_idea(idea_id):
    supabase.table("ideas").delete().eq("id", idea_id).execute()
    return jsonify({"ok": True})


# ── Meeting-scan → Idea Suggestions ────────────────────────────────────
#
# A nightly Cowork scheduled task reads new Granola meetings, asks Claude
# to extract candidate ideas (with tag suggestions and near-duplicate
# dedup against current ideas/epics), and posts them here. Dennis reviews
# them in the "Suggested" inbox on the Ideas page and accepts or dismisses
# each one.

SCAN_API_SECRET = os.getenv("SCAN_API_SECRET")


def _require_scan_auth():
    if not SCAN_API_SECRET:
        return ("SCAN_API_SECRET not configured on server", 503)
    supplied = request.headers.get("X-Scan-Secret", "")
    if supplied != SCAN_API_SECRET:
        return ("Unauthorized", 401)
    return None


def _serialize_suggestion(row, tag_lookup):
    """Decorate a raw idea_suggestions row with tag names for the frontend."""
    existing_tag_ids = row.get("existing_tag_ids") or []
    return {
        **row,
        "existing_tags": [
            {"id": tid, "name": tag_lookup.get(tid, "")}
            for tid in existing_tag_ids
            if tag_lookup.get(tid)
        ],
    }


@app.route("/api/suggestions/last-scan", methods=["GET"])
def last_scan_timestamp():
    """Most recent meeting_date we've processed — used by the scan task as
    the cutoff for the next run. Returns {"cutoff": iso-string | null}."""
    res = (
        supabase.table("meeting_scans")
        .select("meeting_date, processed_at")
        .order("meeting_date", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return jsonify({"cutoff": None})
    row = res.data[0]
    return jsonify({"cutoff": row.get("meeting_date") or row.get("processed_at")})


@app.route("/api/suggestions/scan", methods=["POST"])
def ingest_scan():
    """Called by the Cowork scan task. Body:
      {
        "granolaMeetingId": "...",
        "meetingTitle":     "...",
        "meetingUrl":       "...",
        "meetingDate":      "2026-04-22T14:30:00Z",
        "summaryTitle":     "...",
        "summary":          "...",
        "suggestions": [
          { "title": "...", "description": "...",
            "existingTagIds": ["uuid", ...],
            "newTagNames":    ["name", ...] },
          ...
        ]
      }
    Auth: X-Scan-Secret header must match SCAN_API_SECRET env var.
    Idempotent on granola_meeting_id — re-posting updates the scan row and
    replaces its pending suggestions.
    """
    err = _require_scan_auth()
    if err:
        return jsonify({"error": err[0]}), err[1]

    body                = request.get_json() or {}
    granola_meeting_id  = (body.get("granolaMeetingId") or "").strip()
    if not granola_meeting_id:
        return jsonify({"error": "granolaMeetingId is required"}), 400

    scan_row = {
        "granola_meeting_id": granola_meeting_id,
        "meeting_title":      body.get("meetingTitle"),
        "meeting_url":        body.get("meetingUrl"),
        "meeting_date":       body.get("meetingDate"),
        "summary_title":      body.get("summaryTitle"),
        "summary":            body.get("summary"),
        "processed_at":       now(),
    }
    scan_res = (
        supabase.table("meeting_scans")
        .upsert(scan_row, on_conflict="granola_meeting_id")
        .execute()
    )
    scan = scan_res.data[0] if scan_res.data else None
    if not scan:
        return jsonify({"error": "Failed to upsert meeting_scan"}), 500

    # Replace pending suggestions for this scan — leave accepted/dismissed alone
    supabase.table("idea_suggestions").delete().match({
        "meeting_scan_id": scan["id"],
        "status":          "pending",
    }).execute()

    suggestion_rows = []
    for s in (body.get("suggestions") or []):
        title = (s.get("title") or "").strip()
        if not title:
            continue
        suggestion_rows.append({
            "meeting_scan_id":       scan["id"],
            "suggested_title":       title,
            "suggested_description": (s.get("description") or "").strip(),
            "existing_tag_ids":      s.get("existingTagIds") or [],
            "new_tag_names":         s.get("newTagNames") or [],
            "status":                "pending",
        })

    inserted = []
    if suggestion_rows:
        ins = supabase.table("idea_suggestions").insert(suggestion_rows).execute()
        inserted = ins.data or []

    return jsonify({"ok": True, "scan": scan, "suggestions": inserted}), 200


@app.route("/api/suggestions/pending", methods=["GET"])
def list_pending_suggestions():
    """Feeds the 'Suggested' inbox on the Ideas page."""
    sug_res = (
        supabase.table("idea_suggestions")
        .select("*, meeting_scans(id, granola_meeting_id, meeting_title, meeting_url, meeting_date, summary_title, summary)")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    rows = sug_res.data or []

    # Build a tag id → name lookup once
    tag_ids = sorted({tid for r in rows for tid in (r.get("existing_tag_ids") or [])})
    tag_lookup = {}
    if tag_ids:
        tags_res = supabase.table("idea_tags").select("id, name").in_("id", tag_ids).execute()
        tag_lookup = {t["id"]: t["name"] for t in (tags_res.data or [])}

    return jsonify([_serialize_suggestion(r, tag_lookup) for r in rows])


@app.route("/api/suggestions/<suggestion_id>", methods=["PATCH"])
def edit_suggestion(suggestion_id):
    """Allow editing title/description/tags before accepting."""
    body    = request.get_json() or {}
    updates = {}
    if "title" in body:
        updates["suggested_title"] = (body["title"] or "").strip()
    if "description" in body:
        updates["suggested_description"] = (body["description"] or "").strip()
    if "existingTagIds" in body:
        updates["existing_tag_ids"] = body["existingTagIds"] or []
    if "newTagNames" in body:
        updates["new_tag_names"] = body["newTagNames"] or []
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    res = (
        supabase.table("idea_suggestions")
        .update(updates)
        .eq("id", suggestion_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {"ok": True})


@app.route("/api/suggestions/<suggestion_id>/dismiss", methods=["POST"])
def dismiss_suggestion(suggestion_id):
    res = (
        supabase.table("idea_suggestions")
        .update({"status": "dismissed", "reviewed_at": now()})
        .eq("id", suggestion_id)
        .execute()
    )
    return jsonify(res.data[0] if res.data else {"ok": True})


@app.route("/api/suggestions/<suggestion_id>/accept", methods=["POST"])
def accept_suggestion(suggestion_id):
    """Turn a suggestion into a real idea.

    Optional body overrides:
      { "title": "...", "description": "...",
        "existingTagIds": [...], "newTagNames": [...] }
    """
    body = request.get_json() or {}

    sug = (
        supabase.table("idea_suggestions")
        .select("*")
        .eq("id", suggestion_id)
        .single()
        .execute()
    )
    if not sug.data:
        return jsonify({"error": "Suggestion not found"}), 404
    if sug.data["status"] != "pending":
        return jsonify({"error": f"Already {sug.data['status']}"}), 409

    title          = (body.get("title")       or sug.data["suggested_title"] or "").strip()
    description    = (body.get("description") or sug.data.get("suggested_description") or "").strip()
    existing_ids   = body.get("existingTagIds") or sug.data.get("existing_tag_ids") or []
    new_tag_names  = body.get("newTagNames")   or sug.data.get("new_tag_names")     or []
    if not title:
        return jsonify({"error": "Title is required"}), 400

    # 1. Materialise any new tags (idempotent on name)
    final_tag_ids = list(existing_ids)
    for raw_name in new_tag_names:
        name = (raw_name or "").strip()
        if not name:
            continue
        existing = supabase.table("idea_tags").select("id, name").eq("name", name).execute()
        if existing.data:
            tid = existing.data[0]["id"]
        else:
            ins = supabase.table("idea_tags").insert({
                "id":   str(uuid.uuid4()),
                "name": name,
            }).execute()
            tid = ins.data[0]["id"]
        if tid not in final_tag_ids:
            final_tag_ids.append(tid)

    # 2. Create the idea row
    idea_id = str(uuid.uuid4())
    supabase.table("ideas").upsert({
        "id":          idea_id,
        "title":       title,
        "description": description,
        "updated_at":  now(),
    }, on_conflict="id").execute()

    # 3. Attach tags via junction table
    if final_tag_ids:
        supabase.table("idea_tag_assignments").insert([
            {"idea_id": idea_id, "tag_id": tid} for tid in final_tag_ids
        ]).execute()

    # 4. Mark suggestion accepted
    supabase.table("idea_suggestions").update({
        "status":             "accepted",
        "reviewed_at":        now(),
        "resulting_idea_id":  idea_id,
    }).eq("id", suggestion_id).execute()

    # 5. Return the fully hydrated idea (matches /api/ideas shape)
    full = (
        supabase.table("ideas")
        .select(IDEA_SELECT)
        .eq("id", idea_id)
        .single()
        .execute()
    )
    return jsonify({"ok": True, "idea": full.data}), 201


# ── Health ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
