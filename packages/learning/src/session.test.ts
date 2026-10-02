import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectConcept, planSession, type SessionConcept } from './session';
import { migrateCoachMode } from './preferences';
import { REASONING_LADDER, SCAFFOLD_LADDER, type LearningEvent } from './types';
const key = { userId: 'u', roomId: 'r', topicId: 'a' };
const at = (day: number) => new Date(Date.parse('2026-01-01T00:00:00Z') + day * 86400000).toISOString();
function event(day: number, overrides: Partial<LearningEvent> = {}): LearningEvent {
  return { ...key, id:'e'+day, encounterId:'q'+day, activity:'quiz', challengeKind:'recall', result:'correct',
    scaffoldUsed:0, evidence:'assessed', contextId:'c'+day, newContext:false, misconceptionId:null, createdAt:at(day), ...overrides };
}
function concept(id: string, events: LearningEvent[] = [], priority = 100): SessionConcept {
  const k = { ...key, topicId:id };
  return { key:k, title:id, objective:id, priority, order:0, active:true, supported:true, teacherScoped:true,
    projection:projectConcept(k, events.map(e => ({ ...e, topicId:id }))) };
}
const plan = (cs: SessionConcept[], extra: Partial<Parameters<typeof planSession>[0]> = {}) =>
  planSession({ concepts:cs, mode:'study', budgetMinutes:30, elapsedSeconds:0, now:at(10), ...extra });
test('preserves ten reasoning and six scaffold rungs and conservative preferences', () => {
  assert.equal(REASONING_LADDER.length,10); assert.equal(SCAFFOLD_LADDER.length,6);
  assert.equal(migrateCoachMode({style:'direct'}),'show'); assert.equal(migrateCoachMode({style:'visual'}),'show');
  assert.equal(migrateCoachMode({style:'drill'}),'challenge'); assert.equal(migrateCoachMode({style:'socratic'}),'coach');
  assert.equal(migrateCoachMode({style:'unknown'}),'coach'); assert.equal(migrateCoachMode({coach_mode:'challenge',style:'direct'}),'challenge');
});
test('retention intervals advance only on due independent recalls and retries are idempotent', () => {
  const events = [event(0),event(1),event(4),event(11)];
  const p = projectConcept(key, events);
  assert.equal(p.review.step,3); assert.equal(p.review.dueAt,at(25)); assert.equal(p.revision,4);
  assert.deepEqual(projectConcept(key,[...events,events[3]]),p);
  assert.equal(projectConcept(key,[...events,event(26,{result:'incorrect'})]).review.dueAt,at(27));
});
test('assistance, reveals, legacy and self-rated cards cannot certify independent mastery', () => {
  for (const overrides of [{scaffoldUsed:2 as const},{scaffoldUsed:null},{evidence:'legacy' as const},{evidence:'self_reported' as const,activity:'flashcard' as const}]) {
    const p = projectConcept(key,[event(0,overrides)]);
    assert.equal(p.stage,'practicing'); assert.equal(p.review.dueAt,null);
  }
  const p=projectConcept(key,[event(0,{result:'revealed'}),event(1,{encounterId:'q0'})]);
  assert.equal(p.stage,'practicing'); assert.equal(p.review.dueAt,null);
});
test('session pacing orders due review before coverage, excludes unusable topics, and respects overrides', () => {
  const due=concept('due',[event(0)],90), fresh=concept('fresh',[],100);
  assert.equal(plan([fresh,due]).topicId,'due');
  assert.equal(plan([fresh,due],{mode:'cram'}).topicId,'fresh');
  assert.equal(plan([fresh,due],{selectedTopicId:'fresh'}).topicId,'fresh');
  assert.equal(plan([{...fresh,supported:false},due]).topicId,'due');
  assert.equal(plan([{...fresh,active:false}]).status,'empty');
  assert.equal(plan([fresh],{elapsedSeconds:1800}).status,'complete');
  assert.equal(plan([fresh],{pendingTopicId:'fresh',elapsedSeconds:1800}).status,'pending');
  assert.throws(()=>plan([fresh],{selectedTopicId:'missing'}),/not available/);
  assert.throws(()=>plan([fresh,{...due,key:{...due.key,userId:'other'}}]),/ownership/);
});
test('tie breaking and explicit clocks make shuffled inputs deterministic', () => {
  const a=concept('a'),b=concept('b');
  assert.deepEqual(plan([a,b]),plan([b,a]));
  assert.throws(()=>plan([a],{now:'bad'}),/Invalid/);
});
test('transfer failure reopens a demonstrated concept and schedules rematch', () => {
  const p=projectConcept(key,[event(0,{challengeKind:'transfer',newContext:true}),event(1,{challengeKind:'transfer',newContext:true,result:'incorrect'})]);
  assert.equal(p.needsCheck,true); assert.equal(p.stage,'practicing'); assert.equal(p.state.rematch?.dueAt,at(2));
});

