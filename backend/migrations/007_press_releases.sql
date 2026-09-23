-- Migration: press release pipeline
-- Feature:   Press Releases — a swimlane board tracking each press release or
--            customer case study from candidate through to LinkedIn
--            amplification. Steps run across the top and are defined in
--            src/pages/PressReleasesPage.jsx (PR_STEPS); each release is one
--            row here and sits in exactly one step at a time.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)
--
-- Adds two tables:
--   * press_releases — one row per release (one swimlane). `step_key` matches
--                      a key in PR_STEPS; moving the card updates this column.
--   * pr_items       — everything hanging off a release card: the body content,
--                      links, file attachments and comments, discriminated by
--                      `kind`. One table keeps the card extensible without
--                      another migration each time we add a content type.

create table if not exists public.press_releases (
  id             uuid        primary key default gen_random_uuid(),
  client         text        not null default '',
  topic          text        not null default '',
  viax_owners    text        not null default '',
  client_owners  text        not null default '',
  step_key       text        not null default 'candidate',
  expected_date  date,
  position       integer     not null default 0,
  archived       boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_press_releases_position
  on public.press_releases (archived, position asc);


create table if not exists public.pr_items (
  id            uuid        primary key default gen_random_uuid(),
  release_id    uuid        not null references public.press_releases(id) on delete cascade,
  kind          text        not null,              -- 'content' | 'link' | 'attachment' | 'comment'
  title         text        not null default '',
  url           text        not null default '',
  body          text        not null default '',
  file_name     text        not null default '',
  mime_type     text        not null default '',
  size_bytes    integer     not null default 0,
  data          text        not null default '',   -- base64 payload for attachments
  author        text        not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pr_items_release
  on public.pr_items (release_id, kind, created_at asc);


-- The Flask backend connects with a single key and does its own access
-- control, exactly like the epics/ideas/kanban/blitz tables. Keep RLS off so
-- the backend can read and write (otherwise reads return empty and writes are
-- silently rejected).
alter table public.press_releases disable row level security;
alter table public.pr_items       disable row level security;
