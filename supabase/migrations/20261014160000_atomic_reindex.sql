-- Stage a derived revision beside the live index. Publication swaps to it only
-- after the staged rows exist. A failed or stale attempt leaves the previous
-- revision searchable and does not rewrite the stored original.

alter table public.documents
  add column if not exists active_revision bigint not null default 1,
  add column if not exists publish_token uuid,
  add column if not exists refresh_prior_status text,
  add column if not exists refresh_prior_revision bigint,
  add column if not exists refresh_error text;

alter table public.document_chunks
  add column if not exists revision bigint not null default 1;

do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.document_chunks'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%document_id%'
    and pg_get_constraintdef(oid) ilike '%chunk_index%'
    and pg_get_constraintdef(oid) not ilike '%revision%';
  if cname is not null then
    execute format('alter table public.document_chunks drop constraint %I', cname);
  end if;
end $$;

alter table public.document_chunks
  drop constraint if exists document_chunks_revision_chunk_unique;

alter table public.document_chunks
  add constraint document_chunks_revision_chunk_unique unique (document_id, revision, chunk_index);

create or replace function public.claim_forced_studigo_reindex(
  p_document_id uuid, p_owner_id uuid, p_cooldown_seconds integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_document public.documents%rowtype;
  v_now timestamptz := clock_timestamp();
  v_token uuid := gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_document_id is null or p_owner_id is null or
     p_cooldown_seconds is null or p_cooldown_seconds < 900 or p_cooldown_seconds > 86400 then
    return jsonb_build_object('claimed', false, 'reason', 'invalid');
  end if;
  select * into v_document from public.documents
    where id = p_document_id and owner_id = p_owner_id and source_type = 'study_guide'
    for update;
  if not found then return jsonb_build_object('claimed', false, 'reason', 'not_found'); end if;
  if v_document.status = 'processing' then
    return jsonb_build_object('claimed', false, 'reason', 'processing');
  end if;
  if v_document.last_forced_reindex_at is not null and
     v_document.last_forced_reindex_at > v_now - make_interval(secs => p_cooldown_seconds) then
    return jsonb_build_object('claimed', false, 'reason', 'cooldown');
  end if;
  update public.documents set
    status = 'processing', attempts = 1,
    processing_started_at = v_now, processed_at = null,
    error_message = null, last_forced_reindex_at = v_now,
    publish_token = v_token,
    refresh_prior_status = v_document.status,
    refresh_prior_revision = v_document.active_revision,
    refresh_error = null
  where id = v_document.id;
  return jsonb_build_object(
    'claimed', true,
    'token', v_token,
    'revision', v_document.active_revision + 1,
    'prior_status', v_document.status
  );
end $$;

create or replace function public.claim_document(p_document_id uuid, p_owner_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  claimed uuid;
  v_token uuid := gen_random_uuid();
begin
  update documents set status = 'processing', attempts = attempts + 1,
    processing_started_at = now(), error_message = null,
    publish_token = v_token,
    refresh_prior_status = status,
    refresh_prior_revision = active_revision,
    refresh_error = null
  where id = p_document_id and owner_id = p_owner_id and attempts < 3
    and (status in ('uploaded', 'queued', 'failed', 'partial')
      or (status = 'processing' and processing_started_at < now() - interval '10 minutes'))
  returning id into claimed;
  if claimed is null and exists(select 1 from documents where id = p_document_id and owner_id = p_owner_id and attempts >= 3) then
    raise exception 'Processing retry limit reached (3 attempts). Upload a corrected file.';
  end if;
  return claimed is not null;
end $$;

create or replace function public.activate_document_revision(
  p_document_id uuid, p_owner_id uuid, p_token uuid, p_revision bigint
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_document public.documents%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into v_document from public.documents
    where id = p_document_id and owner_id = p_owner_id
    for update;
  if not found then return jsonb_build_object('published', false, 'reason', 'not_found'); end if;
  if v_document.publish_token is distinct from p_token
     or p_revision is distinct from v_document.refresh_prior_revision + 1
     or v_document.active_revision is distinct from v_document.refresh_prior_revision then
    return jsonb_build_object('published', false, 'reason', 'stale');
  end if;
  if not exists (
    select 1 from public.document_chunks
    where document_id = v_document.id and revision = p_revision
  ) then
    return jsonb_build_object('published', false, 'reason', 'empty');
  end if;
  update public.documents set active_revision = p_revision where id = v_document.id;
  return jsonb_build_object('published', true);
end $$;

create or replace function public.commit_document_revision(
  p_document_id uuid, p_owner_id uuid, p_token uuid, p_revision bigint,
  p_status text, p_page_count integer, p_page_label text, p_ocr_page_count integer,
  p_chunk_count integer, p_page_coverage jsonb, p_error_message text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_document public.documents%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('ready', 'partial') then
    return jsonb_build_object('published', false, 'reason', 'invalid');
  end if;
  select * into v_document from public.documents
    where id = p_document_id and owner_id = p_owner_id
    for update;
  if not found then return jsonb_build_object('published', false, 'reason', 'not_found'); end if;
  if v_document.publish_token is distinct from p_token
     or v_document.active_revision is distinct from p_revision then
    return jsonb_build_object('published', false, 'reason', 'stale');
  end if;
  delete from public.document_chunks
    where document_id = v_document.id and revision is distinct from p_revision;
  update public.documents set
    status = p_status,
    page_count = p_page_count,
    page_label = coalesce(p_page_label, page_label),
    ocr_page_count = coalesce(p_ocr_page_count, 0),
    chunk_count = p_chunk_count,
    page_coverage = coalesce(p_page_coverage, '[]'::jsonb),
    error_message = p_error_message,
    refresh_error = null,
    publish_token = null,
    processed_at = clock_timestamp()
  where id = v_document.id;
  return jsonb_build_object('published', true);
end $$;

create or replace function public.abort_document_revision(
  p_document_id uuid, p_owner_id uuid, p_token uuid, p_error text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_document public.documents%rowtype;
  v_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into v_document from public.documents
    where id = p_document_id and owner_id = p_owner_id
    for update;
  if not found then return jsonb_build_object('aborted', false, 'reason', 'not_found'); end if;
  if v_document.publish_token is distinct from p_token then
    return jsonb_build_object('aborted', false, 'reason', 'stale');
  end if;
  delete from public.document_chunks
    where document_id = v_document.id
      and revision is distinct from coalesce(v_document.refresh_prior_revision, v_document.active_revision);
  v_status := case
    when v_document.refresh_prior_status in ('ready', 'partial') then v_document.refresh_prior_status
    else 'failed'
  end;
  update public.documents set
    active_revision = coalesce(v_document.refresh_prior_revision, active_revision),
    status = v_status,
    publish_token = null,
    refresh_error = left(coalesce(p_error, 'Refresh failed'), 500),
    error_message = case when v_status = 'failed' then left(coalesce(p_error, 'Processing failed'), 500) else error_message end
  where id = v_document.id;
  return jsonb_build_object('aborted', true, 'preserved', v_status in ('ready', 'partial'), 'status', v_status);
end $$;

revoke all on function public.activate_document_revision(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.commit_document_revision(uuid, uuid, uuid, bigint, text, integer, text, integer, integer, jsonb, text) from public, anon, authenticated;
revoke all on function public.abort_document_revision(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.activate_document_revision(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.commit_document_revision(uuid, uuid, uuid, bigint, text, integer, text, integer, integer, jsonb, text) to service_role;
grant execute on function public.abort_document_revision(uuid, uuid, uuid, text) to service_role;

create or replace function public.match_study_chunks(
  p_room_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 8,
  p_min_similarity double precision default 0.35,
  p_owner_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  page_number integer,
  page_label text,
  source_type text,
  priority integer,
  similarity double precision
)
language sql stable security invoker set search_path = public, extensions as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.name as document_name,
    c.content,
    c.page_number,
    coalesce(c.page_label, d.page_label, 'page') as page_label,
    d.source_type,
    d.source_priority as priority,
    (1 - (c.embedding <=> p_query_embedding))::double precision as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.room_id = p_room_id
    and c.owner_id = coalesce(p_owner_id, auth.uid())
    and d.owner_id = c.owner_id and d.room_id = c.room_id
    and c.revision = d.active_revision
    and (
      public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
      or (
        current_user = 'service_role'
        and d.status = 'processing'
        and public.chunk_page_is_eligible('ready', d.page_coverage, c.page_number)
      )
    )
    and c.embedding is not null
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by (
    (1 - (c.embedding <=> p_query_embedding))
    + public.teacher_source_boost(d.source_priority)
  ) desc
  limit greatest(1, least(p_match_count, 40));
$$;

create or replace function public.read_session_source_scope(p_room uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from (
    select d.id from documents d
    where d.room_id = p_room and d.owner_id = auth.uid()
      and exists(select 1 from study_rooms r where r.id = p_room and r.owner_id = auth.uid())
      and exists(
        select 1 from document_chunks c
        where c.document_id = d.id and c.room_id = d.room_id and c.owner_id = d.owner_id
          and c.revision = d.active_revision
          and c.content ~ '[^[:space:]]'
          and public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
      )
  ) usable
$$;