test('mixed partial and incorrect failures split and offer an optional topic change', () => {
  for (const results of [['partial','incorrect'],['incorrect','partial']] as const) {
    const struggling = concept('struggle', results.map((result,i)=>event(i,{result})));
    assert.equal(struggling.projection.state.failureStreak,2);
    assert.equal(struggling.projection.state.taskSize,'single_step');
    assert.equal(struggling.projection.state.reasoningLevel,0);
    const recommended=plan([struggling,concept('other')],{selectedTopicId:'struggle'});
    assert.equal(recommended.offerTopicChange,true);
    assert.equal(recommended.topicId,'struggle');
    assert.equal(plan([struggling,concept('other')],{selectedTopicId:'other'}).topicId,'other');
    const recovered=projectConcept(key,[event(0,{result:results[0]}),event(1,{result:results[1]}),event(2)]);
    assert.equal(recovered.state.failureStreak,0);
    assert.equal(recovered.state.taskSize,'whole');
  }
});

test('assisted due recall leaves the earned interval due until independent retrieval', () => {
  const base=[event(0),event(1)];
  for (const result of ['help','revealed'] as const) {
    const p=projectConcept(key,[...base,event(4,{id:'support',result}),event(4,{id:'answer'})]);
    assert.deepEqual(p.review,{step:1,dueAt:at(4)});
    assert.equal(p.state.independentRecallCount,2);
    assert.equal(p.state.hintDependentSuccessCount,1);
    assert.equal(plan([concept('due',[...base,event(4,{id:'support',result}),event(4,{id:'answer'})])]).reasons[0],'due_review_or_rematch');
  }
});

test('transfer rematch requires delay, fresh context, independent transfer and preserves earliest due date', () => {
  const base=[event(0,{challengeKind:'transfer',newContext:true}),event(1,{challengeKind:'transfer',newContext:true,result:'partial'})];
  const failed=projectConcept(key,base);
  assert.equal(failed.needsCheck,true);
  for (const candidate of [event(1.5,{challengeKind:'transfer',newContext:true}),event(2,{challengeKind:'transfer',newContext:true,contextId:'c1'}),event(2,{challengeKind:'transfer',newContext:true,scaffoldUsed:2}),event(2,{newContext:true})]) {
    assert.equal(projectConcept(key,[...base,candidate]).state.rematch?.dueAt,at(2));
  }
  const repeated=projectConcept(key,[...base,event(2,{challengeKind:'transfer',newContext:true,result:'incorrect'})]);
  assert.equal(repeated.state.rematch?.dueAt,at(2));
  const passed=projectConcept(key,[...base,event(2,{challengeKind:'transfer',newContext:true})]);
  assert.equal(passed.state.rematch,null);
  assert.equal(passed.stage,'transfer');
  assert.equal(passed.needsCheck,false);
});

test('shuffled equal-time help and duplicate receipts preserve replay and due reviews', () => {
  const events=[event(0),event(1,{id:'z-help',result:'help'}),event(1,{id:'a-answer'})];
  const canonical=projectConcept(key,events);
  assert.deepEqual(projectConcept(key,[events[2],events[0],events[1],events[2]]),canonical);
  assert.equal(canonical.review.dueAt,at(1));
  assert.equal(canonical.state.independentSuccessCount,1);
  assert.throws(()=>projectConcept(key,[...events,{...events[2],result:'incorrect'}]),/Conflicting/);
});


test('support between unsuccessful assessed attempts preserves the topic-change offer', () => {
  for (const support of ['help','revealed'] as const) {
    const events=[event(0,{result:'partial'}),event(1,{result:support}),event(2,{result:'incorrect'})];
    const struggling=concept('struggle',events);
    assert.equal(struggling.projection.state.failureStreak,2);
    assert.equal(struggling.projection.state.taskSize,'single_step');
    assert.equal(plan([struggling],{selectedTopicId:'struggle'}).offerTopicChange,true);
    assert.equal(projectConcept(key,[...events,event(3,{result:'skipped'})]).state.failureStreak,0);
    assert.equal(projectConcept(key,[...events,event(3)]).state.failureStreak,0);
  }
});

test('self-reported or legacy card failures cannot activate or reset assessed-attempt pacing', () => {
  for (const evidence of ['self_reported','legacy'] as const) {
    const cards=[event(1,{result:'incorrect',activity:'flashcard',evidence}),event(2,{result:'partial',activity:'flashcard',evidence})];
    const unassessed=concept('cards',cards);
    assert.equal(unassessed.projection.state.failureStreak,0);
    assert.equal(unassessed.projection.state.taskSize,'whole');
    assert.equal(plan([unassessed]).offerTopicChange,false);
    const mixed=[event(0,{result:'partial'}),...cards,event(3,{activity:'flashcard',evidence}),event(4,{result:'incorrect'})];
    const assessed=concept('mixed',mixed);
    assert.equal(assessed.projection.state.failureStreak,2);
    assert.equal(plan([assessed]).offerTopicChange,true);
  }
});

test('retention shares canonical failure-before-success ordering across equal-time encounters',()=>{
  const events=[event(0),event(1,{id:'a-success',encounterId:'success'}),event(1,{id:'z-failure',encounterId:'failure',result:'incorrect'})];
  const projected=projectConcept(key,events);
  // The failed retrieval restarts day one, then a same-tick independent success
  // earns day one rather than a fictitious due-review advancement.
  assert.deepEqual(projected.review,{step:0,dueAt:at(2)});
  assert.deepEqual(projectConcept(key,[...events].reverse()),projected);
});
