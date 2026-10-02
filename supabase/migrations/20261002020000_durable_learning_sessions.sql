-- Additive durable session boundary; disable STUDIGO_DURABLE_SESSIONS to roll back routes.
create table public.learning_sessions (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  schema_version integer not null default 1 check(schema_version=1),
  revision bigint not null default 0 check(revision>=0),
  mode text not null check(mode in ('study','cram')), minutes integer not null check(minutes in (15,30,60,120)),
  selected_topic_id uuid references public.topics(id) on delete set null,
  plan jsonb not null check(jsonb_typeof(plan)='object'),
  ended boolean not null default false,
  started_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(id,owner_id),
  foreign key(room_id,owner_id) references public.study_rooms(id,owner_id) on delete cascade
);
create table public.learning_session_receipts (
  id uuid primary key, session_id uuid not null references public.learning_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  fingerprint jsonb not null, snapshot jsonb not null, created_at timestamptz not null default clock_timestamp(),
  foreign key(session_id,owner_id) references public.learning_sessions(id,owner_id) on delete cascade
);
alter table public.learning_sessions enable row level security;
alter table public.learning_session_receipts enable row level security;
create policy learning_session_owner on public.learning_sessions for select to authenticated using(owner_id=auth.uid());
revoke all on public.learning_sessions,public.learning_session_receipts from anon,authenticated;
grant select on public.learning_sessions to authenticated;
grant all on public.learning_sessions,public.learning_session_receipts to service_role;

-- Scope must still be eligible at transaction commit, including source deletion races.
create function public.session_topic_eligible(p_owner uuid,p_room uuid,p_topic uuid) returns boolean
language sql stable security invoker set search_path=public as $$
 select exists(select 1 from topics t join document_chunks c on c.room_id=t.room_id and c.owner_id=t.owner_id
 join documents d on d.id=c.document_id and d.room_id=t.room_id and d.owner_id=t.owner_id
 where t.id=p_topic and t.owner_id=p_owner and t.room_id=p_room and t.active and d.status='ready'
 and c.content ~ '[^[:space:]]'
 and (coalesce(cardinality(t.source_document_ids),0)=0 or c.document_id=any(t.source_document_ids)))
