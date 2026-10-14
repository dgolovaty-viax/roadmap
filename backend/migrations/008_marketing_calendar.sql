-- Migration: marketing calendar
-- Feature:   Marketing Calendar — a month / week calendar of marketing events.
--            Each event has a date, owner, topic, an optional campaign tag and
--            its content: either a URL where the campaign content lives or an
--            uploaded file. Campaigns are a managed list the events tag into.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)
--
-- Adds two tables:
--   * marketing_campaigns — the managed campaign list. Deleting a campaign
--                           un-tags its events (campaign_id set to null); the
--                           events themselves stay on the calendar.
--   * marketing_events    — one row per event. `file_data` holds an uploaded
--                           file as base64 (capped at 3MB by the backend) and
--                           is left out of list responses; it is fetched on
--                           demand when someone downloads the file.

create table if not exists public.marketing_campaigns (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  color       text        not null default '#5ED49A',
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_marketing_campaigns_name
  on public.marketing_campaigns (lower(name));


create table if not exists public.marketing_events (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null default '',
  event_date   date        not null,
  owner        text        not null default '',
  topic        text        not null default '',
  campaign_id  uuid        references public.marketing_campaigns(id) on delete set null,
  content_url  text        not null default '',
  file_name    text        not null default '',
  mime_type    text        not null default '',
  size_bytes   integer     not null default 0,
  file_data    text        not null default '',   -- base64 payload
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_marketing_events_date
  on public.marketing_events (event_date asc);

create index if not exists idx_marketing_events_campaign
  on public.marketing_events (campaign_id);


-- The Flask backend connects with a single key and does its own access
-- control, like every other table in this app. Keep RLS off so the backend
-- can read and write.
alter table public.marketing_campaigns disable row level security;
alter table public.marketing_events    disable row level security;
