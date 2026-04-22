# Nightly Granola → Suggestions Scan

A Cowork scheduled task that reads new Granola meetings each day and posts idea
suggestions to the roadmap app, where they show up in the Suggested Ideas
inbox on the Ideas page.

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

Railway will redeploy automatically.

### 3. Install the scheduled task

From a Cowork session, ask Claude to register the task using the contents of
`scan-task/prompt.md` as the task prompt, with your secret substituted for the
placeholder. Schedule: daily at **3:15 PM ET**.

In cron that's `15 15 * * *` if your Cowork timezone is US/Eastern. (Cron is
evaluated in the user's local timezone.)

The scan secret is embedded directly in the task prompt. Scheduled tasks run
in fresh Cowork sessions that don't inherit paths from other sessions, so a
file-based config wouldn't be portable. If you rotate the secret, update both
the Railway env var and the prompt on the scheduled task.

### 5. Test

From Cowork, run the task ad-hoc (no schedule needed) once to verify the
round-trip. Check the Ideas page — you should see a "Suggested ideas from
meetings" strip at the top.

## How it works

Runtime (3:15 PM ET):

1. Task reads the backend URL and secret from its own prompt (baked in)
2. Task GETs `/api/suggestions/last-scan` for the cutoff timestamp
3. Task uses the Granola MCP to list meetings after the cutoff
4. Task GETs current ideas, epics, and tags (for dedup + tag matching)
5. For each meeting: get transcript → summarize → extract idea candidates → dedupe → POST to `/api/suggestions/scan`
6. Ideas appear in the Suggested inbox the next time Dennis opens the app

Dennis reviews and hits Accept / Edit / Dismiss on each one.
