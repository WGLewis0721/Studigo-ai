-- Room-level stamp for derived lessons and guide editions.
-- A successful replace or delete advances it and marks editions stale.
-- The reading edition key is not switched. A failed refresh does not call this.

alter table public.study_rooms
  add column if not exists corpus_revision bigint not null default 1,
  add column if not exists reading_edition_key text;

alter table public.guide_editions
  add column if not exists corpus_revision bigint,
  add column if not exists stale boolean not null default false;

create or replace function public.advance_corpus_revision(p_room uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  update public.study_rooms
    set corpus_revision = corpus_revision + 1
    where id = p_room
    returning corpus_revision into v_next;
  if v_next is null then
    return null;
  end if;
  update public.guide_editions
    set stale = true
    where room_id = p_room;
  return v_next;
end $$;

revoke all on function public.advance_corpus_revision(uuid) from public, anon, authenticated;
grant execute on function public.advance_corpus_revision(uuid) to service_role;

create or replace function public.advance_corpus_on_document_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.advance_corpus_revision(old.room_id);
  return old;
end $$;

revoke all on function public.advance_corpus_on_document_delete() from public, anon, authenticated;

drop trigger if exists documents_advance_corpus_delete on public.documents;
create trigger documents_advance_corpus_delete
  before delete on public.documents
  for each row execute function public.advance_corpus_on_document_delete();

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
  perform public.advance_corpus_revision(v_document.room_id);
  return jsonb_build_object('published', true);
end $$;

create or replace function public.publish_guide_edition(
  p_room uuid, p_owner uuid, p_key text, p_content jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_existing jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select content into v_existing from public.guide_editions
    where owner_id = p_owner and edition_key = p_key;
  if found then
    return v_existing;
  end if;
  insert into public.guide_editions(room_id, owner_id, edition_key, content, corpus_revision, stale)
  values (
    p_room,
    p_owner,
    p_key,
    p_content,
    (select corpus_revision from public.study_rooms where id = p_room and owner_id = p_owner),
    false
  );
  update public.study_rooms
    set reading_edition_key = p_key
    where id = p_room and owner_id = p_owner and reading_edition_key is null;
  return p_content;
end $$;

comment on function public.abort_document_revision(uuid, uuid, uuid, text) is
  'Restores the previous usable revision. Does not advance corpus_revision or mark guide editions stale.';