$$;
create function public.read_learning_session(p_owner uuid,p_room uuid,p_id uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare s learning_sessions%rowtype;
begin
 if not exists(select 1 from study_rooms where id=p_room and owner_id=p_owner) then raise exception 'Session ownership mismatch' using errcode='42501'; end if;
 select * into s from learning_sessions where id=p_id and room_id=p_room and owner_id=p_owner;
 return jsonb_build_object('session',case when s.id is null then null else to_jsonb(s) end,'now',clock_timestamp());
end $$;
create function public.commit_learning_session(p_owner uuid,p_room uuid,p_id uuid,p_request uuid,p_expected bigint,
 p_action text,p_mode text,p_minutes integer,p_selected uuid,p_plan jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare s learning_sessions%rowtype; receipt learning_session_receipts%rowtype; fp jsonb; result jsonb; actual bigint;
begin
 if not exists(select 1 from study_rooms where id=p_room and owner_id=p_owner) then raise exception 'Session ownership mismatch' using errcode='42501'; end if;
 if p_action is null or p_action not in ('start','recommend','select','end') or p_expected is null or p_expected<0
 or p_mode is null or p_minutes is null or p_mode not in ('study','cram') or p_minutes not in (15,30,60,120) or p_plan is null
 or p_plan->>'schemaVersion' is distinct from '1' or p_plan->>'policyVersion' is distinct from 'session-1'
 or p_plan->>'mode' is distinct from p_mode or p_plan->>'budgetMinutes' is distinct from p_minutes::text
 or p_plan->>'status' is null or p_plan->>'status' not in ('ready','pending','complete','empty')
 then raise exception 'Invalid session operation' using errcode='22023'; end if;
 fp=jsonb_build_object('owner',p_owner,'room',p_room,'session',p_id,'revision',p_expected,'action',p_action,'mode',p_mode,'minutes',p_minutes,'selected',p_selected);
 -- Session-ID lock serializes creation and all actions. Receipt-ID lock handles cross-session reuse.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 417));
 perform pg_advisory_xact_lock(hashtextextended(p_request::text, 418));
 select * into receipt from learning_session_receipts where id=p_request;
 if found then
   if receipt.owner_id<>p_owner or receipt.fingerprint<>fp then raise exception 'Session request conflict' using errcode='40001'; end if;
   return receipt.snapshot;
 end if;
 select * into s from learning_sessions where id=p_id for update;
 if found and (s.owner_id<>p_owner or s.room_id<>p_room) then raise exception 'Session ownership mismatch' using errcode='42501'; end if;
 if p_action='start' then
   if s.id is not null or p_expected<>0 then raise exception 'Session already exists' using errcode='40001'; end if;
 else
   if s.id is null then raise exception 'Session not found' using errcode='P0002'; end if;
   if s.revision<>p_expected or s.ended or s.mode<>p_mode or s.minutes<>p_minutes then raise exception 'Stale session revision' using errcode='40001'; end if;
 end if;
 -- Serialize with every canonical Coach/Quiz/card/test writer before checking the projection.
 perform 1 from study_rooms where id=p_room and owner_id=p_owner for update;
 -- Hold source rows against concurrent deletion/status/content edits until commit.
 perform 1 from topics t join document_chunks c on c.room_id=t.room_id and c.owner_id=t.owner_id
 join documents d on d.id=c.document_id and d.room_id=t.room_id and d.owner_id=t.owner_id
 where t.id in (p_selected,(p_plan->>'topicId')::uuid) and t.owner_id=p_owner and t.room_id=p_room
 and t.active and d.status='ready' and c.content ~ '[^[:space:]]'
 and (coalesce(cardinality(t.source_document_ids),0)=0 or c.document_id=any(t.source_document_ids))
 for share of t,c,d;
 if p_selected is not null and not session_topic_eligible(p_owner,p_room,p_selected) then raise exception 'Selected topic unavailable' using errcode='22023'; end if;
 if p_plan->>'topicId' is not null and not session_topic_eligible(p_owner,p_room,(p_plan->>'topicId')::uuid) then raise exception 'Plan topic unavailable' using errcode='22023'; end if;
 if p_plan->>'topicId' is not null then
   select (select count(*) from learning_events where owner_id=p_owner and room_id=p_room and topic_id=(p_plan->>'topicId')::uuid)
     +(select count(*) from quiz_attempts where owner_id=p_owner and room_id=p_room and topic_id=(p_plan->>'topicId')::uuid) into actual;
   if p_plan->>'stateRevision' is null or actual<>(p_plan->>'stateRevision')::bigint then raise exception 'Stale session concept revision' using errcode='40001'; end if;
 end if;
 if p_action='start' then
   insert into learning_sessions(id,owner_id,room_id,mode,minutes,selected_topic_id,plan)
   values(p_id,p_owner,p_room,p_mode,p_minutes,p_selected,p_plan) returning * into s;
 else
   update learning_sessions set revision=revision+1,selected_topic_id=case when p_action='select' then p_selected else selected_topic_id end,plan=p_plan,ended=p_action='end',updated_at=clock_timestamp()
   where id=p_id returning * into s;
 end if;
 result=to_jsonb(s);
 insert into learning_session_receipts(id,session_id,owner_id,fingerprint,snapshot) values(p_request,p_id,p_owner,fp,result);
 return result;
end $$;
revoke all on function public.session_topic_eligible(uuid,uuid,uuid),public.read_learning_session(uuid,uuid,uuid),public.commit_learning_session(uuid,uuid,uuid,uuid,bigint,text,text,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.session_topic_eligible(uuid,uuid,uuid),public.read_learning_session(uuid,uuid,uuid),public.commit_learning_session(uuid,uuid,uuid,uuid,bigint,text,text,integer,uuid,jsonb) to service_role;
-- User-scoped usable source IDs only; no chunk text or privileged key reaches clients.
create function public.read_session_source_scope(p_room uuid) returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from (
   select d.id from documents d where d.room_id=p_room and d.owner_id=auth.uid() and d.status='ready'
   and exists(select 1 from study_rooms r where r.id=p_room and r.owner_id=auth.uid())
   and exists(select 1 from document_chunks c where c.document_id=d.id and c.room_id=d.room_id
     and c.owner_id=d.owner_id and c.content ~ '[^[:space:]]')
 ) usable
$$;
revoke all on function public.read_session_source_scope(uuid) from public,anon;
grant execute on function public.read_session_source_scope(uuid) to authenticated;
