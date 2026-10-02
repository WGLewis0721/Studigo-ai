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
