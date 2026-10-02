import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextChallenge} from './director';
import {initialLearningState} from './reducer';
const key={userId:'u',roomId:'r',topicId:'t'};
const now='2026-10-02T12:00:00Z';
const state={...initialLearningState(key),reasoningLevel:5 as const,scaffoldLevel:2 as const};
const args={concept:{...key,objective:'Explain'},learnerState:state,recentEvents:[],activity:'coach' as const,route:'studigo_default' as const,now,reviewDueAt:now};
test('due review is issued by pure director without changing learner state or support',()=>{
 const before=structuredClone(args);const spec=nextChallenge(args);
 assert.equal(spec.reasoningLevel,1);assert.equal(spec.challengeKind,'recall');assert.equal(spec.scaffoldLevel,2);
 assert.ok(spec.reasons.includes('scheduled_independent_recall'));assert.deepEqual(args,before);
 assert.equal(nextChallenge({...args,reviewDueAt:'2026-10-03T00:00:00Z'}).reasoningLevel,5);
 assert.equal(nextChallenge({...args,reviewDueAt:null}).reasoningLevel,5);
 assert.throws(()=>nextChallenge({...args,reviewDueAt:'bad'}),/Invalid/);
});
test('rematch, pending rematch, stretch and assessment precedence survive due review',()=>{
 assert.equal(nextChallenge({...args,challengeRequest:'stretch'}).reasoningLevel,6);
 for(const dueAt of [now,'2026-10-03T00:00:00Z']) {
  const spec=nextChallenge({...args,learnerState:{...state,rematch:{reason:'transfer_fail',dueAt,contextId:'original',encounterId:'previous',misconceptionId:null}}});
  assert.equal(spec.reasoningLevel,dueAt===now?6:5);assert.ok(!spec.reasons.includes('scheduled_independent_recall'));
 }
 assert.equal(nextChallenge({...args,activity:'practice_test'}).reasoningLevel,5);
 assert.equal(nextChallenge({...args,activity:'quiz'}).reasoningLevel,5);
 assert.equal(nextChallenge({...args,activity:'flashcard'}).reasoningLevel,1);
});

