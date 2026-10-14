-- Legacy conversations remain unclassified. Never infer their surface from
-- their contents or Coach state; new conversations receive a server-set value.
alter table public.conversations
  add column surface text check (surface in ('coach', 'learn', 'ask')),
  add column archived_at timestamptz;

create index conversations_active_surface_idx
  on public.conversations (owner_id, room_id, surface, created_at desc)
  where archived_at is null and surface is not null;

-- Trusted server code alone may create/assign a surface. Authenticated users
-- can archive their own rows through the invoker function below; no history is
-- deleted, and the existing owner-scoped SELECT/UPDATE RLS policies apply.
grant update (archived_at) on public.conversations to authenticated;

create function public.archive_conversation_surface(
  p_room_id uuid,
  p_conversation_id uuid,
  p_surface text
) returns boolean
language plpgsql security invoker set search_path = public as $$
declare current_conversation public.conversations%rowtype;
begin
  if p_surface is null or p_surface not in ('coach', 'learn') then
    raise exception 'Invalid conversation surface' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.study_rooms
    where id = p_room_id and owner_id = (select auth.uid())
  ) then
    raise exception 'Study Room unavailable' using errcode = '42501';
  end if;
  if p_conversation_id is null then return false; end if;

  select * into current_conversation
  from public.conversations
  where id = p_conversation_id
    and room_id = p_room_id
    and owner_id = (select auth.uid())
    and surface = p_surface
  for update;
  if not found then
    raise exception 'Conversation surface unavailable' using errcode = '42501';
  end if;
  if current_conversation.archived_at is null then
    update public.conversations
    set archived_at = clock_timestamp()
    where id = current_conversation.id;
  end if;
  return true;
end;
$$;

revoke all on function public.archive_conversation_surface(uuid, uuid, text) from public, anon;
grant execute on function public.archive_conversation_surface(uuid, uuid, text) to authenticated;
