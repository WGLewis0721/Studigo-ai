-- Additive page coverage. Existing rows keep their status; an empty coverage
-- list means a ready document stays fully citable. Uncertain and unreadable
-- pages are never source evidence, including on a partial document.

alter table public.documents
  add column if not exists page_coverage jsonb not null default '[]'::jsonb;

do $$
declare constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'documents' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%uploaded%ready%failed%';
  if constraint_name is not null then
    execute format('alter table public.documents drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'queued', 'processing', 'ready', 'partial', 'failed'));

create or replace function public.page_coverage_is_valid(p_coverage jsonb)
returns boolean
language plpgsql
immutable
as $$
declare entry jsonb;
begin
  if jsonb_typeof(p_coverage) is distinct from 'array' then return false; end if;
  for entry in select value from jsonb_array_elements(p_coverage) loop
    if jsonb_typeof(entry) is distinct from 'object' then return false; end if;
    if coalesce(entry->>'state', '') not in ('readable', 'uncertain', 'unreadable') then return false; end if;
    if coalesce(entry->>'pageNumber', '') !~ '^[0-9]+$' then return false; end if;
  end loop;
  return true;
end $$;

alter table public.documents
  drop constraint if exists documents_page_coverage_shape;

alter table public.documents
  add constraint documents_page_coverage_shape
  check (public.page_coverage_is_valid(page_coverage));

create or replace function public.chunk_page_is_eligible(
  p_status text,
  p_coverage jsonb,
  p_page integer
) returns boolean
language sql
immutable
as $$
  select p_status in ('ready', 'partial')
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_coverage, '[]'::jsonb)) entry
      where coalesce(entry->>'state', '') in ('uncertain', 'unreadable')
        and (
          p_page is null
          or (
            coalesce(entry->>'pageNumber', '') ~ '^[0-9]+$'
            and (entry->>'pageNumber')::integer = p_page
          )
        )
    );
$$;

revoke all on function public.chunk_page_is_eligible(text, jsonb, integer) from public, anon;
grant execute on function public.chunk_page_is_eligible(text, jsonb, integer) to authenticated, service_role;

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
language sql
stable
security invoker
set search_path = public, extensions
as $$
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

create or replace function public.match_study_chunks_hybrid(
  p_room_id uuid,
  p_query_embedding extensions.vector(1536),
  p_query text,
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
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with vector_hits as (
    select c.id, row_number() over (order by c.embedding <=> p_query_embedding) as rnk
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where c.room_id = p_room_id
      and c.owner_id = coalesce(p_owner_id, auth.uid())
      and d.owner_id = c.owner_id and d.room_id = c.room_id
      and public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
      and c.embedding is not null
      and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
    limit 40
  ),
  text_hits as (
    select c.id, row_number() over (
      order by ts_rank(c.content_tsv, plainto_tsquery('english', p_query)) desc
    ) as rnk
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where c.room_id = p_room_id
      and c.owner_id = coalesce(p_owner_id, auth.uid())
      and d.owner_id = c.owner_id and d.room_id = c.room_id
      and public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
      and c.content_tsv @@ plainto_tsquery('english', coalesce(p_query, ''))
    limit 40
  ),
  fused as (
    select id, sum(1.0 / (60 + rnk)) as score
    from (
      select id, rnk from vector_hits
      union all
      select id, rnk from text_hits
    ) ranked
    group by id
  )
  select
    c.id as chunk_id,
    d.id as document_id,
    d.name as document_name,
    c.content,
    c.page_number,
    coalesce(c.page_label, d.page_label, 'page') as page_label,
    d.source_type,
    d.source_priority as priority,
    f.score::double precision as similarity
  from fused f
  join public.document_chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id
  where public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
  order by f.score desc, public.teacher_source_boost(d.source_priority) desc
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
          and c.content ~ '[^[:space:]]'
          and public.chunk_page_is_eligible(d.status, d.page_coverage, c.page_number)
      )
  ) usable
$$;

create or replace function public.claim_document(p_document_id uuid, p_owner_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare claimed uuid;
begin
  update documents set status = 'processing', attempts = attempts + 1,
    processing_started_at = now(), error_message = null
  where id = p_document_id and owner_id = p_owner_id and attempts < 3
    and (status in ('uploaded', 'queued', 'failed', 'partial')
      or (status = 'processing' and processing_started_at < now() - interval '10 minutes'))
  returning id into claimed;
  if claimed is null and exists(select 1 from documents where id = p_document_id and owner_id = p_owner_id and attempts >= 3) then
    raise exception 'Processing retry limit reached (3 attempts). Upload a corrected file.';
  end if;
  return claimed is not null;
end $$;
