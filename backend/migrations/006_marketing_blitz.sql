-- Migration: marketing blitz template
-- Feature:   Marketing Blitz — a reusable launch-campaign template. Each blitz
--            (e.g. "Blitz: RMB") is one row in `blitzes`, addressed by slug and
--            rendered by src/pages/BlitzPage.jsx. The narrative scaffolding
--            (phases, pillars, demo beats, campaign ideas) lives in the page's
--            BLITZ_CONTENT config; everything a person TYPES lives here.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)
--
-- Adds four tables:
--   * blitzes         — one row per blitz. `slug` is the URL segment (/blitz/rmb).
--   * blitz_fields    — key/value store for every free-text, date and choice
--                       input on the page. Keyed by the field ids used in the
--                       page config, so new inputs need no schema change.
--   * blitz_meetings  — pre-launch briefing rows. Seeded from the page config on
--                       first load, then fully editable: add, edit, delete.
--   * blitz_decks     — the audience deck per blitz (client / partner / agency),
--                       stored as HTML text so the whole team sees the same
--                       deck rather than one person's browser storage.

create table if not exists public.blitzes (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null unique,
  name         text        not null default 'Untitled Blitz',
  feature      text        not null default '',
  status       text        not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


create table if not exists public.blitz_fields (
  id          uuid        primary key default gen_random_uuid(),
  blitz_id    uuid        not null references public.blitzes(id) on delete cascade,
  field_key   text        not null,
  value       text        not null default '',
  updated_at  timestamptz not null default now(),
  unique (blitz_id, field_key)
);

create index if not exists idx_blitz_fields_blitz
  on public.blitz_fields (blitz_id);


create table if not exists public.blitz_meetings (
  id          uuid        primary key default gen_random_uuid(),
  blitz_id    uuid        not null references public.blitzes(id) on delete cascade,
  phase       text        not null default 'field',   -- 'field' | 'analyst' | 'qbr'
  name        text        not null default '',
  audience    text        not null default 'client',  -- 'client' | 'partner' | 'analyst' | 'qbr'
  angle       text        not null default '',
  meet_at     timestamptz,
  sharers     text        not null default '',
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_blitz_meetings_blitz_position
  on public.blitz_meetings (blitz_id, phase, position asc);


create table if not exists public.blitz_decks (
  id          uuid        primary key default gen_random_uuid(),
  blitz_id    uuid        not null references public.blitzes(id) on delete cascade,
  audience    text        not null,                   -- 'client' | 'partner' | 'agency'
  file_name   text        not null default '',
  link        text        not null default '',
  content     text        not null default '',        -- the deck's HTML
  updated_at  timestamptz not null default now(),
  unique (blitz_id, audience)
);

create index if not exists idx_blitz_decks_blitz
  on public.blitz_decks (blitz_id);


-- The Flask backend connects with a single key and does its own access
-- control, exactly like the epics/ideas/kanban tables. Keep RLS off so the
-- backend can read and write (otherwise reads return empty and writes are
-- silently rejected).
alter table public.blitzes        disable row level security;
alter table public.blitz_fields   disable row level security;
alter table public.blitz_meetings disable row level security;
alter table public.blitz_decks    disable row level security;
