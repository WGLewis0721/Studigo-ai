-- Additive product layer on the existing topics, question bank and attempts.
create table public.practice_tests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null, owner_id uuid not null,
  title text not null default 'Practice test',
  status text not null default 'draft' check(status in ('draft','submitted')),
  topic_snapshot jsonb not null default '[]',
  draft_answers jsonb not null default '{}',
  result jsonb,
  created_at timestamptz not null default now(), submitted_at timestamptz,
  constraint tests_room_owner foreign key(room_id,owner_id) references public.study_rooms(id,owner_id) on delete cascade,
  unique(id,room_id,owner_id)
);
alter table public.practice_tests enable row level security;
revoke all on public.practice_tests from anon, authenticated;
grant select on public.practice_tests to authenticated;
grant all on public.practice_tests to service_role;
create policy tests_read_own on public.practice_tests for select to authenticated using(owner_id=auth.uid());
create index tests_room_created on public.practice_tests(room_id,created_at desc);

alter table public.quiz_questions add column practice_test_id uuid,
  add column test_position integer;
alter table public.quiz_questions add constraint questions_test_scope foreign key(practice_test_id,room_id,owner_id)
  references public.practice_tests(id,room_id,owner_id) on delete cascade;
grant select(practice_test_id,test_position) on public.quiz_questions to authenticated;
create unique index test_question_position on public.quiz_questions(practice_test_id,test_position) where practice_test_id is not null;

create table public.study_plan_events (
  room_id uuid not null, owner_id uuid not null,
  plan_day date not null, action_key text not null check(length(action_key) between 1 and 180),
  status text not null check(status in ('completed','skipped')),
  updated_at timestamptz not null default now(),
  primary key(room_id,plan_day,action_key),
  foreign key(room_id,owner_id) references public.study_rooms(id,owner_id) on delete cascade
);
alter table public.study_plan_events enable row level security;
revoke all on public.study_plan_events from anon, authenticated;
grant select,insert,update on public.study_plan_events to authenticated;
grant all on public.study_plan_events to service_role;
create policy plan_events_own on public.study_plan_events for all to authenticated
  using(owner_id=auth.uid()) with check(owner_id=auth.uid() and exists(select 1 from public.study_rooms r where r.id=room_id and r.owner_id=auth.uid()));
-- These events track intentions only. They never write scores or mastery.

create function public.create_practice_test(p_room_id uuid,p_owner_id uuid,p_topics jsonb,p_questions jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare test_id uuid; question jsonb; position integer:=0;
begin
  perform 1 from study_rooms where id=p_room_id and owner_id=p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  if jsonb_array_length(p_questions)<2 or jsonb_array_length(p_questions)>20 then raise exception 'Invalid test length'; end if;
  if (select count(distinct q->>'topic_id') from jsonb_array_elements(p_questions) q)<2 then raise exception 'A practice test must cover at least two topics'; end if;
  insert into practice_tests(room_id,owner_id,topic_snapshot) values(p_room_id,p_owner_id,p_topics) returning id into test_id;
  for question in select * from jsonb_array_elements(p_questions) loop
    perform 1 from topics where id=(question->>'topic_id')::uuid and room_id=p_room_id and owner_id=p_owner_id and active;
    if not found then raise exception 'Study scope changed. Generate a new test.'; end if;
    insert into quiz_questions(room_id,owner_id,topic_id,kind,prompt,choices,correct_choice,expected_answer,explanation,citations,difficulty,practice_test_id,test_position)
    values(p_room_id,p_owner_id,(question->>'topic_id')::uuid,question->>'kind',question->>'prompt',question->'choices',
      (question->>'correct_choice')::integer,question->>'expected_answer',question->>'explanation',question->'citations',question->>'difficulty',test_id,position);
    position:=position+1;
  end loop;
  return test_id;
end $$;
revoke all on function public.create_practice_test(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_practice_test(uuid,uuid,jsonb,jsonb) to service_role;

create function public.submit_practice_test(p_test_id uuid,p_owner_id uuid,p_grades jsonb,p_answers jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare exam practice_tests; grade jsonb; question quiz_questions; test_result jsonb; topic_results jsonb; reviews jsonb;
begin
  select * into exam from practice_tests where id=p_test_id and owner_id=p_owner_id;
  if not found then raise exception 'Test not found'; end if;
  perform 1 from study_rooms where id=exam.room_id for update;
  select * into exam from practice_tests where id=p_test_id and owner_id=p_owner_id for update;
  if exam.status='submitted' then return exam.result; end if;
  if jsonb_array_length(p_grades)<>(select count(*) from quiz_questions where practice_test_id=exam.id)
    or (select count(distinct g->>'id') from jsonb_array_elements(p_grades) g)<>jsonb_array_length(p_grades) then
    raise exception 'Grade every question exactly once';
  end if;
  for grade in select * from jsonb_array_elements(p_grades) loop
    select * into question from quiz_questions where id=(grade->>'id')::uuid and practice_test_id=exam.id and owner_id=p_owner_id;
    if not found then raise exception 'Question does not belong to this test'; end if;
    perform record_quiz_attempt(question.id,p_owner_id,grade->>'response',(grade->>'selected_choice')::integer,
      (grade->>'score')::numeric,(grade->>'is_correct')::boolean,grade->>'feedback');
  end loop;
  select jsonb_agg(row_to_json(r) order by r.position) into reviews from (
    select q.id,q.topic_id,q.prompt,q.kind,q.choices,q.correct_choice,q.expected_answer,q.explanation,q.citations,
      q.test_position as position,a.score,a.is_correct,a.feedback,a.response,a.selected_choice
    from quiz_questions q join quiz_attempts a on a.question_id=q.id and a.owner_id=p_owner_id where q.practice_test_id=exam.id
  ) r;
  select jsonb_agg(row_to_json(r)) into topic_results from (
    select q.topic_id,t.title,count(*) as questions,round(avg(a.score)) as score,
      count(*) filter(where not a.is_correct) as misses
    from quiz_questions q join topics t on t.id=q.topic_id join quiz_attempts a on a.question_id=q.id and a.owner_id=p_owner_id
    where q.practice_test_id=exam.id group by q.topic_id,t.title
  ) r;
  select jsonb_build_object('score',round(avg(a.score)),'questionCount',count(*),'topics',topic_results,'reviews',reviews)
    into test_result from quiz_questions q join quiz_attempts a on a.question_id=q.id and a.owner_id=p_owner_id where q.practice_test_id=exam.id;
  update practice_tests set status='submitted',submitted_at=now(),draft_answers=p_answers,result=test_result where id=exam.id;
  return test_result;
end $$;
revoke all on function public.submit_practice_test(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_practice_test(uuid,uuid,jsonb,jsonb) to service_role;
