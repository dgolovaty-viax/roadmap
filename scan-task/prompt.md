# Nightly Granola → idea suggestions scan

You are running a scheduled task for the viax roadmap app. Your job is to look
at new Granola meetings since the last run and extract candidate ideas for the
Ideas board. A human will review and accept/dismiss them — your job is to
produce good candidates, not to be conservative.

## Config (baked into this prompt)

- Backend URL: `https://roadmap-production-2306.up.railway.app`
- Scan secret (used for the `X-Scan-Secret` header on POSTs): `<SCAN_API_SECRET value>`

The scan secret is embedded directly in the scheduled task's prompt rather
than read from a file, because the task runs in a fresh Cowork session each
time and session-local file paths are not portable across runs. If you rotate
the secret, update both the Railway env var AND this prompt. All HTTP calls
below use the backend URL as the base; POSTs to `/api/suggestions/scan` send
`X-Scan-Secret: <value>`.

## Step 1 — determine the cutoff

GET `{backendUrl}/api/suggestions/last-scan` — it returns `{"cutoff": iso-string | null}`.
This is the most recent meeting_date we've already processed. If `cutoff` is
`null`, treat "last 7 days" as the window. Otherwise, look only at meetings
with `meeting_date > cutoff`.

## Step 2 — list candidate meetings

Use the Granola MCP tool `list_meetings` (or `query_granola_meetings`) to
enumerate meetings after the cutoff. If Granola returns meetings in batches,
page through them. Stop when you've covered the window. If there are zero new
meetings, stop and report that you had nothing to process.

## Step 3 — fetch context for dedup

Before analyzing transcripts, fetch the current idea and epic lists so you can
dedupe against work that's already on the board:

- GET `{backendUrl}/api/ideas` — returns `[{id, title, description, idea_tag_assignments: [{idea_tags: {id, name}}], …}]`
- GET `{backendUrl}/api/epics` — returns `[{id, title, …}]`
- GET `{backendUrl}/api/idea-tags` — returns `[{id, name}]` (used to prefer existing tags)

Keep these in memory for the rest of the run.

## Step 4 — analyze each meeting

For each new meeting:

1. Get the transcript via the Granola MCP.
2. Write a **summary** of the meeting in 2–4 sentences, and give that summary
   a short **summary title** (6–10 words) that captures the meeting's main
   thrust. This is what Dennis will see as the source context when reviewing.
3. Extract every distinct idea that came up in the meeting that could plausibly
   become a product idea on the roadmap. No cap on count — but each one must be
   a distinct, stand-alone idea (not a variant or restatement of another).
4. For each candidate idea, compare it against the existing ideas AND epics
   fetched in Step 3. If it is substantially the same (title or description
   clearly overlaps with an existing item), **drop** it. Err on the side of
   dropping when in doubt.
5. For each surviving candidate, produce:
   - `title` — 4–10 words, noun phrase, in viax voice (direct, declarative)
   - `description` — 2–4 sentences. Start with the problem or the value, not
     "this feature…". Be specific to what was said in the meeting.
   - `existingTagIds` — uuid[] of existing `idea-tags` that fit. Prefer
     existing tags whenever they fit reasonably.
   - `newTagNames` — string[] of brand-new tag names to propose only when no
     existing tag fits at all. Propose at most one new tag per idea. Keep names
     short (1–3 words), capitalized like existing tags.

## Step 5 — post to the backend

For EACH meeting (one POST per meeting), call
`POST {backendUrl}/api/suggestions/scan` with header
`X-Scan-Secret: <scanSecret>` and body:

```json
{
  "granolaMeetingId": "<granola id>",
  "meetingTitle":     "<meeting title>",
  "meetingUrl":       "<granola deep link or notes URL>",
  "meetingDate":      "<ISO timestamp of meeting start>",
  "summaryTitle":     "<your 6–10 word summary title>",
  "summary":          "<your 2–4 sentence summary>",
  "suggestions": [
    {
      "title":          "...",
      "description":    "...",
      "existingTagIds": ["uuid", ...],
      "newTagNames":    ["New Tag Name", ...]
    }
  ]
}
```

The endpoint is idempotent on `granolaMeetingId` — if a run fails partway and
is retried, re-POSTing the same meeting will replace its pending suggestions
(accepted/dismissed ones are preserved).

If the backend responds non-2xx, log the status and body and continue to the
next meeting. Do not retry aggressively — the task will run again tomorrow.

## Step 6 — summarize what you did

At the end, write a brief report: number of meetings processed, total
suggestions posted, any meetings that were skipped (and why), any HTTP errors.
This shows up in the scheduled-task run log so Dennis can spot failures.

## Constraints

- Do NOT post suggestions that are substantially the same as existing ideas or
  epics. Dedup is your responsibility.
- Prefer existing tags. Propose new tags sparingly.
- Be specific to what was said — generic "improve UX" suggestions are noise.
- Write titles and descriptions in viax's declarative voice: direct, no
  hedging, active verbs. No "we could" / "might want to" / "should consider".
- Never mention internal metadata (meeting IDs, timestamps) in the idea copy —
  that belongs only in the scan payload fields, not in the idea description.
