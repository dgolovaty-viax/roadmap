-- Migration: meeting_scans + idea_suggestions
-- Feature:   Granola meeting → idea suggestion inbox
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)
--
-- Adds two tables:
--   * meeting_scans      — one row per Granola meeting processed by the
--                          nightly Cowork scan task. Stores an AI summary.
--   * idea_suggestions   — one row per idea suggestion extracted from a
--                          meeting. Status lifecycle: pending → accepted
--                          or dismissed.

create table if not exists public.meeting_scans (
  id                  uuid        primary key default gen_random_uuid(),
  granola_meeting_id  text        not null unique,
  meeting_title       text,
  meeting_url         text,
  meeting_date        timestamptz,
  summary_title       text,
  summary             text,
  processed_at        timestamptz not null default now()
);

create index if not exists idx_meeting_scans_processed_at
  on public.meeting_scans (processed_at desc);

create index if not exists idx_meeting_scans_meeting_date
  on public.meeting_scans (meeting_date desc);


create table if not exists public.idea_suggestions (
  id                      uuid        primary key default gen_random_uuid(),
  meeting_scan_id         uuid        not null references public.meeting_scans(id) on delete cascade,
  suggested_title         text        not null,
  suggested_description   text,
  existing_tag_ids        uuid[]      not null default '{}',
  new_tag_names           text[]      not null default '{}',
  status                  text        not null default 'pending'
                          check (status in ('pending', 'accepted', 'dismissed')),
  resulting_idea_id       uuid        references public.ideas(id) on delete set null,
  created_at              timestamptz not null default now(),
  reviewed_at             timestamptz
);

create index if not exists idx_idea_suggestions_status
  on public.idea_suggestions (status, created_at desc);

create index if not exists idx_idea_suggestions_scan
  on public.idea_suggestions (meeting_scan_id);
