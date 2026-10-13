-- Durable ingestion worker lease.
--
-- Ingestion moves off the upload request. A cron-driven worker claims documents
-- with claim_next_document(); the claim carries a lease (claimed_until) so a
-- crashed worker's document becomes claimable again once the lease expires,
-- without a second chunk set: processing always replaces document_chunks for
-- the document, and attempts (max 3) still bounds retries.
-- Software, not a model, owns this state. All functions are service_role only.
--
-- Spend: upload marks a document 'queued' without a budget check, so the worker
-- must not treat status alone as permission to run OCR and embeddings.
-- ingest_requested_at is set only by a route that has already reserved the
-- owner's daily AI budget, and a claim consumes it. One reservation buys one
-- claim; a failed document needs a new request before it is retried.

alter table public.documents add column if not exists claimed_until timestamptz;
alter table public.documents add column if not exists ingest_requested_at timestamptz;

-- Per-document claim (upload/reindex path). Same signature and raise behavior;
-- now also records a 10 minute lease and honors an expired lease as stale.
create or replace function public.claim_document(p_document_id uuid, p_owner_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare claimed uuid;
begin
  update documents set status = 'processing', attempts = attempts + 1,
    processing_started_at = now(), claimed_until = now() + interval '10 minutes',
    ingest_requested_at = null, error_message = null
  where id = p_document_id and owner_id = p_owner_id and attempts < 3
    and (status in ('uploaded', 'queued', 'failed')
      or (status = 'processing' and (
        (claimed_until is null and processing_started_at < now() - interval '10 minutes')
        or claimed_until < now())))
  returning id into claimed;
  if claimed is null and exists(select 1 from documents where id = p_document_id and owner_id = p_owner_id and attempts >= 3) then
    raise exception 'Processing retry limit reached (3 attempts). Upload a corrected file.';
  end if;
  return claimed is not null;
end $$;
revoke all on function public.claim_document(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_document(uuid, uuid) to service_role;

-- Worker claim: atomically leases the oldest requested document, or one whose
-- lease expired. FOR UPDATE SKIP LOCKED means two concurrent workers can never
-- receive the same row.
-- Returns the id and owner so the caller must still scope every later read and
-- write to that owner.
create or replace function public.claim_next_document(p_lease_seconds integer default 600)
returns table(id uuid, owner_id uuid) language plpgsql security invoker set search_path = public as $$
declare picked uuid;
begin
  select d.id into picked from documents d
  where d.attempts < 3
    and ((d.status in ('uploaded', 'queued', 'failed') and d.ingest_requested_at is not null)
      or (d.status = 'processing' and (
        (d.claimed_until is null and d.processing_started_at < now() - interval '10 minutes')
        or d.claimed_until < now())))
  order by d.created_at, d.id
  limit 1
  for update skip locked;
  if picked is null then return; end if;
  return query
    update documents u set status = 'processing', attempts = u.attempts + 1,
      processing_started_at = now(),
      claimed_until = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 600), 1)),
      ingest_requested_at = null, error_message = null
    where u.id = picked
    returning u.id, u.owner_id;
end $$;
revoke all on function public.claim_next_document(integer) from public, anon, authenticated;
grant execute on function public.claim_next_document(integer) to service_role;

-- Heartbeat for long documents: pushes the lease out while still processing.
create or replace function public.extend_document_lease(p_document_id uuid, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = public as $$
declare extended uuid;
begin
  update documents set claimed_until = now() + make_interval(secs => greatest(coalesce(p_seconds, 600), 1))
  where id = p_document_id and status = 'processing'
  returning id into extended;
  return extended is not null;
end $$;
revoke all on function public.extend_document_lease(uuid, integer) from public, anon, authenticated;
grant execute on function public.extend_document_lease(uuid, integer) to service_role;
