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
    # Tally votes across all idea_votes for this session
    votes_res = supabase.table("idea_votes").select("*").eq("session_id", session_id).execute()
    votes     = votes_res.data or []

    tally = {}
    for v in votes:
        for iid in (v.get("idea_ids") or []):
            tally[iid] = tally.get(iid, 0) + 1

    # Resolve idea titles for snapshot
    snapshot_ideas = []
    if tally:
        ids_list = list(tally.keys())
        ideas_res = supabase.table("ideas").select("id, title, idea_tag_assignments(idea_tags(id, name))").in_("id", ids_list).execute()
        for idea in (ideas_res.data or []):
            assignments = idea.get("idea_tag_assignments") or []
            first_tag = next((a["idea_tags"] for a in assignments if a.get("idea_tags")), None)
            snapshot_ideas.append({
                "id":        idea["id"],
                "title":     idea.get("title", ""),
                "tag_name":  first_tag["name"] if first_tag else None,
                "vote_count": tally.get(idea["id"], 0),
            })
        snapshot_ideas.sort(key=lambda x: x["vote_count"], reverse=True)

    result_snapshot = {
        "ideas":        snapshot_ideas,
        "total_voters": len(votes),
    }

    supabase.table("idea_vote_sessions").update({
        "status":          "closed",
        "result_snapshot": result_snapshot,
    }).eq("id", session_id).execute()
    return jsonify({"ok": True})


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


# ── Health ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
