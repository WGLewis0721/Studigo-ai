-- Studigo Phase 1: make the upload -> ingest -> ask -> cite loop real,
-- plus the topic map, practice modes, and mastery that sit on top of it.

-- ---------------------------------------------------------------------------
-- Documents: ingestion bookkeeping
-- ---------------------------------------------------------------------------

alter table public.documents
  add column if not exists checksum text,
  add column if not exists page_count integer,
  add column if not exists page_label text not null default 'page',
  add column if not exists ocr_page_count integer not null default 0,
  add column if not exists chunk_count integer not null default 0,
  add column if not exists attempts integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz;

create unique index if not exists uniq_documents_room_checksum
  on public.documents(room_id, checksum)
  where checksum is not null;

create index if not exists idx_documents_status on public.documents(status)
  where status in ('uploaded', 'queued', 'processing');

-- ---------------------------------------------------------------------------
-- Chunks: owners write their own rows (ingestion also runs as service role)
-- ---------------------------------------------------------------------------

alter table public.document_chunks
  add column if not exists page_label text;

drop policy if exists "chunks_insert_own" on public.document_chunks;
create policy "chunks_insert_own" on public.document_chunks
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "chunks_delete_own" on public.document_chunks;
create policy "chunks_delete_own" on public.document_chunks
for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Topics: the study-guide derived map
-- ---------------------------------------------------------------------------

alter table public.topics
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists order_index integer not null default 0,
  add column if not exists priority integer not null default 50 check (priority between 0 and 100),
  add column if not exists origin text not null default 'study_guide'
    check (origin in ('study_guide', 'teacher_material', 'materials', 'manual')),
  add column if not exists key_terms text[] not null default '{}',
  add column if not exists evidence jsonb not null default '[]'::jsonb,
  add column if not exists last_practiced_at timestamptz;

update public.topics t
set owner_id = r.owner_id
from public.study_rooms r
where t.room_id = r.id and t.owner_id is null;

create index if not exists idx_topics_room_order on public.topics(room_id, order_index);

-- ---------------------------------------------------------------------------
-- Practice: quiz questions, attempts, flashcards
-- ---------------------------------------------------------------------------

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  kind text not null default 'multiple_choice'
    check (kind in ('multiple_choice', 'short_answer')),
  prompt text not null check (char_length(prompt) > 0),
  choices jsonb not null default '[]'::jsonb,
  correct_choice integer,
  expected_answer text,
  explanation text,
  citations jsonb not null default '[]'::jsonb,
  difficulty text not null default 'core' check (difficulty in ('recall', 'core', 'stretch')),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  -- Null for practice that is not a quiz question, such as a flashcard review.
  question_id uuid references public.quiz_questions(id) on delete cascade,
  source text not null default 'quiz' check (source in ('quiz', 'flashcard')),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  response text,
  selected_choice integer,
  is_correct boolean not null,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  front text not null check (char_length(front) > 0),
  back text not null check (char_length(back) > 0),
  citations jsonb not null default '[]'::jsonb,
  ease numeric(4,2) not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  due_at timestamptz not null default now(),
  last_rating integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quiz_questions_room on public.quiz_questions(room_id, created_at desc);
create index if not exists idx_quiz_questions_topic on public.quiz_questions(topic_id);
create index if not exists idx_quiz_attempts_room on public.quiz_attempts(room_id, created_at desc);
create index if not exists idx_quiz_attempts_topic on public.quiz_attempts(topic_id, created_at desc);
create index if not exists idx_flashcards_room_due on public.flashcards(room_id, due_at);

drop trigger if exists flashcards_touch_updated_at on public.flashcards;
create trigger flashcards_touch_updated_at
before update on public.flashcards
for each row execute function public.touch_updated_at();

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.flashcards enable row level security;

drop policy if exists "quiz_questions_own" on public.quiz_questions;
create policy "quiz_questions_own" on public.quiz_questions
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "quiz_attempts_own" on public.quiz_attempts;
create policy "quiz_attempts_own" on public.quiz_attempts
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "flashcards_own" on public.flashcards;
create policy "flashcards_own" on public.flashcards
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Retrieval: room-scoped match that also works for background jobs
-- ---------------------------------------------------------------------------

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
    and c.embedding is not null
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by (
    (1 - (c.embedding <=> p_query_embedding))
    + (d.source_priority::double precision / 1000.0)
  ) desc
  limit greatest(1, least(p_match_count, 40));
$$;

grant execute on function public.match_study_chunks(uuid, extensions.vector, integer, double precision, uuid)
  to authenticated, service_role;

-- The 4-argument signature from 001 is superseded by the variant above.
drop function if exists public.match_study_chunks(uuid, extensions.vector, integer, double precision);

-- ---------------------------------------------------------------------------
-- Mastery: readiness is derived, never stored as a decorative number
-- ---------------------------------------------------------------------------

create or replace function public.room_readiness(p_room_id uuid)
returns table (
  topic_count integer,
  practiced_topic_count integer,
  average_mastery numeric,
  readiness numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with room_topics as (
    select t.id, t.mastery_score, t.last_practiced_at
    from public.topics t
    join public.study_rooms r on r.id = t.room_id
    where t.room_id = p_room_id and r.owner_id = auth.uid()
  )
  select
    count(*)::integer as topic_count,
    count(*) filter (where last_practiced_at is not null)::integer as practiced_topic_count,
    coalesce(round(avg(mastery_score), 2), 0) as average_mastery,
    -- Unpracticed topics count as zero: readiness means "ready for the whole test".
    coalesce(round(sum(mastery_score) / nullif(count(*), 0), 2), 0) as readiness
  from room_topics;
$$;

grant execute on function public.room_readiness(uuid) to authenticated;
