# Nightly Granola → Suggestions Scan

A Cowork scheduled task that reads new Granola meetings each day and posts idea
suggestions to the roadmap app, where they show up in the Suggested Ideas
inbox on the Ideas page.

The task reaches the backend through a **remote MCP connector** (`viax-roadmap`),
not raw HTTP, so it works even when the Cowork sandbox blocks outbound traffic
to Railway.

## Setup (one-time)

### 1. Apply the migration

Open the Supabase SQL editor for project `fsiyiyamxerpwooutriq`:
https://supabase.com/dashboard/project/fsiyiyamxerpwooutriq/sql/new

Run `backend/migrations/001_meeting_suggestions.sql`.

### 2. Set the shared secret on Railway

Pick a random string (32+ chars). In the Railway dashboard for the backend
project, add env var:

```
SCAN_API_SECRET=<your random string>
```

Railway will redeploy automatically. The same secret is used as the bearer
token for the MCP endpoint at `/mcp`.

### 3. Register the MCP connector in Cowork

In the Claude desktop app: **Settings → Connectors → Add custom connector**
(or whatever the current path is). Use:

- **Name:** `viax-roadmap`
- **URL:** `https://roadmap-production-2306.up.railway.app/mcp`
- **Auth:** Bearer token — paste the same value you set for `SCAN_API_SECRET`

You can verify the endpoint before adding it by hitting
`https://roadmap-production-2306.up.railway.app/mcp/health` in a browser — it
returns the list of tools with no auth required.

### 4. Install the scheduled task

From a Cowork session, ask Claude to register the task using the contents of
`scan-task/prompt.md` as the task prompt. No secret substitution is needed —
the task calls MCP tools directly, and auth is handled by the connector.
Schedule: daily at **3:15 PM ET**.

In cron that's `15 15 * * *` if your Cowork timezone is US/Eastern. (Cron is
evaluated in the user's local timezone.)

### 5. Test

From Cowork, run the task ad-hoc once to verify the round-trip. Check the
Ideas page — you should see a "Suggested ideas from meetings" strip at the
top.

## How it works

Runtime (3:15 PM ET):

1. Task calls `get_last_scan` (MCP) for the cutoff timestamp
2. Task uses the Granola MCP to list meetings after the cutoff
3. Task calls `list_ideas`, `list_epics`, `list_idea_tags` (MCP) for dedup + tag matching
4. For each meeting: get transcript → summarize → extract idea candidates → dedupe → call `post_scan` (MCP)
5. Ideas appear in the Suggested inbox the next time Dennis opens the app

Dennis reviews and hits Accept / Edit / Dismiss on each one.

## Why MCP instead of HTTP?

The Cowork sandbox where scheduled tasks run has an HTTP egress allowlist that
does not include `*.up.railway.app` (as of April 2026), and the per-workspace
"Additional allowed domains" setting had known reliability issues. MCP traffic
is routed through Claude's connector channel, which is not subject to the same
allowlist, so this path is resilient regardless of how egress policy evolves.

The MCP server is mounted inside the Flask backend at `/mcp` (see
`backend/mcp_server.py`), so it deploys together with everything else on the
same Railway service — no separate process to keep alive.
