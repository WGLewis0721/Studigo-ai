-- Named teacher-source boost, optional hybrid retrieval, and a daily AI budget.
-- The boost keeps the previous source_priority/1000 magnitude. Hybrid retrieval
-- is a separate function and is not the default match path.

create or replace function public.teacher_source_boost(priority integer)
returns double precision
language sql
immutable
as $$
  select coalesce(priority, 0)::double precision / 1000.0;
$$;

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
    and (d.status = 'ready' or (current_user = 'service_role' and d.status = 'processing'))
    and c.embedding is not null
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by (
    (1 - (c.embedding <=> p_query_embedding))
    + public.teacher_source_boost(d.source_priority)
  ) desc
  limit greatest(1, least(p_match_count, 40));
$$;

alter table public.document_chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists document_chunks_content_tsv_idx
  on public.document_chunks using gin (content_tsv);

-- Reciprocal rank fusion of the existing vector predicate and a room-scoped
-- full-text rank. Callers opt in. Owner and room filters match match_study_chunks.
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
      and d.status = 'ready'
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
      and d.status = 'ready'
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
  order by f.score desc, public.teacher_source_boost(d.source_priority) desc
  limit greatest(1, least(p_match_count, 40));
$$;

grant execute on function public.teacher_source_boost(integer) to authenticated, service_role;
grant execute on function public.match_study_chunks_hybrid(uuid, extensions.vector, text, integer, double precision, uuid)
  to authenticated, service_role;

alter table public.documents
  add column if not exists last_forced_reindex_at timestamptz;

create table if not exists public.ai_usage_daily (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now()))::date,
  calls integer not null default 0,
  tokens integer not null default 0,
  primary key (owner_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

drop policy if exists ai_usage_select_own on public.ai_usage_daily;
create policy ai_usage_select_own on public.ai_usage_daily
  for select to authenticated
  using (owner_id = auth.uid());

create or replace function public.consume_ai_budget(
  p_owner_id uuid,
  p_calls integer,
  p_tokens integer,
  p_max_calls integer,
  p_max_tokens integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_calls integer;
  next_tokens integer;
begin
  if p_owner_id is null then
    return false;
  end if;
  if auth.uid() is null or p_owner_id is distinct from auth.uid() then
    return false;
  end if;
  if p_calls < 0 or p_tokens < 0 or p_max_calls < 1 or p_max_tokens < 1 then
    return false;
  end if;

  insert into public.ai_usage_daily as usage (owner_id, usage_date, calls, tokens)
  values (p_owner_id, (timezone('utc', now()))::date, 0, 0)
  on conflict (owner_id, usage_date) do nothing;

  select usage.calls + p_calls, usage.tokens + p_tokens
    into next_calls, next_tokens
  from public.ai_usage_daily as usage
  where usage.owner_id = p_owner_id
    and usage.usage_date = (timezone('utc', now()))::date
  for update;

  if next_calls > p_max_calls or next_tokens > p_max_tokens then
    return false;
  end if;

  update public.ai_usage_daily as usage
  set calls = next_calls, tokens = next_tokens
  where usage.owner_id = p_owner_id
    and usage.usage_date = (timezone('utc', now()))::date;
  return true;
end;
$$;

revoke all on function public.consume_ai_budget(uuid, integer, integer, integer, integer) from public;
grant execute on function public.consume_ai_budget(uuid, integer, integer, integer, integer) to authenticated, service_role;
