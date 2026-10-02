-- Additive repair: the exact learner-visible reply and evidence share one transaction.
alter table public.adaptive_turn_receipts add column answer jsonb;

-- Match the existing JS SHA-256 of JSON.stringify([documentId,content,pageNumber]).
-- Building each scalar separately preserves whitespace inside source text.
create function public.assert_adaptive_coach_sources(p_owner uuid,p_room uuid,p_state jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare source jsonb; chunk document_chunks%rowtype; doc documents%rowtype; topic topics%rowtype; serialized text;
begin
 if jsonb_typeof(p_state->'sourceChunkIds') is distinct from 'array'
 or jsonb_array_length(p_state->'sourceChunkIds') not between 1 and 24
 or jsonb_typeof(p_state->'issuedChallenge'->'sourceRevisions') is distinct from 'array'
 or jsonb_array_length(p_state->'issuedChallenge'->'sourceRevisions')<>jsonb_array_length(p_state->'sourceChunkIds')
 or (select count(distinct value) from jsonb_array_elements(p_state->'sourceChunkIds'))<>jsonb_array_length(p_state->'sourceChunkIds')
 then raise exception 'Unverifiable Coach sources' using errcode='40001'; end if;
 select * into topic from topics where id=(p_state->>'topicId')::uuid and owner_id=p_owner and room_id=p_room and active for share;
 if not found then raise exception 'Coach topic no longer available' using errcode='40001'; end if;
 for source in select value from jsonb_array_elements(p_state->'issuedChallenge'->'sourceRevisions') order by value->>'id' loop
   if not p_state->'sourceChunkIds' @> jsonb_build_array(source->>'id') then raise exception 'Source revision scope mismatch'; end if;
   select * into chunk from document_chunks where id=(source->>'id')::uuid and owner_id=p_owner and room_id=p_room for share;
   if not found then raise exception 'Coach source deleted' using errcode='40001'; end if;
   select * into doc from documents where id=chunk.document_id and owner_id=p_owner and room_id=p_room and status='ready' for share;
   if not found or chunk.content !~ '[^[:space:]]' then raise exception 'Coach source unavailable' using errcode='40001'; end if;
   serialized='['||to_json(chunk.document_id::text)::text||','||to_json(chunk.content)::text||','||coalesce(chunk.page_number::text,'null')||']';
   if source->>'sha256' is distinct from encode(sha256(convert_to(serialized,'UTF8')),'hex') then raise exception 'Coach source revision changed' using errcode='40001'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_state->'issuedChallenge'->'sourceRevisions'))<>jsonb_array_length(p_state->'sourceChunkIds') then raise exception 'Duplicate source revisions'; end if;
 if not session_topic_eligible(p_owner,p_room,topic.id) then raise exception 'Coach topic sources unavailable' using errcode='40001'; end if;
