-- Practice depth: two more question types, a confidence signal on every
-- answer, and learner ownership of the material Studigo generated.
-- Additive only. Existing rows keep working with their current values.

-- ---------------------------------------------------------------------------
-- A. True/false and fill-in-the-blank questions
-- ---------------------------------------------------------------------------

alter table public.quiz_questions drop constraint if exists quiz_questions_kind_check;
alter table public.quiz_questions add constraint quiz_questions_kind_check
  check (kind in ('multiple_choice', 'short_answer', 'true_false', 'fill_blank'));

-- Accepted spellings for a fill-in answer, so grading is deterministic and free.
-- This is answer-key data: it is deliberately left out of the column grant to
-- `authenticated` below, exactly like correct_choice and expected_answer.
alter table public.quiz_questions add column if not exists accepted_answers text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- B. Confidence, captured before the answer is revealed
-- ---------------------------------------------------------------------------

-- 1 guessing, 2 unsure, 3 confident. Null for attempts recorded before this
-- existed, and for flashcard rows, which carry their own rating.
alter table public.quiz_attempts add column if not exists confidence smallint
  check (confidence is null or confidence between 1 and 3);

drop function if exists public.record_quiz_attempt(uuid, uuid, text, integer, numeric, boolean, text);

create or replace function public.record_quiz_attempt(
  p_question_id uuid, p_owner_id uuid, p_response text, p_selected_choice integer,
  p_score numeric, p_is_correct boolean, p_feedback text, p_confidence integer default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare q quiz_questions; a quiz_attempts; mastery numeric;
begin
  select * into q from quiz_questions where id = p_question_id and owner_id = p_owner_id;
  if not found then raise exception 'Question not found'; end if;
  perform 1 from study_rooms where id = q.room_id for update;
  if q.topic_id is not null then
    perform 1 from topics where id = q.topic_id and active for update;
    if not found then raise exception 'This question is no longer in the study scope. Generate a fresh quiz.'; end if;
  end if;
  select * into a from quiz_attempts where question_id = q.id and owner_id = p_owner_id;
  if not found then
    insert into quiz_attempts(question_id, room_id, owner_id, topic_id, response, selected_choice,
      is_correct, score, feedback, confidence)
    values(q.id, q.room_id, q.owner_id, q.topic_id, p_response, p_selected_choice,
      p_is_correct, p_score, p_feedback,
      case when p_confidence between 1 and 3 then p_confidence::smallint else null end)
    returning * into a;
  end if;
  if q.topic_id is not null then mastery := recalculate_mastery(q.topic_id); end if;
  return jsonb_build_object('isCorrect', a.is_correct, 'score', a.score, 'feedback', a.feedback,
    'confidence', a.confidence, 'mastery', mastery);
end $$;
revoke all on function public.record_quiz_attempt(uuid,uuid,text,integer,numeric,boolean,text,integer) from public, anon, authenticated;
grant execute on function public.record_quiz_attempt(uuid,uuid,text,integer,numeric,boolean,text,integer) to service_role;

-- ---------------------------------------------------------------------------
-- C. The learner owns what Studigo generated
-- ---------------------------------------------------------------------------

alter table public.topics
  add column if not exists learner_edited boolean not null default false,
  -- A topic the learner removed stays out of scope even when the guide is
  -- re-ingested; re-adding it is an explicit act.
  add column if not exists learner_removed boolean not null default false;

alter table public.flashcards add column if not exists learner_edited boolean not null default false;

create or replace function public.update_topic(
  p_topic_id uuid, p_owner_id uuid, p_title text, p_objective text, p_priority integer
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare t topics; clean_title text; clean_objective text;
begin
  clean_title := nullif(btrim(p_title), '');
  if clean_title is null then raise exception 'A topic needs a title.'; end if;
  if length(clean_title) > 160 then raise exception 'Keep the topic title under 160 characters.'; end if;
  clean_objective := nullif(btrim(coalesce(p_objective, '')), '');
  if length(coalesce(clean_objective, '')) > 600 then raise exception 'Keep the objective under 600 characters.'; end if;

  update topics set title = clean_title, objective = clean_objective,
    priority = least(100, greatest(0, coalesce(p_priority, priority))),
    learner_edited = true, updated_at = now()
  where id = p_topic_id and owner_id = p_owner_id and active
  returning * into t;
  if not found then raise exception 'Topic not found'; end if;

  return jsonb_build_object('id', t.id, 'title', t.title, 'objective', t.objective,
    'priority', t.priority, 'learnerEdited', t.learner_edited);
end $$;
revoke all on function public.update_topic(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.update_topic(uuid,uuid,text,text,integer) to service_role;

create or replace function public.set_topic_active(
  p_topic_id uuid, p_owner_id uuid, p_active boolean
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare t topics;
begin
  update topics set active = p_active, learner_removed = not p_active, updated_at = now()
  where id = p_topic_id and owner_id = p_owner_id
  returning * into t;
  if not found then raise exception 'Topic not found'; end if;
  return jsonb_build_object('id', t.id, 'active', t.active);
end $$;
revoke all on function public.set_topic_active(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_topic_active(uuid,uuid,boolean) to service_role;

create or replace function public.create_topic(
  p_room_id uuid, p_owner_id uuid, p_title text, p_objective text, p_priority integer
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare t topics; clean_title text; next_index integer;
begin
  clean_title := nullif(btrim(p_title), '');
  if clean_title is null then raise exception 'A topic needs a title.'; end if;
  if length(clean_title) > 160 then raise exception 'Keep the topic title under 160 characters.'; end if;
  perform 1 from study_rooms where id = p_room_id and owner_id = p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  if (select count(*) from topics where room_id = p_room_id and active) >= 80 then
    raise exception 'This room already has the maximum of 80 active topics.';
  end if;

  -- Restore rather than duplicate when the learner re-adds something they removed.
  select * into t from topics where room_id = p_room_id
    and lower(regexp_replace(btrim(title), '[^a-zA-Z0-9]+', ' ', 'g'))
      = lower(regexp_replace(clean_title, '[^a-zA-Z0-9]+', ' ', 'g'))
    order by active desc, created_at limit 1;
  if found then
    update topics set active = true, learner_removed = false, learner_edited = true,
      title = clean_title, objective = nullif(btrim(coalesce(p_objective, '')), ''),
      priority = least(100, greatest(0, coalesce(p_priority, 60))), updated_at = now()
    where id = t.id returning * into t;
  else
    select coalesce(max(order_index), -1) + 1 into next_index from topics where room_id = p_room_id;
    insert into topics(room_id, owner_id, title, objective, priority, origin, order_index, learner_edited)
    values(p_room_id, p_owner_id, clean_title, nullif(btrim(coalesce(p_objective, '')), ''),
      least(100, greatest(0, coalesce(p_priority, 60))), 'manual', next_index, true)
    returning * into t;
  end if;

  return jsonb_build_object('id', t.id, 'title', t.title);
end $$;
revoke all on function public.create_topic(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_topic(uuid,uuid,text,text,integer) to service_role;

create or replace function public.update_flashcard(
  p_card_id uuid, p_owner_id uuid, p_front text, p_back text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare c flashcards; clean_front text; clean_back text;
begin
  clean_front := nullif(btrim(p_front), '');
  clean_back := nullif(btrim(p_back), '');
  if clean_front is null or clean_back is null then raise exception 'A card needs both a front and a back.'; end if;
  if length(clean_front) > 500 or length(clean_back) > 2000 then raise exception 'That card is too long.'; end if;

  -- The review schedule is deliberately untouched: fixing a typo should not
  -- reset how well the learner already knows the card.
  update flashcards set front = clean_front, back = clean_back, learner_edited = true, updated_at = now()
  where id = p_card_id and owner_id = p_owner_id
  returning * into c;
  if not found then raise exception 'Card not found'; end if;

  return jsonb_build_object('id', c.id, 'front', c.front, 'back', c.back, 'learnerEdited', c.learner_edited);
end $$;
revoke all on function public.update_flashcard(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.update_flashcard(uuid,uuid,text,text) to service_role;

create or replace function public.delete_flashcard(p_card_id uuid, p_owner_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare deleted uuid;
begin
  delete from flashcards where id = p_card_id and owner_id = p_owner_id returning id into deleted;
  if deleted is null then raise exception 'Card not found'; end if;
  return jsonb_build_object('id', deleted);
end $$;
revoke all on function public.delete_flashcard(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_flashcard(uuid,uuid) to service_role;

-- ---------------------------------------------------------------------------
-- D. Re-ingesting a guide must not overwrite the learner's own edits
-- ---------------------------------------------------------------------------

create or replace function public.refresh_topic_map(
  p_room_id uuid, p_owner_id uuid, p_document_id uuid, p_is_guide boolean, p_topics jsonb
) returns integer language plpgsql security invoker set search_path = public as $$
declare item jsonb; old topics; inserted_count integer := 0; position integer := 0; ids uuid[] := '{}'; topic_id uuid; same_objective boolean; was_edited boolean;
begin
  perform 1 from study_rooms where id = p_room_id and owner_id = p_owner_id for update;
  if not found then raise exception 'Room not found'; end if;
  perform 1 from documents where id = p_document_id and room_id = p_room_id and owner_id = p_owner_id;
  if not found then raise exception 'Document not found'; end if;
  if p_is_guide and exists(select 1 from documents d join documents current on current.id = p_document_id
      where d.room_id = p_room_id and d.source_type = 'study_guide' and d.status = 'ready'
      and (d.created_at, d.id) > (current.created_at, current.id)) then return 0; end if;
  if not p_is_guide and exists(select 1 from documents where room_id = p_room_id and source_type = 'study_guide' and status = 'ready') then return 0; end if;
  for item in select * from jsonb_array_elements(p_topics) loop
    select * into old from topics where room_id = p_room_id
      and lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace(trim(item->>'title'), '[^a-zA-Z0-9]+', ' ', 'g'))
      order by active desc, created_at limit 1;
    was_edited := false;
    if found then
      -- A topic the learner deleted stays deleted through a re-ingest.
      if old.learner_removed then
        ids := array_append(ids, old.id); position := position + 1; continue;
      end if;
      was_edited := old.learner_edited;
      same_objective := lower(regexp_replace(coalesce(old.objective,''), '[^a-zA-Z0-9]+', ' ', 'g')) = lower(regexp_replace(coalesce(item->>'objective',''), '[^a-zA-Z0-9]+', ' ', 'g'));
      topic_id := old.id;
      if not same_objective and not was_edited then
        -- Keep historical attempts attached to the retired objective, not to a
        -- different skill that happens to share its title.
        update topics set active = false where id = old.id;
        topic_id := null;
      end if;
    else topic_id := null;
    end if;
    if topic_id is null then
      insert into topics(room_id, owner_id, title, objective) values(p_room_id,p_owner_id,item->>'title',item->>'objective') returning id into topic_id;
      inserted_count := inserted_count + 1;
      was_edited := false;
    end if;
    update topics set
      -- Learner wording wins; the refresh still re-links evidence and ordering.
      title = case when was_edited then title else item->>'title' end,
      objective = case when was_edited then objective else item->>'objective' end,
      priority = case when was_edited then priority else (item->>'priority')::integer end,
      key_terms = array(select jsonb_array_elements_text(item->'keyTerms')),
      evidence = coalesce(item->'evidence','[]'::jsonb),
      source_document_ids = case when p_is_guide then array[p_document_id]
        else array(select distinct x from unnest(source_document_ids || array[p_document_id]) x) end,
      origin = case when was_edited then origin when p_is_guide then 'study_guide' else 'teacher_material' end,
      order_index = position, active = true where id = topic_id;
    ids := array_append(ids, topic_id); position := position + 1;
  end loop;
  update topics set active = false where room_id = p_room_id and not (id = any(ids))
    and (p_is_guide or p_document_id = any(source_document_ids));
  return inserted_count;
end $$;
revoke all on function public.refresh_topic_map(uuid,uuid,uuid,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.refresh_topic_map(uuid,uuid,uuid,boolean,jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- E. Practice tests carry the new question types through unchanged
-- ---------------------------------------------------------------------------

create or replace function public.create_practice_test(p_room_id uuid,p_owner_id uuid,p_topics jsonb,p_questions jsonb)
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
    insert into quiz_questions(room_id,owner_id,topic_id,kind,prompt,choices,correct_choice,expected_answer,accepted_answers,explanation,citations,difficulty,practice_test_id,test_position)
    values(p_room_id,p_owner_id,(question->>'topic_id')::uuid,question->>'kind',question->>'prompt',question->'choices',
      (question->>'correct_choice')::integer,question->>'expected_answer',
      coalesce(array(select jsonb_array_elements_text(question->'accepted_answers')), '{}'),
      question->>'explanation',question->'citations',question->>'difficulty',test_id,position);
    position:=position+1;
  end loop;
  return test_id;
end $$;
revoke all on function public.create_practice_test(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_practice_test(uuid,uuid,jsonb,jsonb) to service_role;

create or replace function public.submit_practice_test(p_test_id uuid,p_owner_id uuid,p_grades jsonb,p_answers jsonb)
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
      (grade->>'score')::numeric,(grade->>'is_correct')::boolean,grade->>'feedback',(grade->>'confidence')::integer);
  end loop;
  select jsonb_agg(row_to_json(r) order by r.position) into reviews from (
    select q.id,q.topic_id,q.prompt,q.kind,q.choices,q.correct_choice,q.expected_answer,q.explanation,q.citations,
      q.test_position as position,a.score,a.is_correct,a.feedback,a.response,a.selected_choice,a.confidence
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

-- ---------------------------------------------------------------------------
-- F. Explanation level, chosen per room and kept across sessions
-- ---------------------------------------------------------------------------

-- Changes how a topic is explained, never what the material says.
alter table public.study_rooms add column if not exists explain_level text not null default 'standard'
  check (explain_level in ('simpler', 'standard', 'deeper'));
