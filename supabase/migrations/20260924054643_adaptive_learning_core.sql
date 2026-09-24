-- Only observations with no existing authoritative attempt record live here.
-- Quiz, practice-test and card evidence continues to live in quiz_attempts.
create table public.learning_events (
  id text not null check (length(id) between 1 and 200),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null,
  topic_id uuid not null,
  encounter_id text not null check (length(encounter_id) between 1 and 200),
  activity text not null check (activity in ('learn','coach','weak_area','cram')),
  challenge_kind text not null check (challenge_kind in ('recognize','recall','explain','compare','predict','apply','transfer','novel_problem','defend','teach_back')),
  result text not null check (result in ('correct','partial','incorrect','skipped','revealed','help')),
  scaffold_used smallint check (scaffold_used between 0 and 5),
  evidence text not null check (evidence in ('assessed','self_reported')),
  context_id text check (length(context_id) between 1 and 200),
  new_context boolean not null default false,
  misconception_id text check (length(misconception_id) between 1 and 200),
  created_at timestamptz not null check (isfinite(created_at)),
  primary key (owner_id, id),
  foreign key (room_id, owner_id) references public.study_rooms(id,owner_id) on delete cascade,
  foreign key (topic_id, room_id, owner_id) references public.topics(id,room_id,owner_id) on delete cascade,
  check (not new_context or context_id is not null)
);
create index learning_events_concept on public.learning_events(owner_id,room_id,topic_id,created_at,id);
alter table public.learning_events enable row level security;
create policy learning_events_read_own on public.learning_events for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.learning_events from public, anon, authenticated, service_role;
grant select on public.learning_events to authenticated;
grant select, insert on public.learning_events to service_role;

-- Trusted, server-graded observations only. Browser cannot claim correctness or
-- independently evaluated transfer. No second projection needs updating.
create function public.record_learning_event(p_event jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare incoming learning_events; saved learning_events;
begin
  incoming := jsonb_populate_record(null::learning_events, p_event);
  perform 1 from study_rooms where id=incoming.room_id and owner_id=incoming.owner_id for update;
  if not found then raise exception 'Learning room not found'; end if;
  perform 1 from topics where id=incoming.topic_id and room_id=incoming.room_id
    and owner_id=incoming.owner_id and active for share;
  if not found then raise exception 'Concept is not in active study scope'; end if;
  insert into learning_events select incoming.* on conflict (owner_id,id) do nothing;
  select * into saved from learning_events where owner_id=incoming.owner_id and id=incoming.id;
  if to_jsonb(saved) is distinct from to_jsonb(incoming) then
    raise exception 'Conflicting learning interaction ID';
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function public.record_learning_event(jsonb) from public,anon,authenticated;
grant execute on function public.record_learning_event(jsonb) to service_role;

-- One snapshot, one concept. Scalar JSON avoids PostgREST row-limit truncation.
-- No answer keys, prompts, responses, or feedback are returned. INVOKER keeps
-- both sources under RLS. The explicit owner predicate also fails closed when
-- accidentally called with a service client lacking an end-user JWT.
create function public.read_concept_learning_history(p_room_id uuid,p_topic_id uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'observations', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id)
      from learning_events e where e.room_id=p_room_id and e.topic_id=p_topic_id and e.owner_id=auth.uid()),'[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'owner_id',a.owner_id,'room_id',a.room_id,'topic_id',a.topic_id,
      'source',a.source,'score',a.score,'is_correct',a.is_correct,'created_at',a.created_at,
      'question_id',a.question_id,'question_kind',q.kind,'practice_test_id',q.practice_test_id
    ) order by a.created_at,a.id)
      from quiz_attempts a left join quiz_questions q on q.id=a.question_id
      where a.room_id=p_room_id and a.topic_id=p_topic_id and a.owner_id=auth.uid()),'[]'::jsonb)
  );
$$;
revoke all on function public.read_concept_learning_history(uuid,uuid) from public,anon,service_role;
grant execute on function public.read_concept_learning_history(uuid,uuid) to authenticated;
