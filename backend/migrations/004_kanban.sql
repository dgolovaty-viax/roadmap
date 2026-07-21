-- Migration: kanban_columns + kanban_cards
-- Feature:   Priority Board — a lightweight kanban with user-defined columns
--            and draggable cards used to force-rank tasks for a round, then
--            clear the cards and start the next round. Card order within a
--            column IS the priority (position 0 = top).
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)
--
-- Adds two tables:
--   * kanban_columns — one row per column. `position` orders columns left→right.
--   * kanban_cards   — one row per card. `position` orders cards top→bottom
--                      within a column (the forced priority). Deleting a
--                      column cascades to its cards. "Clear board" deletes
--                      all cards but leaves the columns intact.

create table if not exists public.kanban_columns (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null default 'New Column',
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_kanban_columns_position
  on public.kanban_columns (position asc);


create table if not exists public.kanban_cards (
  id          uuid        primary key default gen_random_uuid(),
  column_id   uuid        not null references public.kanban_columns(id) on delete cascade,
  title       text        not null default '',
  description text        not null default '',
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_kanban_cards_column_position
  on public.kanban_cards (column_id, position asc);


-- The Flask backend connects with a single key and does its own access
-- control, exactly like the epics/ideas tables. Keep RLS off so the backend
-- can read and write these tables (otherwise reads return empty and writes
-- are silently rejected).
alter table public.kanban_columns disable row level security;
alter table public.kanban_cards   disable row level security;


-- Seed a few default columns so the board isn't empty on first load.
-- (Only inserts when the table is empty.)
insert into public.kanban_columns (title, position)
select * from (values
  ('Backlog', 0),
  ('This Round', 1),
  ('In Progress', 2),
  ('Done', 3)
) as seed(title, position)
where not exists (select 1 from public.kanban_columns);
