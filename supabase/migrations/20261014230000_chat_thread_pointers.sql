-- Active Learn/Coach thread pointer. Transcripts stay in messages; this row is only
-- the current thread id, topic cursor, and selected scope for one owner and room.
-- An archived conversation is never a current thread.

create table if not exists public.chat_thread_pointers (
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  surface text not null check (surface in ('learn', 'coach')),
  conversation_id uuid references public.conversations(id) on delete set null,
  cursor_index integer not null default 0 check (cursor_index >= 0 and cursor_index < 1000),
  topic_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (owner_id, room_id, surface),
  check (cardinality(topic_ids) <= 80)
);

alter table public.chat_thread_pointers enable row level security;

drop policy if exists chat_thread_pointers_select_own on public.chat_thread_pointers;
create policy chat_thread_pointers_select_own on public.chat_thread_pointers
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists chat_thread_pointers_insert_own on public.chat_thread_pointers;
create policy chat_thread_pointers_insert_own on public.chat_thread_pointers
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and c.owner_id = auth.uid()
          and c.room_id = room_id
          and c.surface = chat_thread_pointers.surface
          and c.archived_at is null
      )
    )
  );

drop policy if exists chat_thread_pointers_update_own on public.chat_thread_pointers;
create policy chat_thread_pointers_update_own on public.chat_thread_pointers
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and c.owner_id = auth.uid()
          and c.room_id = room_id
          and c.surface = chat_thread_pointers.surface
          and c.archived_at is null
      )
    )
  );

drop policy if exists chat_thread_pointers_insert_not_anonymous on public.chat_thread_pointers;
create policy chat_thread_pointers_insert_not_anonymous on public.chat_thread_pointers
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists chat_thread_pointers_update_not_anonymous on public.chat_thread_pointers;
create policy chat_thread_pointers_update_not_anonymous on public.chat_thread_pointers
  as restrictive for update to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

revoke all on public.chat_thread_pointers from public, anon;
grant select, insert, update on public.chat_thread_pointers to authenticated;
grant all on public.chat_thread_pointers to service_role;
