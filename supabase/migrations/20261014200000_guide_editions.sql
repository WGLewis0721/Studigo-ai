-- Immutable grounded guide editions. Identical keys reuse the stored object.

create table if not exists public.guide_editions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  edition_key text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner_id, edition_key)
);

alter table public.guide_editions enable row level security;

drop policy if exists guide_editions_owner_read on public.guide_editions;
create policy guide_editions_owner_read on public.guide_editions
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.guide_editions from public, anon;
grant select on public.guide_editions to authenticated;
grant all on public.guide_editions to service_role;

create or replace function public.publish_guide_edition(
  p_room uuid, p_owner uuid, p_key text, p_content jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select content into v_existing from public.guide_editions
    where owner_id = p_owner and edition_key = p_key;
  if found then
    return v_existing;
  end if;
  insert into public.guide_editions(room_id, owner_id, edition_key, content)
  values (p_room, p_owner, p_key, p_content);
  return p_content;
end $$;

create or replace function public.read_guide_edition(p_owner uuid, p_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_content jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select content into v_content from public.guide_editions
    where owner_id = p_owner and edition_key = p_key;
  return v_content;
end $$;

revoke all on function public.publish_guide_edition(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.read_guide_edition(uuid, text) from public, anon, authenticated;
grant execute on function public.publish_guide_edition(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.read_guide_edition(uuid, text) to service_role;
