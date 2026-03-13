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

# ── Clients ────────────────────────────────────────────────────────────

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

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


# ── Health ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
