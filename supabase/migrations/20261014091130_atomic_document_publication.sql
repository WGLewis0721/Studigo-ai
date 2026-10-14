-- The active rows remain readable until all replacement artifacts can commit.
alter table public.documents
  add column active_revision bigint not null default 0,
  add column ingest_claim_token uuid,
  add column refresh_error_message text;
update public.documents set active_revision = 1 where status = 'ready';

create table public.document_ingest_staging (
  document_id uuid not null references public.documents(id) on delete cascade,
  room_id uuid not null,
  owner_id uuid not null,
  claim_token uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  payload jsonb not null,
  primary key (document_id, claim_token, chunk_index),
  foreign key (document_id, room_id, owner_id) references public.documents(id, room_id, owner_id) on delete cascade
);
alter table public.document_ingest_staging enable row level security;
revoke all on public.document_ingest_staging from public, anon, authenticated;
grant all on public.document_ingest_staging to service_role;

create function public.claim_document_revision(
  p_document_id uuid, p_room_id uuid, p_owner_id uuid,
  p_force boolean default false, p_cooldown_ms bigint default 900000
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.documents; token uuid := gen_random_uuid();
begin
  -- Match refresh_topic_map's lock order, including across documents in a room.
  perform 1 from public.study_rooms where id=p_room_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  select * into d from public.documents where id=p_document_id
    and room_id=p_room_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Document not found'; end if;
  if (d.ingest_claim_token is not null or d.status='processing')
    and d.processing_started_at > now() - interval '10 minutes' then return null; end if;
  if p_force then
    if p_cooldown_ms is null or p_cooldown_ms < 0 then raise exception 'Invalid cooldown'; end if;
    if d.last_forced_reindex_at > now() - p_cooldown_ms * interval '1 millisecond' then
      raise exception 'This study guide was just refreshed. Wait a few minutes before refreshing it again.';
    end if;
  else
    if d.status='ready' then return null; end if;
    if d.attempts >= 3 then raise exception 'Processing retry limit reached (3 attempts). Upload a corrected file.'; end if;
  end if;
  delete from public.document_ingest_staging where document_id=d.id;
  update public.documents set
    status=case when d.status='ready' then 'ready' else 'processing' end,
    attempts=case when p_force then 1 else attempts+1 end,
    processing_started_at=now(), ingest_claim_token=token,
    last_forced_reindex_at=case when p_force then now() else last_forced_reindex_at end,
    refresh_error_message=null, error_message=null where id=d.id;
  return jsonb_build_object('token',token,'revision',d.active_revision);
end $$;

create function public.publish_document_revision(
  p_document_id uuid, p_room_id uuid, p_owner_id uuid, p_claim_token uuid,
  p_revision bigint, p_chunk_count integer, p_page_count integer,
  p_page_label text, p_ocr_page_count integer, p_topics jsonb default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare d public.documents; topic_count integer := 0;
begin
  perform 1 from public.study_rooms where id=p_room_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  select * into d from public.documents where id=p_document_id
    and room_id=p_room_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Document not found'; end if;
  if d.ingest_claim_token is distinct from p_claim_token or p_claim_token is null
    or d.active_revision is distinct from p_revision then raise exception 'Stale ingestion claim'; end if;
  if p_chunk_count is null or p_chunk_count <= 0 or
    (select count(*) from public.document_ingest_staging where document_id=d.id
      and room_id=p_room_id and owner_id=p_owner_id and claim_token=p_claim_token) <> p_chunk_count then
    raise exception 'Incomplete staged revision'; end if;
  delete from public.document_chunks where document_id=d.id;
  insert into public.document_chunks(document_id,room_id,owner_id,chunk_index,page_number,page_label,content,token_count,metadata,embedding)
    select d.id,d.room_id,d.owner_id,s.chunk_index,(payload->>'page_number')::integer,
      p_page_label,payload->>'content',(payload->>'token_count')::integer,
      coalesce(payload->'metadata','{}'::jsonb),(payload->>'embedding')::extensions.vector(1536)
    from public.document_ingest_staging s where document_id=d.id
      and room_id=p_room_id and owner_id=p_owner_id and claim_token=p_claim_token;
  if exists(select 1 from public.document_chunks where document_id=d.id and embedding is null) then
    raise exception 'Incomplete embeddings'; end if;
  if d.source_type in ('study_guide','teacher_material') and p_topics is null then
    raise exception 'Missing topic derivation'; end if;
  if p_topics is not null then
    topic_count := public.refresh_topic_map(d.room_id,d.owner_id,d.id,d.source_type='study_guide',p_topics);
  end if;
  update public.documents set status='ready',active_revision=active_revision+1,
    page_count=p_page_count,page_label=p_page_label,ocr_page_count=p_ocr_page_count,
    chunk_count=p_chunk_count,processed_at=now(),error_message=null,refresh_error_message=null,
    ingest_claim_token=null,processing_started_at=null where id=d.id;
  delete from public.document_ingest_staging where document_id=d.id and claim_token=p_claim_token;
  return topic_count;
end $$;

create function public.fail_document_revision(
  p_document_id uuid, p_owner_id uuid, p_claim_token uuid, p_revision bigint, p_error text
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.documents set
    status=case when status='ready' then 'ready' else 'failed' end,
    refresh_error_message=case when status='ready' then left(p_error,500) else null end,
    error_message=case when status='ready' then error_message else left(p_error,500) end,
    ingest_claim_token=null,processing_started_at=null
    where id=p_document_id and owner_id=p_owner_id and ingest_claim_token=p_claim_token
      and active_revision=p_revision;
  if not found then return false; end if;
  delete from public.document_ingest_staging where document_id=p_document_id and claim_token=p_claim_token;
  return true;
end $$;

revoke all on function public.claim_document_revision(uuid,uuid,uuid,boolean,bigint) from public,anon,authenticated;
revoke all on function public.publish_document_revision(uuid,uuid,uuid,uuid,bigint,integer,integer,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.fail_document_revision(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.claim_document_revision(uuid,uuid,uuid,boolean,bigint) to service_role;
grant execute on function public.publish_document_revision(uuid,uuid,uuid,uuid,bigint,integer,integer,text,integer,jsonb) to service_role;
grant execute on function public.fail_document_revision(uuid,uuid,uuid,bigint,text) to service_role;
