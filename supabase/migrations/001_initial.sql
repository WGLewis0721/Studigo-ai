-- Studigo initial data model
-- Apply through the Supabase CLI/migrations once a project is linked.

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  subject text,
  course_name text,
  test_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text not null unique,
  source_type text not null default 'other' check (
    source_type in (
      'study_guide', 'teacher_material', 'textbook', 'student_notes',
      'worksheet', 'presentation', 'other'
    )
  ),
  source_priority integer generated always as (
    case source_type
      when 'study_guide' then 100
      when 'teacher_material' then 95
      when 'worksheet' then 90
      when 'presentation' then 85
      when 'student_notes' then 75
      when 'textbook' then 70
      else 50
    end
  ) stored,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'queued', 'processing', 'ready', 'failed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer,
  content text not null check (char_length(content) > 0),
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  title text not null,
  objective text,
  source_document_ids uuid[] not null default '{}',
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  status text not null default 'not_started' check (status in ('not_started', 'learning', 'mastered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_rooms_owner on public.study_rooms(owner_id);
create index if not exists idx_documents_room on public.documents(room_id, created_at desc);
create index if not exists idx_document_chunks_room on public.document_chunks(room_id);
create index if not exists idx_document_chunks_document on public.document_chunks(document_id, chunk_index);
create index if not exists idx_topics_room on public.topics(room_id);
create index if not exists idx_conversations_room on public.conversations(room_id, created_at desc);
create index if not exists idx_chunks_embedding_hnsw
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_rooms_touch_updated_at on public.study_rooms;
create trigger study_rooms_touch_updated_at
before update on public.study_rooms
for each row execute function public.touch_updated_at();

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
before update on public.documents
for each row execute function public.touch_updated_at();

drop trigger if exists topics_touch_updated_at on public.topics;
create trigger topics_touch_updated_at
before update on public.topics
for each row execute function public.touch_updated_at();

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

alter table public.study_rooms enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.topics enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "study_rooms_select_own" on public.study_rooms
for select to authenticated using (owner_id = auth.uid());
create policy "study_rooms_insert_own" on public.study_rooms
for insert to authenticated with check (owner_id = auth.uid());
create policy "study_rooms_update_own" on public.study_rooms
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "study_rooms_delete_own" on public.study_rooms
for delete to authenticated using (owner_id = auth.uid());

create policy "documents_select_own" on public.documents
for select to authenticated using (owner_id = auth.uid());
create policy "documents_insert_own_room" on public.documents
for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.study_rooms r
    where r.id = room_id and r.owner_id = auth.uid()
  )
);
create policy "documents_update_own" on public.documents
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "documents_delete_own" on public.documents
for delete to authenticated using (owner_id = auth.uid());

create policy "chunks_select_own" on public.document_chunks
for select to authenticated using (owner_id = auth.uid());

create policy "topics_select_own_room" on public.topics
for select to authenticated using (
  exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);
create policy "topics_insert_own_room" on public.topics
for insert to authenticated with check (
  exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);
create policy "topics_update_own_room" on public.topics
for update to authenticated using (
  exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);
create policy "topics_delete_own_room" on public.topics
for delete to authenticated using (
  exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);

create policy "conversations_select_own" on public.conversations
for select to authenticated using (owner_id = auth.uid());
create policy "conversations_insert_own_room" on public.conversations
for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);
create policy "conversations_update_own" on public.conversations
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "conversations_delete_own" on public.conversations
for delete to authenticated using (owner_id = auth.uid());

create policy "messages_select_own_conversation" on public.messages
for select to authenticated using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.owner_id = auth.uid()
  )
);
create policy "messages_insert_own_conversation" on public.messages
for insert to authenticated with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.owner_id = auth.uid()
  )
);

create or replace function public.match_study_chunks(
  p_room_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 8,
  p_min_similarity double precision default 0.35
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  page_number integer,
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
    d.source_type,
    d.source_priority as priority,
    (1 - (c.embedding <=> p_query_embedding))::double precision as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.room_id = p_room_id
    and c.owner_id = auth.uid()
    and d.owner_id = auth.uid()
    and c.embedding is not null
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by (
    (1 - (c.embedding <=> p_query_embedding))
    + (d.source_priority::double precision / 1000.0)
  ) desc
  limit greatest(1, least(p_match_count, 20));
$$;

grant execute on function public.match_study_chunks(uuid, extensions.vector, integer, double precision)
  to authenticated;

insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do update set public = excluded.public;

create policy "study_materials_select_own" on storage.objects
for select to authenticated using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "study_materials_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "study_materials_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
