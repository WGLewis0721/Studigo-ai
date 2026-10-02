import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LocalBetaStore, BetaError } from './local-beta';
import { integratedOperation, integratedTopics, integratedStudy, integratedRooms } from './integrated-beta';
import { updateLocalRoom } from './local-beta-room-actions';
const now='2026-10-01T12:00:00Z';
function setup(){const store=new LocalBetaStore(':memory:');const session=randomUUID();
  const call=(path:string,body:Record<string,unknown>={},method='POST')=>integratedOperation(store,session,path,method,body,now) as any;
  return {store,session,call};}
test('quiz contract commits once and changes subsequent Coach demand',()=>{
  const {store,session,call}=setup();try {
    const {questions}=call('/quiz',{roomId:'math',topicId:'fractions',count:2});
    assert.equal(questions[0].correct_choice,undefined);
    const input={questionId:questions[0].id,selectedChoice:0,response:null,confidence:3};
    const grade=call('/quiz/attempt',input);assert.equal(grade.isCorrect,true);assert.deepEqual(call('/quiz/attempt',input),grade);
    assert.throws(()=>call('/quiz/attempt',{...input,selectedChoice:1}),BetaError);
    call('/quiz/attempt',{...input,questionId:questions[1].id});
    const reply=call('/chat',{roomId:'math',mode:'coach',question:'Coach me through: Equivalent fractions',interactionId:randomUUID()});
    assert.ok(reply.text.includes('1/2 = __/6'));assert.equal(integratedStudy(store.read(session),'math').evidence.length,2);
  }finally{store.close();}
});
test('Coach support and formative Learn preserve assistance and cannot manufacture independent credit',()=>{
  const {store,session,call}=setup();try {
    for(const question of ['Coach me through: Equivalent fractions','Give me a hint','A'])call('/chat',{roomId:'math',mode:'coach',question,interactionId:randomUUID()});
    const events=store.read(session).rooms.math.events;assert.equal(events.at(-1)?.scaffoldUsed,2);
    assert.equal(integratedTopics(store.read(session),'math')[0].mastery_score,25);
    const count=events.length;assert.equal(call('/learn/check',{roomId:'math',topicId:'fractions',answer:'3'}).understood,true);
    assert.equal(store.read(session).rooms.math.events.length,count);
  }finally{store.close();}
});
test('flashcard self-report is retry-safe and remains distinct from independent evidence',()=>{
  const {store,session,call}=setup();try {
    const {cards}=call('/flashcards',{roomId:'science'});const input={cardId:cards[0].id,rating:3,requestId:randomUUID()};
    call('/flashcards/review',input);call('/flashcards/review',input);
    assert.equal(store.read(session).rooms.science.events.length,1);
    assert.equal(store.read(session).rooms.science.events[0].evidence,'self_reported');
    assert.equal(integratedTopics(store.read(session),'science')[0].status,'learning');
  }finally{store.close();}
});
test('whole tests persist drafts, withhold rubrics, block competing encounters and commit once',()=>{
  const {store,session,call}=setup();try {
    const {testId}=call('/practice-tests',{roomId:'math',count:2});const opened=call('/practice-tests',{testId},'GET');
    assert.equal(opened.questions[0].expectedAnswer,undefined);
    assert.throws(()=>call('/chat',{roomId:'math',mode:'coach',question:'start',interactionId:randomUUID()}),BetaError);
    const answers=Object.fromEntries(opened.questions.map((q:any,i:number)=>[q.id,{selectedChoice:i===0?0:1,response:''}]));
    call('/practice-tests',{testId,answers},'PATCH');assert.deepEqual(call('/practice-tests',{testId},'GET').test.draft_answers,answers);
    const result=call('/practice-tests/submit',{testId,answers});assert.equal(result.result.score,100);
    assert.deepEqual(call('/practice-tests/submit',{testId,answers}),result);assert.equal(store.read(session).rooms.math.events.length,2);
  }finally{store.close();}
});
test('deleted source and foreign session fail closed before evidence is written',()=>{
  const {store,session,call}=setup();try {
    const id=call('/quiz',{roomId:'math',count:1}).questions[0].id;
    assert.throws(()=>integratedOperation(store,randomUUID(),'/quiz/attempt','POST',{questionId:id,selectedChoice:0},now),BetaError);
    store.transact(session,'remove-source',{},state=>{state.rooms.math.sources=[];return {state,response:true};});
    assert.throws(()=>call('/quiz/attempt',{questionId:id,selectedChoice:0}),BetaError);assert.equal(store.read(session).rooms.math.events.length,0);
  }finally{store.close();}
});

test('surface recalibration survives reload without changing a pending rubric or learning evidence',()=>{
  const {store,session,call}=setup();try {
    call('/chat',{roomId:'math',mode:'coach',question:'Coach me through: Equivalent fractions',interactionId:randomUUID()});
    const before=store.read(session).rooms.math;
    const pending=structuredClone(before.pending),events=structuredClone(before.events);
    const saved=call('/coach/preferences',{roomId:'math',preferences:{coach_mode:'challenge',style:'default',tradition:'tradition-default',practice:'transfer',explainLevel:'deeper'}});
    assert.equal(saved.learnExplainLevel,'standard');
    const learned=call('/learn/preferences',{roomId:'math',explainLevel:'simpler'});
    assert.equal(learned.coachPreferences.explainLevel,'deeper');
    assert.equal(learned.coachPreferences.coach_mode,'challenge');
    const room=integratedRooms(store.read(session)).find(r=>r.id==='math')!;
    assert.equal(room.explain_level,'standard');assert.equal(room.coach_explain_level,'deeper');assert.equal(room.learn_explain_level,'simpler');
    assert.deepEqual(store.read(session).rooms.math.pending,pending);assert.deepEqual(store.read(session).rooms.math.events,events);
    assert.equal(call('/learn',{roomId:'math',topicId:'fractions'}).explanation,before.room.topics[0].explanations.simpler);
    assert.equal(call('/chat',{roomId:'math',mode:'ask',question:'Explain equivalent fractions',interactionId:randomUUID()}).text,before.room.topics[0].explanations.simpler);
    assert.deepEqual(store.read(session).rooms.math.pending,pending);
    assert.throws(()=>call('/learn/preferences',{roomId:'math',explainLevel:'invalid'}),BetaError);
  }finally{store.close();}
});

test('apply-to-both and Room Settings reset both surface levels without changing Coach mode',()=>{
  const {store,session,call}=setup();try {
    call('/coach/preferences',{roomId:'science',preferences:{coach_mode:'show',style:'direct',tradition:'tradition-default',practice:'adaptive',explainLevel:'deeper'}});
    const both=call('/learn/preferences',{roomId:'science',explainLevel:'simpler',applyToBoth:true});
    assert.equal(both.coachPreferences.coach_mode,'show');assert.equal(both.coachPreferences.explainLevel,'simpler');
    updateLocalRoom({store,id:session},{id:'science',title:'Science',subject:'Science',courseName:null,testDate:null,level:'standard'});
    const room=integratedRooms(store.read(session)).find(r=>r.id==='science')!;
    assert.equal(room.explain_level,'standard');assert.equal(room.coach_explain_level,'standard');assert.equal(room.learn_explain_level,'standard');
    assert.equal(room.coach_preferences?.coach_mode,'show');assert.equal(store.read(session).rooms.science.events.length,0);
  }finally{store.close();}
});
