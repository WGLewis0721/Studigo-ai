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
-- Chunks: ingestion writes are service-role only
-- ---------------------------------------------------------------------------

alter table public.document_chunks
  add column if not exists page_label text;

drop policy if exists "chunks_insert_own" on public.document_chunks;
revoke insert, update, delete on public.document_chunks from anon, authenticated;

drop policy if exists "chunks_delete_own" on public.document_chunks;


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
  add column if not exists last_practiced_at timestamptz,
  add column if not exists active boolean not null default true;

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
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "quiz_attempts_own" on public.quiz_attempts;
create policy "quiz_attempts_own" on public.quiz_attempts
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "flashcards_own" on public.flashcards;
create policy "flashcards_own" on public.flashcards
for select to authenticated using (owner_id = auth.uid());

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
    and d.owner_id = c.owner_id and d.room_id = c.room_id
    and (d.status = 'ready' or (current_user = 'service_role' and d.status = 'processing'))
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
    where t.room_id = p_room_id and r.owner_id = auth.uid() and t.active
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

-- Security hardening. Browser roles read generated material; trusted server
-- routes perform writes only after a user-client/RLS ownership check.
revoke all on public.quiz_questions from anon, authenticated;
grant select (id, room_id, owner_id, topic_id, kind, prompt, choices, difficulty, created_at)
  on public.quiz_questions to authenticated;
revoke insert, update, delete on public.quiz_attempts, public.flashcards, public.topics
  from anon, authenticated;
drop policy if exists topics_insert_own_room on public.topics;
drop policy if exists topics_update_own_room on public.topics;
drop policy if exists topics_delete_own_room on public.topics;
-- Processing state, storage pointers and attempts cannot be rewritten by a browser.
revoke insert, update on public.documents from anon, authenticated;
grant select, delete on public.documents to authenticated;
grant select on public.quiz_attempts, public.flashcards, public.topics, public.document_chunks to authenticated;
grant all on public.study_rooms, public.documents, public.document_chunks, public.topics,
  public.conversations, public.messages, public.quiz_questions, public.quiz_attempts, public.flashcards to service_role;

-- Composite constraints also validate trusted writers; a chunk cannot point at
-- a different owner's document or a different room.
alter table public.study_rooms add constraint rooms_id_owner_unique unique (id, owner_id);
alter table public.documents add constraint documents_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;
alter table public.documents add constraint documents_id_room_owner_unique unique (id, room_id, owner_id);
alter table public.document_chunks add constraint chunks_document_room_owner_fk
  foreign key (document_id, room_id, owner_id) references public.documents(id, room_id, owner_id) on delete cascade;
alter table public.topics add constraint topics_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;
alter table public.topics alter column owner_id set not null;
alter table public.topics add constraint topics_id_room_owner_unique unique (id, room_id, owner_id);
alter table public.conversations add constraint conversations_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;

-- All derived practice records belong to the same room and learner as their topic.
alter table public.quiz_questions add constraint questions_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;
alter table public.quiz_questions add constraint questions_topic_scope_fk foreign key (topic_id, room_id, owner_id)
  references public.topics(id, room_id, owner_id);
alter table public.quiz_questions add constraint questions_id_room_owner_unique unique (id, room_id, owner_id);
alter table public.quiz_attempts add constraint attempts_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;
alter table public.quiz_attempts add constraint attempts_question_scope_fk foreign key (question_id, room_id, owner_id)
  references public.quiz_questions(id, room_id, owner_id) on delete cascade;
alter table public.quiz_attempts add constraint attempts_topic_scope_fk foreign key (topic_id, room_id, owner_id)
  references public.topics(id, room_id, owner_id);
alter table public.flashcards add constraint cards_room_owner_fk foreign key (room_id, owner_id)
  references public.study_rooms(id, owner_id) on delete cascade;
alter table public.flashcards add constraint cards_topic_scope_fk foreign key (topic_id, room_id, owner_id)
  references public.topics(id, room_id, owner_id);
alter table public.quiz_attempts add column request_id uuid;
create unique index attempts_request_unique on public.quiz_attempts(owner_id, request_id) where request_id is not null;
create unique index attempts_question_unique on public.quiz_attempts(owner_id, question_id) where question_id is not null;

