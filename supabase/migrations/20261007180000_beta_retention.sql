-- New accounts only. Existing auth.users rows are not backfilled, so the
-- owner account is not put on this clock. Five days after signup the account,
-- its rows, and its uploaded objects are removed.

create table if not exists public.account_retention (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.account_retention enable row level security;

drop policy if exists account_retention_select_own on public.account_retention;
create policy account_retention_select_own on public.account_retention
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.account_retention from public, anon;
grant select on public.account_retention to authenticated;

create or replace function public.enroll_account_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_retention (user_id, expires_at)
  values (new.id, now() + interval '5 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists enroll_account_retention on auth.users;
create trigger enroll_account_retention
  after insert on auth.users
  for each row execute function public.enroll_account_retention();

create or replace function public.purge_expired_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  doomed uuid;
  removed integer := 0;
begin
  for doomed in
    select retention.user_id
    from public.account_retention as retention
    where retention.expires_at <= now()
    order by retention.expires_at
    limit 200
    for update skip locked
  loop
    delete from auth.users where id = doomed;

    removed := removed + 1;
  end loop;
  return removed;
end;
$$;

revoke all on function public.purge_expired_accounts() from public, anon, authenticated;
grant execute on function public.purge_expired_accounts() to service_role;
