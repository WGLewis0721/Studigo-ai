-- Durable ingest jobs. The browser can close; the job row remains.
-- Repeated submits with the same operation key reuse the row.

create table if not exists public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  room_id uuid not null,
  owner_id uuid not null,
  operation_key text not null,
  source_revision bigint not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  stage text not null default 'queued' check (stage in ('queued', 'running', 'complete', 'failed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  checkpoint jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, operation_key)
);

alter table public.ingest_jobs enable row level security;

drop policy if exists ingest_jobs_owner_read on public.ingest_jobs;
create policy ingest_jobs_owner_read on public.ingest_jobs
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.ingest_jobs from public, anon;
grant select on public.ingest_jobs to authenticated;
grant all on public.ingest_jobs to service_role;

create or replace function public.enqueue_ingest_job(
  p_document uuid, p_owner uuid, p_operation text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_document public.documents%rowtype;
  v_job public.ingest_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_operation is null or length(trim(p_operation)) = 0 then
    raise exception 'operation key required';
  end if;
  select * into v_document from public.documents
    where id = p_document and owner_id = p_owner;
  if not found then
    raise exception 'Document not found';
  end if;
  select * into v_job from public.ingest_jobs
    where document_id = v_document.id and operation_key = p_operation;
  if found then
    return v_job.id;
  end if;
  insert into public.ingest_jobs(document_id, room_id, owner_id, operation_key, source_revision)
  values (v_document.id, v_document.room_id, v_document.owner_id, p_operation, v_document.active_revision)
  returning * into v_job;
  return v_job.id;
end $$;

revoke all on function public.enqueue_ingest_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_ingest_job(uuid, uuid, text) to service_role;