create or replace function public.claim_document(p_document_id uuid, p_owner_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare claimed uuid;
begin
  update documents set status = 'processing', attempts = attempts + 1,
    processing_started_at = now(), error_message = null
  where id = p_document_id and owner_id = p_owner_id and attempts < 3
    and (status in ('uploaded', 'queued', 'failed')
      or (status = 'processing' and processing_started_at < now() - interval '10 minutes'))
  returning id into claimed;
  if claimed is null and exists(select 1 from documents where id = p_document_id and owner_id = p_owner_id and attempts >= 3) then
    raise exception 'Processing retry limit reached (3 attempts). Upload a corrected file.';
  end if;
  return claimed is not null;
end $$;
revoke all on function public.claim_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_document(uuid, uuid) to service_role;

-- Called inside a transaction holding the topic lock, so attempts, schedule,
-- and derived mastery commit or roll back together.
create or replace function public.recalculate_mastery(p_topic_id uuid)
returns numeric language plpgsql security invoker set search_path = public as $$
declare n integer; mastery_value numeric;
begin
  perform 1 from topics where id = p_topic_id for update;
  with recent as (
    select score, row_number() over(order by created_at desc, id desc) as rn
    from quiz_attempts where topic_id = p_topic_id order by created_at desc, id desc limit 12
  ) select count(*), round(sum(score / rn) / nullif(sum(1.0 / rn), 0)
      * (0.55 + 0.45 * least(1.0, count(*) / 4.0))) into n, mastery_value from recent;
  if n = 0 then return 0; end if;
  update topics set mastery_score = mastery_value, last_practiced_at = now(),
    status = case when mastery_value >= 85 and n >= 4 then 'mastered' else 'learning' end
  where id = p_topic_id;
  return mastery_value;
end $$;
revoke all on function public.recalculate_mastery(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_mastery(uuid) to service_role;

create or replace function public.record_quiz_attempt(
  p_question_id uuid, p_owner_id uuid, p_response text, p_selected_choice integer,
  p_score numeric, p_is_correct boolean, p_feedback text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare q quiz_questions; a quiz_attempts; mastery numeric;
begin
  select * into q from quiz_questions where id = p_question_id and owner_id = p_owner_id;
  if not found then raise exception 'Question not found'; end if;
  perform 1 from study_rooms where id = q.room_id for update;
  if q.topic_id is not null then
    perform 1 from topics where id = q.topic_id and active for update;
    if not found then raise exception 'This question is no longer in the study scope. Generate a fresh quiz.'; end if;
  end if;
  select * into a from quiz_attempts where question_id = q.id and owner_id = p_owner_id;
  if not found then
    insert into quiz_attempts(question_id, room_id, owner_id, topic_id, response, selected_choice, is_correct, score, feedback)
    values(q.id, q.room_id, q.owner_id, q.topic_id, p_response, p_selected_choice, p_is_correct, p_score, p_feedback)
    returning * into a;
  end if;
  if q.topic_id is not null then mastery := recalculate_mastery(q.topic_id); end if;
  return jsonb_build_object('isCorrect', a.is_correct, 'score', a.score, 'feedback', a.feedback, 'mastery', mastery);
end $$;
revoke all on function public.record_quiz_attempt(uuid,uuid,text,integer,numeric,boolean,text) from public, anon, authenticated;
grant execute on function public.record_quiz_attempt(uuid,uuid,text,integer,numeric,boolean,text) to service_role;

create or replace function public.review_flashcard(p_card_id uuid, p_owner_id uuid, p_rating integer, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c flashcards; quality integer; new_ease numeric; reps integer; days integer; due timestamptz; mastery numeric;
begin
  if p_rating not in (1,2,3) or p_rating is null or p_request_id is null then raise exception 'Invalid review'; end if;
  select * into c from flashcards where id = p_card_id and owner_id = p_owner_id;
  if not found then raise exception 'Card not found'; end if;
  perform 1 from study_rooms where id = c.room_id for update;
  if c.topic_id is not null then
    perform 1 from topics where id = c.topic_id and active for update;
    if not found then raise exception 'This card is no longer in the study scope.'; end if;
  end if;
  select * into c from flashcards where id = p_card_id and owner_id = p_owner_id for update;
  if exists(select 1 from quiz_attempts where owner_id = p_owner_id and request_id = p_request_id) then
    return jsonb_build_object('cardId',c.id,'dueAt',c.due_at,'intervalDays',c.interval_days,'alreadySaved',true);
  end if;
  if c.due_at > now() then raise exception 'This card has already been reviewed. Reload your deck.'; end if;
  quality := case p_rating when 3 then 5 when 2 then 3 else 1 end;
  new_ease := round(least(3.2, greatest(1.3, c.ease + (0.1 - (5-quality)*(0.08+(5-quality)*0.02)))), 2);
  reps := case when quality < 3 then 0 else c.repetitions + 1 end;
  days := case when quality < 3 then 0 when reps = 1 then 1 when reps = 2 then 3 else greatest(1, round(c.interval_days * new_ease)::integer) end;
  due := now() + case when days = 0 then interval '10 minutes' else make_interval(days => days) end;
  update flashcards set ease = new_ease, repetitions = reps, interval_days = days, due_at = due, last_rating = p_rating where id = c.id;
  insert into quiz_attempts(source, room_id, owner_id, topic_id, response, is_correct, score, request_id)
  values('flashcard', c.room_id, c.owner_id, c.topic_id, 'flashcard:' || c.id || ':' || p_rating,
    p_rating = 3, case p_rating when 3 then 90 when 2 then 60 else 20 end, p_request_id);
  if c.topic_id is not null then mastery := recalculate_mastery(c.topic_id); end if;
  return jsonb_build_object('cardId',c.id,'dueAt',due,'intervalDays',days,'mastery',mastery);
end $$;
revoke all on function public.review_flashcard(uuid,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.review_flashcard(uuid,uuid,integer,uuid) to service_role;

-- A new guide replaces the test scope. Teacher material supplements only when
-- no guide exists. Exact normalized title+objective matches preserve mastery;
-- changed objectives reset evidence and removed topics are deactivated.
create or replace function public.refresh_topic_map(
  p_room_id uuid, p_owner_id uuid, p_document_id uuid, p_is_guide boolean, p_topics jsonb
) returns integer language plpgsql security invoker set search_path = public as $$
declare item jsonb; old topics; inserted_count integer := 0; position integer := 0; ids uuid[] := '{}'; topic_id uuid; same_objective boolean;
begin
  perform 1 from study_rooms where id = p_room_id and owner_id = p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  perform 1 from documents where id = p_document_id and room_id = p_room_id and owner_id = p_owner_id;
  if not found then raise exception 'Document not found'; end if;
  if p_is_guide and exists(select 1 from documents d join documents current on current.id = p_document_id
      where d.room_id = p_room_id and d.source_type = 'study_guide' and d.status = 'ready'
      and (d.created_at, d.id) > (current.created_at, current.id)) then return 0; end if;
  if not p_is_guide and exists(select 1 from documents where room_id = p_room_id and source_type = 'study_guide' and status = 'ready') then return 0; end if;
  for item in select * from jsonb_array_elements(p_topics) loop
    select * into old from topics where room_id = p_room_id
      and lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace(trim(item->>'title'), '[^a-zA-Z0-9]+', ' ', 'g'))
      order by active desc, created_at limit 1;
    if found then
      same_objective := lower(regexp_replace(coalesce(old.objective,''), '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace(coalesce(item->>'objective',''), '[^a-zA-Z0-9]+', ' ', 'g'));
      topic_id := old.id;
      if not same_objective then
        -- Keep historical attempts attached to the retired objective, not to a
        -- different skill that happens to share its title.
        update topics set active = false where id = old.id;
        topic_id := null;
      end if;
    else topic_id := null;
    end if;
    if topic_id is null then
      insert into topics(room_id, owner_id, title, objective) values(p_room_id,p_owner_id,item->>'title',item->>'objective') returning id into topic_id;
      inserted_count := inserted_count + 1;
    end if;
    update topics set title = item->>'title', objective = item->>'objective',
      key_terms = array(select jsonb_array_elements_text(item->'keyTerms')),
      priority = (item->>'priority')::integer, evidence = coalesce(item->'evidence','[]'::jsonb),
      source_document_ids = case when p_is_guide then array[p_document_id]
        else array(select distinct x from unnest(source_document_ids || array[p_document_id]) x) end,
      origin = case when p_is_guide then 'study_guide' else 'teacher_material' end,
      order_index = position, active = true where id = topic_id;
    ids := array_append(ids, topic_id); position := position + 1;
  end loop;
  update topics set active = false where room_id = p_room_id and not (id = any(ids))
    and (p_is_guide or p_document_id = any(source_document_ids));
  return inserted_count;
end $$;
revoke all on function public.refresh_topic_map(uuid,uuid,uuid,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.refresh_topic_map(uuid,uuid,uuid,boolean,jsonb) to service_role;

-- Durable cleanup outbox: a delete/cascade and its storage references commit
-- together. Storage outages leave retryable work, never an untracked original.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  storage_path text not null unique, created_at timestamptz not null default now(),
  attempts integer not null default 0, last_error text
);
alter table public.storage_cleanup_jobs enable row level security;
revoke all on public.storage_cleanup_jobs from public, anon, authenticated;
grant all on public.storage_cleanup_jobs to service_role;
create function private.queue_original_cleanup() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.storage_cleanup_jobs(owner_id, storage_path) values(old.owner_id, old.storage_path)
    on conflict(storage_path) do nothing;
  return old;
end $$;
revoke all on function private.queue_original_cleanup() from public, anon, authenticated;
create trigger queue_original_cleanup before delete on public.documents
for each row execute function private.queue_original_cleanup();
