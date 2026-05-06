-- Migration: ideas.for_another_day
-- Feature:   Park ideas on a separate "For another day" list so they don't
--            clutter the active board (and aren't included in voting), but
--            can be moved back into the regular list whenever we want.
-- Apply via: Supabase SQL editor (project fsiyiyamxerpwooutriq)

alter table public.ideas
  add column if not exists for_another_day boolean not null default false;

create index if not exists idx_ideas_for_another_day
  on public.ideas (for_another_day, created_at desc);
