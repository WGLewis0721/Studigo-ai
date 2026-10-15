-- Room 2 opt-in Learn mission. This is a reading/reflection cursor, not mastery evidence.
create table public.learn_mission_cursors (
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_id uuid not null references public.document_chunks(id) on delete cascade,
  source_revision bigint not null,
  phase text not null default 'brief' check (phase in ('brief','show','try','check','done')),
  reflection text check (reflection in ('ready','review')),
  paused boolean not null default false,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, room_id)
);
create table public.learn_mission_receipts (
  request_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  fingerprint jsonb not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index learn_mission_receipts_created on public.learn_mission_receipts(created_at);
alter table public.learn_mission_cursors enable row level security;
alter table public.learn_mission_receipts enable row level security;
create policy learn_mission_owner on public.learn_mission_cursors for select to authenticated using (owner_id=auth.uid());
revoke all on public.learn_mission_cursors, public.learn_mission_receipts from public, anon, authenticated;
grant select on public.learn_mission_cursors to authenticated;
grant all on public.learn_mission_cursors, public.learn_mission_receipts to service_role;

create function public.read_learn_mission(p_owner uuid, p_room uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m learn_mission_cursors%rowtype; source_row record; valid_source boolean;
begin
  if not exists (select 1 from study_rooms where id=p_room and owner_id=p_owner) then
    raise exception 'Room not found' using errcode='42501';
  end if;
  select * into m from learn_mission_cursors where owner_id=p_owner and room_id=p_room;
  if not found then return jsonb_build_object('mission',null); end if;
  select d.name, c.content, c.page_number into source_row
  from documents d join document_chunks c on c.document_id=d.id
  join topics t on t.id=m.topic_id
  where d.id=m.document_id and c.id=m.chunk_id and d.owner_id=p_owner and d.room_id=p_room
    and t.owner_id=p_owner and t.room_id=p_room and t.active
    and (cardinality(t.source_document_ids)=0 or d.id=any(t.source_document_ids))
    and d.active_revision=m.source_revision and c.revision=m.source_revision
    and c.content ~ '[^[:space:]]' and chunk_page_is_eligible(d.status,d.page_coverage,c.page_number);
  valid_source := found;
  return jsonb_build_object('mission',to_jsonb(m), 'sourceCurrent',valid_source,
    'source',case when valid_source then jsonb_build_object('documentName',source_row.name,'pageNumber',source_row.page_number,'excerpt',left(source_row.content,1200)) else null end);
end $$;

create function public.commit_learn_mission(p_owner uuid, p_room uuid, p_topic uuid,
  p_request uuid, p_expected bigint, p_action text, p_reflection text default null, p_chunk uuid default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m learn_mission_cursors%rowtype; receipt learn_mission_receipts%rowtype;
  fingerprint jsonb; result jsonb; chosen record;
begin
  if p_action not in ('start','restart','advance','back','pause','resume') or p_expected < 0
    or (p_action in ('start','restart') and p_chunk is null) or (p_action not in ('start','restart') and p_chunk is not null)
    or (p_reflection is not null and p_reflection not in ('ready','review')) then
    raise exception 'Invalid mission action' using errcode='22023';
  end if;
  fingerprint:=jsonb_build_object('owner',p_owner,'room',p_room,'topic',p_topic,'expected',p_expected,'action',p_action,'reflection',p_reflection,'chunk',p_chunk);
  -- Lock the owned room before the cursor or receipt. All actions serialize by room.
  perform 1 from study_rooms where id=p_room and owner_id=p_owner for update;
  if not found then raise exception 'Room not found' using errcode='42501'; end if;
  select * into receipt from learn_mission_receipts where request_id=p_request;
  if found then
    if receipt.fingerprint<>fingerprint then raise exception 'Request ID conflict' using errcode='23505'; end if;
    -- Never replay an old passage after its source is replaced or deleted.
    return read_learn_mission(p_owner,p_room);
  end if;
  select * into m from learn_mission_cursors where owner_id=p_owner and room_id=p_room for update;
  if p_action='start' and not found then
    if p_expected<>0 then raise exception 'Stale mission revision' using errcode='40001'; end if;
    select d.id document_id, c.id chunk_id, d.active_revision into chosen
    from topics t join documents d on d.room_id=t.room_id and d.owner_id=t.owner_id
      join document_chunks c on c.document_id=d.id and c.room_id=d.room_id and c.owner_id=d.owner_id
    where t.id=p_topic and t.owner_id=p_owner and t.room_id=p_room and t.active
      and (cardinality(t.source_document_ids)=0 or d.id=any(t.source_document_ids))
      and c.id=p_chunk and c.revision=d.active_revision and c.content ~ '[^[:space:]]'
      and chunk_page_is_eligible(d.status,d.page_coverage,c.page_number)
    order by d.created_at,c.chunk_index limit 1 for share of d,c,t;
    if not found then raise exception 'No current source for this objective' using errcode='22023'; end if;
    insert into learn_mission_cursors(owner_id,room_id,topic_id,document_id,chunk_id,source_revision)
    values(p_owner,p_room,p_topic,chosen.document_id,chosen.chunk_id,chosen.active_revision);
  else
    if not found or m.revision<>p_expected or p_action='start' or (p_action<>'restart' and m.topic_id<>p_topic) then
      raise exception 'Mission changed; reload to resume' using errcode='40001';
    end if;
    if p_action='restart' then
      select d.id document_id, c.id chunk_id, d.active_revision into chosen
      from topics t join documents d on d.room_id=t.room_id and d.owner_id=t.owner_id
        join document_chunks c on c.document_id=d.id and c.room_id=d.room_id and c.owner_id=d.owner_id
      where t.id=p_topic and t.owner_id=p_owner and t.room_id=p_room and t.active
        and (cardinality(t.source_document_ids)=0 or d.id=any(t.source_document_ids))
        and c.id=p_chunk and c.revision=d.active_revision and c.content ~ '[^[:space:]]'
        and chunk_page_is_eligible(d.status,d.page_coverage,c.page_number)
      for share of d,c,t;
      if not found then raise exception 'No current source for this objective' using errcode='22023'; end if;
      update learn_mission_cursors set topic_id=p_topic,document_id=chosen.document_id,chunk_id=chosen.chunk_id,
        source_revision=chosen.active_revision,phase='brief',reflection=null,paused=false,revision=m.revision+1,updated_at=now()
      where owner_id=p_owner and room_id=p_room;
    else
    -- Lock and recheck the exact source at transition time; no stale precision.
    perform 1 from documents d join document_chunks c on c.document_id=d.id
      join topics t on t.id=m.topic_id
    where d.id=m.document_id and c.id=m.chunk_id and d.owner_id=p_owner and d.room_id=p_room
      and t.owner_id=p_owner and t.room_id=p_room and t.active
      and (cardinality(t.source_document_ids)=0 or d.id=any(t.source_document_ids))
      and d.active_revision=m.source_revision and c.revision=m.source_revision
      and c.content ~ '[^[:space:]]' and chunk_page_is_eligible(d.status,d.page_coverage,c.page_number)
    for share of d,c,t;
    if not found then raise exception 'Source changed; restart from current materials' using errcode='40001'; end if;
    if p_action='advance' and (m.paused or m.phase='done' or (m.phase='try' and p_reflection is null)) then
      raise exception 'Mission cannot advance' using errcode='22023';
    end if;
    update learn_mission_cursors set
      phase=case when p_action='advance' then case m.phase when 'brief' then 'show' when 'show' then 'try' when 'try' then 'check' when 'check' then 'done' end
        when p_action='back' then case m.phase when 'done' then 'check' when 'check' then 'try' when 'try' then 'show' else 'brief' end
        else m.phase end,
      reflection=case when p_action='advance' and m.phase='try' then p_reflection else m.reflection end,
      paused=case when p_action='pause' then true when p_action='resume' then false else m.paused end,
      revision=m.revision+1,updated_at=now()
    where owner_id=p_owner and room_id=p_room;
    end if;
  end if;
  result:=read_learn_mission(p_owner,p_room);
  insert into learn_mission_receipts(request_id,owner_id,room_id,fingerprint,snapshot)
    values(p_request,p_owner,p_room,fingerprint,result);
  return result;
end $$;
revoke all on function public.read_learn_mission(uuid,uuid), public.commit_learn_mission(uuid,uuid,uuid,uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.read_learn_mission(uuid,uuid), public.commit_learn_mission(uuid,uuid,uuid,uuid,bigint,text,text,uuid) to service_role;
