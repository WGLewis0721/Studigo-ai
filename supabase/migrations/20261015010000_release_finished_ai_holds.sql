-- A finished or expired call must not consume the rest of the day.
-- The daily cap counts reservations that are still in flight.
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
  v_user text := p_owner_id::text;
  v_calls integer;
  v_reserved bigint;
  v_prior public.studigo_ai_guard_leases%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_lease_id is null or p_owner_id is null or p_ip_hash is null or
     p_operation is null or p_request_key is null or
     p_ip_hash !~ '^[0-9a-f]{64}$' or
     length(p_operation) not between 1 and 64 or
     length(p_request_key) not between 1 and 80 or
     p_reserved_micro_usd is null or p_reserved_micro_usd <= 0 or
     p_reserved_micro_usd > 1000000000 or
     (p_user_minute is null or p_ip_minute is null or p_global_minute is null or
      p_user_concurrent is null or p_ip_concurrent is null or p_global_concurrent is null or
      p_user_daily_micro_usd is null or p_global_daily_micro_usd is null or
      least(p_user_minute,p_ip_minute,p_global_minute,p_user_concurrent,
            p_ip_concurrent,p_global_concurrent,p_user_daily_micro_usd,
            p_global_daily_micro_usd) <= 0) then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;

  if not pg_try_advisory_xact_lock(731101, 1) then
    return jsonb_build_object('allowed',false,'reason','busy');
  end if;
  delete from public.studigo_ai_guard_windows
  where ctid in (
    select ctid from public.studigo_ai_guard_windows
    where (scope like '%minute' and window_start < v_now - interval '2 hours')
       or (scope like '%day' and window_start < v_now - interval '2 days')
    limit 128
  );
  delete from public.studigo_ai_guard_leases
  where id in (
    select id from public.studigo_ai_guard_leases
    where (completed_at is not null and completed_at < v_now - interval '30 days')
       or (completed_at is null and expires_at < v_now - interval '30 days')
    limit 128
  );
  update public.studigo_ai_guard_receipts r set state='ambiguous', updated_at=v_now
  where (r.owner_id,r.operation,r.request_key) in (
    select s.owner_id,s.operation,s.request_key
    from public.studigo_ai_guard_receipts s
    join public.studigo_ai_guard_leases l
      on l.owner_id=s.owner_id and l.operation=s.operation and l.request_key=s.request_key
    where s.state='running'
      and ((l.completed_at is null and l.expires_at < v_now)
        or (l.completed_at is not null and l.completed_at < v_now - interval '5 minutes'))
    limit 128
  );
  delete from public.studigo_ai_guard_receipts
  where (owner_id,operation,request_key) in (
    select owner_id,operation,request_key from public.studigo_ai_guard_receipts
    where state='claimed' and updated_at < v_now - interval '1 hour'
    order by updated_at limit 128
  );
  delete from public.studigo_ai_guard_receipts
  where (owner_id,operation,request_key) in (
    select owner_id,operation,request_key from public.studigo_ai_guard_receipts
    where updated_at < v_now - interval '30 days'
    order by updated_at limit 128
  );
  if (select paused from public.studigo_ai_guard_state where id = true) is distinct from false then
    return jsonb_build_object('allowed', false, 'reason', 'paused');
  end if;
  select * into v_prior from public.studigo_ai_guard_leases
    where owner_id=p_owner_id and operation=p_operation and request_key=p_request_key;
  if found then
    if (v_prior.completed_at is null and v_prior.expires_at > v_now) or not exists (
      select 1 from public.studigo_ai_guard_receipts r
      where r.owner_id=p_owner_id and r.operation=p_operation and r.request_key=p_request_key
        and r.state='claimed' and r.provider_started_at is null
    ) then
      return jsonb_build_object('allowed', false, 'reason', 'duplicate');
    end if;
    delete from public.studigo_ai_guard_leases where id = v_prior.id;
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

  select coalesce(sum(reserved_micro_usd),0) into v_reserved
  from public.studigo_ai_guard_leases
  where owner_id=p_owner_id and completed_at is null and expires_at>v_now;
  if v_reserved + p_reserved_micro_usd > p_user_daily_micro_usd then
    return jsonb_build_object('allowed',false,'reason','user_budget');
  end if;
  select coalesce(sum(reserved_micro_usd),0) into v_reserved
  from public.studigo_ai_guard_leases
  where completed_at is null and expires_at>v_now;
  if v_reserved + p_reserved_micro_usd > p_global_daily_micro_usd then
    return jsonb_build_object('allowed',false,'reason','global_budget');
  end if;

  insert into public.studigo_ai_guard_windows(scope,scope_key,window_start,requests)
  values ('user_minute',v_user,v_minute,1),('ip_minute',p_ip_hash,v_minute,1),
         ('global_minute','all',v_minute,1)
  on conflict (scope,scope_key,window_start) do update
  set requests=public.studigo_ai_guard_windows.requests+1;

  insert into public.studigo_ai_guard_leases
    (id,owner_id,ip_hash,operation,request_key,reserved_micro_usd,expires_at)
  values (p_lease_id,p_owner_id,p_ip_hash,p_operation,p_request_key,p_reserved_micro_usd,v_now+interval '10 minutes');

  return jsonb_build_object('allowed',true,'lease_id',p_lease_id);
end;
$$;

-- Drop the tally that already blocked testing. It is no longer read.
update public.studigo_ai_guard_windows
set reserved_micro_usd = 0
where scope in ('user_day', 'global_day')
  and window_start >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
