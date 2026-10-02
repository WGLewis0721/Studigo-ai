-- Expand only. Existing history, readers and writers remain available for rollback.
alter table public.conversations add column learning_revision bigint not null default 0 check(learning_revision>=0);
create table public.learner_concept_projections (
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  revision bigint not null check(revision>=0),
  projection jsonb not null check(jsonb_typeof(projection)='object'),
  updated_at timestamptz not null default now(),
  primary key(owner_id,room_id,topic_id)
);
alter table public.learner_concept_projections enable row level security;
create policy learner_projection_owner on public.learner_concept_projections for select to authenticated using(owner_id=auth.uid());
revoke all on public.learner_concept_projections from anon,authenticated;
grant select on public.learner_concept_projections to authenticated;
grant all on public.learner_concept_projections to service_role;
create table public.adaptive_encounters (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  issued_state jsonb not null check(jsonb_typeof(issued_state)='object'),
  created_at timestamptz not null default now()
);
create table public.adaptive_semantic_evidence (
  interaction_id uuid primary key references public.messages(id) on delete cascade,
  encounter_id text not null references public.adaptive_encounters(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  fingerprint jsonb not null check(jsonb_typeof(fingerprint)='object'),
  evaluation jsonb not null check(jsonb_typeof(evaluation)='object'),
  evaluator_version text not null,
  created_at timestamptz not null default now()
);
create table public.adaptive_turn_receipts (
  interaction_id uuid primary key references public.messages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  request_fingerprint jsonb not null,
  committed_state jsonb not null,
  revision bigint not null,
  created_at timestamptz not null default now()
);
alter table public.adaptive_encounters enable row level security;
alter table public.adaptive_semantic_evidence enable row level security;
alter table public.adaptive_turn_receipts enable row level security;
create policy adaptive_encounter_owner on public.adaptive_encounters for select to authenticated using(owner_id=auth.uid());
create policy adaptive_semantic_owner on public.adaptive_semantic_evidence for select to authenticated using(owner_id=auth.uid());
create policy adaptive_receipt_owner on public.adaptive_turn_receipts for select to authenticated using(owner_id=auth.uid());
revoke all on public.adaptive_encounters,public.adaptive_semantic_evidence,public.adaptive_turn_receipts from anon,authenticated;
-- Encounter snapshots and receipts contain grading rubrics: never expose them directly.
grant select(interaction_id,owner_id,evaluation) on public.adaptive_semantic_evidence to authenticated;
grant all on public.adaptive_encounters,public.adaptive_semantic_evidence,public.adaptive_turn_receipts to service_role;

create function public.accept_adaptive_semantic_evidence(p_interaction_id uuid,p_encounter_id text,p_owner_id uuid,p_fingerprint jsonb,p_evaluation jsonb,p_evaluator_version text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare prior adaptive_semantic_evidence%rowtype;
begin
  if not exists(select 1 from adaptive_encounters e join messages m on m.conversation_id=e.conversation_id
    where e.id=p_encounter_id and e.owner_id=p_owner_id and m.id=p_interaction_id and m.role='user') then
    raise exception 'Semantic evidence scope mismatch';
  end if;
  insert into adaptive_semantic_evidence(interaction_id,encounter_id,owner_id,fingerprint,evaluation,evaluator_version)
    values(p_interaction_id,p_encounter_id,p_owner_id,p_fingerprint,p_evaluation,p_evaluator_version) on conflict(interaction_id) do nothing;
  select * into prior from adaptive_semantic_evidence where interaction_id=p_interaction_id;
  if prior.encounter_id<>p_encounter_id or prior.owner_id<>p_owner_id or prior.fingerprint<>p_fingerprint then raise exception 'Conflicting semantic retry';end if;
  return prior.evaluation;
end $$;
revoke all on function public.accept_adaptive_semantic_evidence(uuid,text,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.accept_adaptive_semantic_evidence(uuid,text,uuid,jsonb,jsonb,text) to service_role;

create function public.commit_adaptive_coach_turn(p_conversation_id uuid,p_owner_id uuid,p_interaction_id uuid,p_expected_revision bigint,p_state jsonb,p_events jsonb,p_projections jsonb default '[]'::jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c conversations%rowtype; prior adaptive_turn_receipts%rowtype; message messages%rowtype; e jsonb; issued jsonb; encounter adaptive_encounters%rowtype; result jsonb; fingerprint jsonb; p jsonb; actual bigint;
begin
  select * into c from conversations where id=p_conversation_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Conversation ownership mismatch';end if;
  select * into message from messages where id=p_interaction_id and conversation_id=c.id and role='user';
  if not found then raise exception 'Trusted interaction required';end if;
  fingerprint=jsonb_build_object('message',message.content,'conversation',c.id,'expectedRevision',p_expected_revision,'events',p_events);
  select * into prior from adaptive_turn_receipts where interaction_id=p_interaction_id;
  if found then
    if prior.owner_id<>p_owner_id or prior.conversation_id<>c.id or prior.request_fingerprint<>fingerprint or prior.committed_state<>p_state then raise exception 'Conflicting turn retry';end if;
    return jsonb_build_object('revision',prior.revision,'state',prior.committed_state,'duplicate',true);
  end if;
  if c.learning_revision<>p_expected_revision then raise exception 'Stale Coach revision' using errcode='40001';end if;
  perform 1 from study_rooms where id=c.room_id and owner_id=p_owner_id for update;
  if jsonb_typeof(p_state) is distinct from 'object' or (p_state->>'version')::int is distinct from 1 or coalesce(p_state->>'kind','') not in ('idle','awaiting_answer','awaiting_control')
    or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>8 then raise exception 'Invalid turn contract';end if;
  issued=p_state->'issuedChallenge';
  if p_state->>'kind'='awaiting_answer' and issued is not null then
    if not exists(select 1 from topics where id=(p_state->>'topicId')::uuid and room_id=c.room_id and owner_id=p_owner_id and active) then raise exception 'Issued topic scope mismatch';end if;
    if issued->'spec'->'concept'->>'userId' is distinct from p_owner_id::text or issued->'spec'->'concept'->>'roomId' is distinct from c.room_id::text
      or issued->'spec'->'concept'->>'topicId' is distinct from p_state->>'topicId' then raise exception 'Issued spec scope mismatch';end if;
    insert into adaptive_encounters(id,owner_id,room_id,topic_id,conversation_id,issued_state)
      values(issued->>'encounterId',p_owner_id,c.room_id,(p_state->>'topicId')::uuid,c.id,p_state) on conflict(id) do nothing;
    select * into encounter from adaptive_encounters where id=issued->>'encounterId';
    if encounter.owner_id<>p_owner_id or encounter.conversation_id<>c.id or encounter.issued_state->'issuedChallenge'->'spec'<>issued->'spec' then raise exception 'Conflicting encounter reuse';end if;
  end if;
  for p in select value from jsonb_array_elements(p_projections) loop
    if not exists(select 1 from topics where id=(p->>'topic_id')::uuid and room_id=c.room_id and owner_id=p_owner_id and active)
      or p->'projection'->'state'->>'userId' is distinct from p_owner_id::text
      or p->'projection'->'state'->>'roomId' is distinct from c.room_id::text
      or p->'projection'->'state'->>'topicId' is distinct from p->>'topic_id' then raise exception 'Projection scope mismatch';end if;
    select (select count(*) from learning_events where owner_id=p_owner_id and room_id=c.room_id and topic_id=(p->>'topic_id')::uuid)
      +(select count(*) from quiz_attempts where owner_id=p_owner_id and room_id=c.room_id and topic_id=(p->>'topic_id')::uuid) into actual;
    if actual<>(p->>'expected_revision')::bigint then raise exception 'Stale concept revision' using errcode='40001';end if;
  end loop;
  for e in select value from jsonb_array_elements(p_events) loop
    if e->>'owner_id'<>p_owner_id::text or e->>'room_id'<>c.room_id::text
      or not exists(select 1 from adaptive_encounters where id=e->>'encounter_id' and owner_id=p_owner_id and conversation_id=c.id and topic_id=(e->>'topic_id')::uuid) then
      raise exception 'Event encounter scope mismatch';
    end if;
    perform public.record_learning_event(e);
  end loop;
  for p in select value from jsonb_array_elements(p_projections) loop
    insert into learner_concept_projections(owner_id,room_id,topic_id,revision,projection)
      values(p_owner_id,c.room_id,(p->>'topic_id')::uuid,(p->'projection'->>'revision')::bigint,p->'projection')
      on conflict(owner_id,room_id,topic_id) do update set revision=excluded.revision,projection=excluded.projection,updated_at=now();
  end loop;
  update conversations set coach_state=p_state,learning_revision=learning_revision+1 where id=c.id returning learning_revision into c.learning_revision;
  insert into adaptive_turn_receipts(interaction_id,owner_id,conversation_id,request_fingerprint,committed_state,revision)
    values(p_interaction_id,p_owner_id,c.id,fingerprint,p_state,c.learning_revision);
  return jsonb_build_object('revision',c.learning_revision,'state',p_state,'duplicate',false);
end $$;
revoke all on function public.commit_adaptive_coach_turn(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_adaptive_coach_turn(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb) to service_role;
