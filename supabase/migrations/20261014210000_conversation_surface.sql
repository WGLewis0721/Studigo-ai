-- Additive conversation surface. Null surface means a legacy chat and is not backfilled.
alter table public.conversations
  add column if not exists surface text,
  add column if not exists archived_at timestamptz;

alter table public.conversations drop constraint if exists conversations_surface_check;
alter table public.conversations
  add constraint conversations_surface_check
  check (surface is null or surface in ('learn', 'coach', 'ask'));

create index if not exists conversations_active_surface_idx
  on public.conversations (room_id, owner_id, surface)
  where archived_at is null;