end $$;
revoke all on function public.assert_adaptive_coach_sources(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.assert_adaptive_coach_sources(uuid,uuid,jsonb) to service_role;

create function public.commit_adaptive_coach_response(p_conversation_id uuid,p_owner_id uuid,p_interaction_id uuid,p_expected_revision bigint,
 p_state jsonb,p_events jsonb,p_projections jsonb,p_answer jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c conversations%rowtype; prior adaptive_turn_receipts%rowtype; encounter adaptive_encounters%rowtype; e jsonb; issued jsonb; result jsonb; actual bigint;
begin
 select * into c from conversations where id=p_conversation_id and owner_id=p_owner_id for update;
 if not found or not exists(select 1 from messages where id=p_interaction_id and conversation_id=c.id and role='user') then raise exception 'Coach interaction ownership mismatch' using errcode='42501'; end if;
 select * into prior from adaptive_turn_receipts where interaction_id=p_interaction_id;
 if found then
   if prior.owner_id<>p_owner_id or prior.conversation_id<>c.id then raise exception 'Conflicting turn retry' using errcode='40001'; end if;
   if prior.answer is null then raise exception 'Historical reply unavailable' using errcode='40001'; end if;
   return jsonb_build_object('answer',prior.answer,'revision',prior.revision,'duplicate',true);
 end if;
 if c.learning_revision<>p_expected_revision then raise exception 'Stale Coach revision' using errcode='40001'; end if;
 perform 1 from study_rooms where id=c.room_id and owner_id=p_owner_id for update;
 if jsonb_typeof(p_answer) is distinct from 'object' or jsonb_typeof(p_answer->'text') is distinct from 'string'
 or length(p_answer->>'text')=0 or jsonb_typeof(p_answer->'citations') is distinct from 'array'
 or jsonb_typeof(p_answer->'grounded') is distinct from 'boolean' then raise exception 'Invalid Coach reply'; end if;
 issued=p_state->'issuedChallenge';
 if p_state->>'kind'='awaiting_answer' and issued is not null then
   perform assert_adaptive_coach_sources(p_owner_id,c.room_id,p_state);
   select * into encounter from adaptive_encounters where id=issued->>'encounterId';
   if found then
     if encounter.owner_id<>p_owner_id or encounter.conversation_id<>c.id
     or encounter.issued_state->'expectedConcepts' is distinct from p_state->'expectedConcepts'
     or encounter.issued_state->'sourceChunkIds' is distinct from p_state->'sourceChunkIds'
     or encounter.issued_state->'issuedChallenge'->'sourceRevisions' is distinct from issued->'sourceRevisions'
     or encounter.issued_state->'issuedChallenge'->'contextId' is distinct from issued->'contextId'
     then raise exception 'Issued rubric or source snapshot changed' using errcode='40001'; end if;
   else
     select (select count(*) from learning_events where owner_id=p_owner_id and room_id=c.room_id and topic_id=(p_state->>'topicId')::uuid)
       +(select count(*) from quiz_attempts where owner_id=p_owner_id and room_id=c.room_id and topic_id=(p_state->>'topicId')::uuid)
       +(select count(distinct value->>'id') from jsonb_array_elements(p_events) where value->>'topic_id'=p_state->>'topicId'
         and not exists(select 1 from learning_events where owner_id=p_owner_id and id=value->>'id')) into actual;
     if issued->'spec'->>'stateRevision' is null or actual<>(issued->'spec'->>'stateRevision')::bigint then raise exception 'Stale issued concept revision' using errcode='40001'; end if;
     if issued->>'contextId' is not null and exists(select 1 from adaptive_encounters where owner_id=p_owner_id and room_id=c.room_id and topic_id=(p_state->>'topicId')::uuid and issued_state->'issuedChallenge'->>'contextId'=issued->>'contextId') then raise exception 'Repeated Coach context' using errcode='40001'; end if;
   end if;
 end if;
 for e in select value from jsonb_array_elements(p_events) loop
   select * into encounter from adaptive_encounters where id=e->>'encounter_id' and owner_id=p_owner_id and conversation_id=c.id;
   if not found or e->>'challenge_kind' is distinct from encounter.issued_state->'issuedChallenge'->'spec'->>'challengeKind'
   or e->>'context_id' is distinct from encounter.issued_state->'issuedChallenge'->>'contextId'
   or e->'new_context' is distinct from coalesce(encounter.issued_state->'issuedChallenge'->'spec'->'constraints'->'requireNewContext','false'::jsonb)
   then raise exception 'Coach observation differs from issued task'; end if;
   -- A skip is bookkeeping and remains possible after source deletion.
   if e->>'result'<>'skipped' then perform assert_adaptive_coach_sources(p_owner_id,c.room_id,encounter.issued_state); end if;
   if e->>'result' in ('correct','partial','incorrect') and not exists(select 1 from adaptive_semantic_evidence where interaction_id=p_interaction_id and encounter_id=encounter.id and owner_id=p_owner_id) then raise exception 'Accepted evaluation required'; end if;
 end loop;
 result=commit_adaptive_coach_turn(p_conversation_id,p_owner_id,p_interaction_id,p_expected_revision,p_state,p_events,p_projections);
 update adaptive_turn_receipts set answer=p_answer where interaction_id=p_interaction_id;
 insert into messages(conversation_id,role,content,citations) values(c.id,'assistant',p_answer->>'text',p_answer->'citations');
 return result||jsonb_build_object('answer',p_answer);
end $$;
revoke all on function public.commit_adaptive_coach_response(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_adaptive_coach_response(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb,jsonb) to service_role;
