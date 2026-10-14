-- Objective sources define the test scope. Notes and slides add support.
-- A second guide does not erase another guide's objectives. Replacing one
-- supporting file drops only that file's support.

alter table public.topics
  add column if not exists objective_document_ids uuid[] not null default '{}',
  add column if not exists support_document_ids uuid[] not null default '{}';

create table if not exists public.topic_source_memberships (
  topic_id uuid not null references public.topics(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  room_id uuid not null,
  owner_id uuid not null,
  role text not null check (role in ('objective', 'support')),
  evidence jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  primary key (topic_id, document_id, role)
);

alter table public.topic_source_memberships enable row level security;

drop policy if exists topic_memberships_owner_read on public.topic_source_memberships;
create policy topic_memberships_owner_read on public.topic_source_memberships
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.topic_source_memberships from public, anon;
grant select on public.topic_source_memberships to authenticated;
grant all on public.topic_source_memberships to service_role;

create or replace function public.refresh_topic_memberships(p_topic uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.topics set
    evidence = coalesce((
      select jsonb_agg(entry order by case when membership.role = 'objective' then 0 else 1 end, entry->>'documentId')
      from public.topic_source_memberships membership
      cross join lateral jsonb_array_elements(membership.evidence) entry
      where membership.topic_id = p_topic and membership.active
    ), '[]'::jsonb),
    source_document_ids = coalesce((
      select array_agg(distinct membership.document_id)
      from public.topic_source_memberships membership
      where membership.topic_id = p_topic and membership.active
    ), '{}'),
    objective_document_ids = coalesce((
      select array_agg(distinct membership.document_id)
      from public.topic_source_memberships membership
      where membership.topic_id = p_topic and membership.active and membership.role = 'objective'
    ), '{}'),
    support_document_ids = coalesce((
      select array_agg(distinct membership.document_id)
      from public.topic_source_memberships membership
      where membership.topic_id = p_topic and membership.active and membership.role = 'support'
    ), '{}')
  where id = p_topic;
end $$;

create or replace function public.refresh_topic_map(
  p_room_id uuid, p_owner_id uuid, p_document_id uuid, p_is_guide boolean, p_topics jsonb
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  item jsonb;
  old public.topics%rowtype;
  inserted_count integer := 0;
  position integer := 0;
  ids uuid[] := '{}';
  current_topic uuid;
  affected uuid;
  same_objective boolean;
  was_edited boolean;
  v_role text := case when p_is_guide then 'objective' else 'support' end;
  v_evidence jsonb;
begin
  perform 1 from study_rooms where id = p_room_id and owner_id = p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  perform 1 from documents where id = p_document_id and room_id = p_room_id and owner_id = p_owner_id;
  if not found then raise exception 'Document not found'; end if;

  for item in select * from jsonb_array_elements(coalesce(p_topics, '[]'::jsonb)) loop
    select * into old from topics where room_id = p_room_id
      and lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', ' ', 'g'))
        = lower(regexp_replace(trim(item->>'title'), '[^a-zA-Z0-9]+', ' ', 'g'))
      order by active desc, created_at
      limit 1;
    v_evidence := coalesce((
      select jsonb_agg(entry || jsonb_build_object('documentId', p_document_id, 'role', v_role))
      from jsonb_array_elements(coalesce(item->'evidence', '[]'::jsonb)) entry
    ), '[]'::jsonb);

    if not p_is_guide then
      if not found or old.learner_removed or not old.active then
        continue;
      end if;
      insert into topic_source_memberships(topic_id, document_id, room_id, owner_id, role, evidence, active)
      values(old.id, p_document_id, p_room_id, p_owner_id, 'support', v_evidence, true)
      on conflict (topic_id, document_id, role) do update
        set evidence = excluded.evidence, active = true;
      ids := array_append(ids, old.id);
      continue;
    end if;

    was_edited := false;
    if found then
      if old.learner_removed then
        ids := array_append(ids, old.id);
        position := position + 1;
        continue;
      end if;
      was_edited := old.learner_edited;
      same_objective := lower(regexp_replace(coalesce(old.objective, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
        = lower(regexp_replace(coalesce(item->>'objective', ''), '[^a-zA-Z0-9]+', ' ', 'g'));
      current_topic := old.id;
      if not same_objective and not was_edited then
        update topics set active = false where id = old.id;
        update topic_source_memberships membership set active = false
          where membership.topic_id = old.id and membership.document_id = p_document_id;
        current_topic := null;
      end if;
    else
      current_topic := null;
    end if;

    if current_topic is null then
      insert into topics(room_id, owner_id, title, objective)
      values(p_room_id, p_owner_id, item->>'title', item->>'objective')
      returning id into current_topic;
      inserted_count := inserted_count + 1;
      was_edited := false;
    end if;

    update topics set
      title = case when was_edited then title else item->>'title' end,
      objective = case when was_edited then objective else item->>'objective' end,
      priority = case when was_edited then priority else coalesce((item->>'priority')::integer, priority) end,
      key_terms = array(select jsonb_array_elements_text(coalesce(item->'keyTerms', '[]'::jsonb))),
      origin = case when was_edited then origin else 'study_guide' end,
      order_index = position,
      active = true
    where id = current_topic;

    insert into topic_source_memberships(topic_id, document_id, room_id, owner_id, role, evidence, active)
    values(current_topic, p_document_id, p_room_id, p_owner_id, 'objective', v_evidence, true)
    on conflict (topic_id, document_id, role) do update
      set evidence = excluded.evidence, active = true;
    ids := array_append(ids, current_topic);
    position := position + 1;
  end loop;

  if p_is_guide then
    update topic_source_memberships membership set active = false
    where membership.document_id = p_document_id and membership.role = 'objective'
      and not (membership.topic_id = any(ids));
    update topics t set active = false
    where t.room_id = p_room_id and t.active and not (t.id = any(ids))
      and not exists (
        select 1 from topic_source_memberships membership
        where membership.topic_id = t.id and membership.role = 'objective'
          and membership.active and membership.document_id <> p_document_id
      );
  else
    update topic_source_memberships membership set active = false
    where membership.document_id = p_document_id and membership.role = 'support'
      and not (membership.topic_id = any(ids));
  end if;

  for affected in
    select distinct membership.topic_id from topic_source_memberships membership
    where membership.document_id = p_document_id
  loop
    perform public.refresh_topic_memberships(affected);
  end loop;

  return inserted_count;
end $$;

revoke all on function public.refresh_topic_memberships(uuid) from public, anon, authenticated;
grant execute on function public.refresh_topic_memberships(uuid) to service_role;
