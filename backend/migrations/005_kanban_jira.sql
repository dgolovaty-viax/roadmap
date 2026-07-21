-- Migration: kanban_cards.jira_issue_key
-- Feature:   Link a Jira issue to a Priority Board card. The card stores the
--            issue key (e.g. VX-1234); live status/assignee/summary are read
--            from Jira at display time via /api/jira/search, so nothing but
--            the key needs to be persisted here.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)

alter table public.kanban_cards
  add column if not exists jira_issue_key text;

create index if not exists idx_kanban_cards_jira_issue_key
  on public.kanban_cards (jira_issue_key);
