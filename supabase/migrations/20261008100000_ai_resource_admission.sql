-- Studigo AI admission: one atomic Postgres authority across Vercel workers.
-- Additive only. No existing learning or billing state is modified.
-- All RPCs require the Supabase service-role JWT; browser accounts cannot mint quotas.
create table if not exists public.studigo_ai_guard_state (
  id boolean primary key default true check (id),
  paused boolean not null default false,
  reason text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.studigo_ai_guard_state (id) values (true) on conflict do nothing;

create table if not exists public.studigo_ai_guard_windows (
  scope text not null check (scope in ('user_minute', 'ip_minute', 'global_minute', 'user_day', 'global_day')),
  scope_key text not null,
  window_start timestamptz not null,
  requests integer not null default 0 check (requests >= 0),
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  primary key (scope, scope_key, window_start)
);
create table if not exists public.studigo_ai_guard_leases (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text not null check (length(ip_hash) = 64),
  operation text not null,
  request_key text not null,
  reserved_micro_usd bigint not null check (reserved_micro_usd > 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique (owner_id, operation, request_key)
);
create index if not exists studigo_ai_guard_active_idx
  on public.studigo_ai_guard_leases (expires_at)
  where completed_at is null;

alter table public.studigo_ai_guard_state enable row level security;
alter table public.studigo_ai_guard_windows enable row level security;
alter table public.studigo_ai_guard_leases enable row level security;
revoke all on public.studigo_ai_guard_state from public, anon, authenticated;
revoke all on public.studigo_ai_guard_windows from public, anon, authenticated;
revoke all on public.studigo_ai_guard_leases from public, anon, authenticated;

create or replace function public.admit_studigo_ai_resource(
  p_lease_id uuid,
  p_owner_id uuid,
  p_ip_hash text,
  p_operation text,
  p_request_key text,
  p_reserved_micro_usd bigint,
  p_user_minute integer,
  p_ip_minute integer,
  p_global_minute integer,
  p_user_concurrent integer,
  p_ip_concurrent integer,
  p_global_concurrent integer,
  p_user_daily_micro_usd bigint,
  p_global_daily_micro_usd bigint
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_minute timestamptz := date_trunc('minute', now());
  v_day timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_user text := p_owner_id::text;
  v_calls integer;
  v_reserved bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_lease_id is null or p_owner_id is null or
     p_ip_hash !~ '^[0-9a-f]{64}$' or
     length(coalesce(p_operation, '')) not between 1 and 64 or
     length(coalesce(p_request_key, '')) not between 1 and 80 or
     p_reserved_micro_usd is null or p_reserved_micro_usd <= 0 or
     (p_user_minute is null or p_ip_minute is null or p_global_minute is null or
      p_user_concurrent is null or p_ip_concurrent is null or p_global_concurrent is null or
      p_user_daily_micro_usd is null or p_global_daily_micro_usd is null or
      least(p_user_minute,p_ip_minute,p_global_minute,p_user_concurrent,
            p_ip_concurrent,p_global_concurrent,p_user_daily_micro_usd,
            p_global_daily_micro_usd) <= 0) then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;

  -- Serialize decisions globally at beta scale; no check-then-insert race.
  perform pg_advisory_xact_lock(731101, 1);
  if (select paused from public.studigo_ai_guard_state where id = true) is distinct from false then
    return jsonb_build_object('allowed', false, 'reason', 'paused');
  end if;
  if exists (
    select 1 from public.studigo_ai_guard_leases
    where owner_id=p_owner_id and operation=p_operation and request_key=p_request_key
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'duplicate');
  end if;

  if (select count(*) from public.studigo_ai_guard_leases
      where owner_id=p_owner_id and completed_at is null and expires_at>v_now) >= p_user_concurrent or
     (select count(*) from public.studigo_ai_guard_leases
      where ip_hash=p_ip_hash and completed_at is null and expires_at>v_now) >= p_ip_concurrent or
     (select count(*) from public.studigo_ai_guard_leases
      where completed_at is null and expires_at>v_now) >= p_global_concurrent then
    return jsonb_build_object('allowed', false, 'reason', 'concurrent');
  end if;

  select coalesce((select requests from public.studigo_ai_guard_windows
    where scope='user_minute' and scope_key=v_user and window_start=v_minute),0) into v_calls;
  if v_calls >= p_user_minute then return jsonb_build_object('allowed',false,'reason','rate'); end if;
  select coalesce((select requests from public.studigo_ai_guard_windows
    where scope='ip_minute' and scope_key=p_ip_hash and window_start=v_minute),0) into v_calls;
  if v_calls >= p_ip_minute then return jsonb_build_object('allowed',false,'reason','rate'); end if;
  select coalesce((select requests from public.studigo_ai_guard_windows
    where scope='global_minute' and scope_key='all' and window_start=v_minute),0) into v_calls;
  if v_calls >= p_global_minute then return jsonb_build_object('allowed',false,'reason','rate'); end if;

  select coalesce((select reserved_micro_usd from public.studigo_ai_guard_windows
    where scope='user_day' and scope_key=v_user and window_start=v_day),0) into v_reserved;
  if v_reserved + p_reserved_micro_usd > p_user_daily_micro_usd then
    return jsonb_build_object('allowed',false,'reason','user_budget');
  end if;
  select coalesce((select reserved_micro_usd from public.studigo_ai_guard_windows
    where scope='global_day' and scope_key='all' and window_start=v_day),0) into v_reserved;
  if v_reserved + p_reserved_micro_usd > p_global_daily_micro_usd then
    return jsonb_build_object('allowed',false,'reason','global_budget');
  end if;

  insert into public.studigo_ai_guard_windows(scope,scope_key,window_start,requests)
  values ('user_minute',v_user,v_minute,1),('ip_minute',p_ip_hash,v_minute,1),
         ('global_minute','all',v_minute,1)
  on conflict (scope,scope_key,window_start) do update
  set requests=public.studigo_ai_guard_windows.requests+1;

  insert into public.studigo_ai_guard_windows(scope,scope_key,window_start,reserved_micro_usd)
  values ('user_day',v_user,v_day,p_reserved_micro_usd),
         ('global_day','all',v_day,p_reserved_micro_usd)
  on conflict (scope,scope_key,window_start) do update
  set reserved_micro_usd=public.studigo_ai_guard_windows.reserved_micro_usd+excluded.reserved_micro_usd;

  insert into public.studigo_ai_guard_leases
    (id,owner_id,ip_hash,operation,request_key,reserved_micro_usd,expires_at)
  values (p_lease_id,p_owner_id,p_ip_hash,p_operation,p_request_key,p_reserved_micro_usd,v_now+interval '6 minutes');

  return jsonb_build_object('allowed',true,'lease_id',p_lease_id);
end;
$$;

create or replace function public.finish_studigo_ai_resource(p_lease_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.studigo_ai_guard_leases
    set completed_at=now()
  where id=p_lease_id and completed_at is null;
  return found;
end;
$$;

revoke all on function public.admit_studigo_ai_resource(
  uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,bigint,bigint
) from public, anon, authenticated;
revoke all on function public.finish_studigo_ai_resource(uuid) from public, anon, authenticated;
grant execute on function public.admit_studigo_ai_resource(
  uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,bigint,bigint
) to service_role;
grant execute on function public.finish_studigo_ai_resource(uuid) to service_role;

-- Atomically establish processing ownership and the manual cooldown in the
-- same row lock. A second connection cannot reset a worker's claim.
create or replace function public.claim_forced_studigo_reindex(
  p_document_id uuid, p_owner_id uuid, p_cooldown_seconds integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_document public.documents%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_document_id is null or p_owner_id is null or
     p_cooldown_seconds is null or p_cooldown_seconds < 900 or p_cooldown_seconds > 86400 then
    return jsonb_build_object('claimed',false,'reason','invalid');
  end if;
  select * into v_document from public.documents
    where id = p_document_id and owner_id = p_owner_id and source_type = 'study_guide'
    for update;
  if not found then return jsonb_build_object('claimed',false,'reason','not_found'); end if;
  if v_document.status = 'processing' then
    return jsonb_build_object('claimed',false,'reason','processing');
  end if;
  if v_document.last_forced_reindex_at is not null and
     v_document.last_forced_reindex_at > v_now - make_interval(secs => p_cooldown_seconds) then
    return jsonb_build_object('claimed',false,'reason','cooldown');
  end if;
  update public.documents set
    status = 'processing', attempts = 1,
    processing_started_at = v_now, processed_at = null,
    error_message = null, last_forced_reindex_at = v_now
  where id = v_document.id;
  return jsonb_build_object('claimed',true);
end $$;
revoke all on function public.claim_forced_studigo_reindex(uuid,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.claim_forced_studigo_reindex(uuid,uuid,integer)
  to service_role;
