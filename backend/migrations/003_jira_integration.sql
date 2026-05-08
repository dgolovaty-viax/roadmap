-- Migration: Jira integration
-- Feature:   Push a suggestion or idea directly into the VX Jira project as
--            a Story. Pushed items move to a new "Processed" tab on the
--            Ideas board with a clickable VX-NNNN badge.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)

-- 1. Track which Jira issue an idea was pushed to (and when).
alter table public.ideas
  add column if not exists jira_issue_key text,
  add column if not exists processed_at   timestamptz;

create index if not exists idx_ideas_processed_at
  on public.ideas (processed_at desc nulls last);

-- 2. Cache the VX project's components so the picker is fast and offline.
--    Refilled by POST /api/jira/components/refresh.
create table if not exists public.jira_components (
  jira_id      text        primary key,
  project_key  text        not null,
  name         text        not null,
  description  text,
  archived     boolean     not null default false,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_jira_components_project
  on public.jira_components (project_key, archived, name);
