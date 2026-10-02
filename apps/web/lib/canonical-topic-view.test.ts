import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectConcept, type LearningEvent } from '@studigo/learning';
import { projectTopicView } from './canonical-topic-view';
const key={userId:'learner',roomId:'room',topicId:'topic'};
const topic={id:key.topicId,room_id:key.roomId,mastery_score:100,status:'mastered',last_practiced_at:null};
const event=(override:Partial<LearningEvent>={}):LearningEvent=>({...key,id:'a',encounterId:'a',activity:'coach',challengeKind:'recall',result:'correct',scaffoldUsed:0,evidence:'assessed',contextId:null,newContext:false,misconceptionId:null,createdAt:'2026-01-01T00:00:00Z',...override});
test('legacy scores and self-report cannot create independent or mastered views',()=>{
  for(const evidence of ['legacy','self_reported'] as const){
    const view=projectTopicView(topic,projectConcept(key,[event({evidence,activity:evidence==='legacy'?'quiz':'flashcard',scaffoldUsed:null})]),'2026-01-02T00:00:00Z');
    assert.equal(view.canonical.stage,'practicing');assert.equal(view.mastery_score,25);assert.equal(view.status,'learning');
  }
  assert.equal(projectTopicView(topic,projectConcept(key,[]),'2026-01-02T00:00:00Z').status,'not_started');
});
test('Coach evidence supplies view and failed transfer reopens it across surface readers',()=>{
  const base=[event({challengeKind:'transfer',newContext:true,contextId:'new'})];
  const mastered=projectTopicView(topic,projectConcept(key,base),'2026-01-02T00:00:00Z');
  assert.equal(mastered.canonical.stage,'transfer');assert.equal(mastered.status,'mastered');
  const failed=projectTopicView(topic,projectConcept(key,[...base,event({id:'b',encounterId:'b',createdAt:'2026-01-02T00:00:00Z',challengeKind:'transfer',newContext:true,contextId:'different',result:'incorrect'})]),'2026-01-03T00:00:00Z');
  assert.equal(failed.status,'learning');assert.equal(failed.canonical.needsCheck,true);assert.equal(failed.mastery_score,25);
});
test('review-due condition is separate from independent evidence and source scope is checked',()=>{
  const projection=projectConcept(key,[event()]);
  const view=projectTopicView(topic,projection,'2026-01-02T00:00:00Z');
  assert.equal(view.canonical.stage,'independent');assert.equal(view.canonical.reviewDue,true);assert.equal(view.canonical.needsCheck,false);
  assert.throws(()=>projectTopicView({...topic,room_id:'another-room'},projection,'2026-01-02T00:00:00Z'));
});
