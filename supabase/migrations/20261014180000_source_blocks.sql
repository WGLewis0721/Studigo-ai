-- Versioned reading-order blocks for the active derived revision.
-- Block text is a projection. It does not replace the stored original.

create table if not exists public.source_blocks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  room_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  block_key text not null,
  kind text not null check (kind in ('heading', 'paragraph', 'term', 'table', 'unknown')),
  page_number integer,
  reading_order integer not null,
  raw_text text not null,
  normalized_text text not null,
  coverage text not null,
  fingerprint text not null,
  unique (document_id, revision, block_key)
);

alter table public.document_chunks
  add column if not exists block_key text;

alter table public.source_blocks enable row level security;

drop policy if exists source_blocks_owner_read on public.source_blocks;
create policy source_blocks_owner_read on public.source_blocks
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.source_blocks from public, anon;
grant select on public.source_blocks to authenticated;
grant all on public.source_blocks to service_role;

create or replace function public.read_source_block(
  p_room uuid, p_document uuid, p_block_key text
) returns table (
  block_key text,
  kind text,
  page_number integer,
  reading_order integer,
  normalized_text text
)
language sql stable security invoker set search_path = public as $$
  select b.block_key, b.kind, b.page_number, b.reading_order, b.normalized_text
  from public.source_blocks b
  join public.documents d on d.id = b.document_id
  where b.room_id = p_room
    and b.document_id = p_document
    and b.block_key = p_block_key
    and b.owner_id = auth.uid()
    and d.owner_id = auth.uid()
    and d.room_id = p_room
    and b.revision = d.active_revision
    and public.chunk_page_is_eligible(d.status, d.page_coverage, b.page_number);
$$;

revoke all on function public.read_source_block(uuid, uuid, text) from public, anon;
grant execute on function public.read_source_block(uuid, uuid, text) to authenticated;
