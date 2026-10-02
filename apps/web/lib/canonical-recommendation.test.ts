import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderCanonicalTopics } from './canonical-recommendation';
import { buildCramPlan, rankWeakAreas } from './study-planning';
import type { Topic } from './rooms';
const now=Date.parse('2026-01-02T00:00:00Z');
const topic=(id:string,stage:NonNullable<Topic['canonical']>['stage'],extra:Partial<Topic>={}):Topic=>({id,room_id:'room',title:id,objective:null,key_terms:[],priority:50,order_index:0,origin:'study_guide',mastery_score:100,status:'mastered',last_practiced_at:null,learner_edited:false,
  canonical:{schemaVersion:1,revision:1,stage,reviewDue:false,needsCheck:false,dueAt:null,rematchAt:null,supported:true,reasoningLevel:1,scaffoldLevel:0},...extra});
test('Weak Areas and study scheduling share due-first ordering independent of display scores',()=>{
  const fresh=topic('fresh','not_checked',{priority:100}),due=topic('due','independent',{priority:1});
  due.canonical!.dueAt='2026-01-01T00:00:00Z';due.canonical!.reviewDue=true;
  const first=orderCanonicalTopics([fresh,due],'study',now).map(t=>t.id);
  assert.deepEqual(first,['due','fresh']);assert.deepEqual(rankWeakAreas([fresh,due],[],now).map(a=>a.topic.id),first);
  due.mastery_score=0;fresh.mastery_score=0;assert.deepEqual(orderCanonicalTopics([fresh,due],'study',now).map(t=>t.id),first);
  assert.ok(rankWeakAreas([fresh,due],[],now).every(a=>!a.reasons.some(r=>r.includes('%'))));
});
test('Cram uses teacher coverage ordering and excludes missing supporting sources',()=>{
  const teacher=topic('teacher','not_checked'),nonTeacher=topic('other','independent',{origin:'manual',priority:100}),unsupported=topic('unsupported','not_checked',{priority:100});
  unsupported.canonical!.supported=false;nonTeacher.canonical!.dueAt='2026-01-01T00:00:00Z';
  const topics=[nonTeacher,unsupported,teacher];
  assert.deepEqual(orderCanonicalTopics(topics,'cram',now).map(t=>t.id),['teacher','other']);
  assert.equal(buildCramPlan([],topics,15,null,now)[0].topicId,'teacher');
});
test('stable ties use topic order then ID and missing canonical state cannot fall back to weights',()=>{
  assert.deepEqual(orderCanonicalTopics([topic('b','practicing'),topic('a','practicing')],'study',now).map(t=>t.id),['a','b']);
  const missing=topic('missing','practicing');delete missing.canonical;
  assert.throws(()=>orderCanonicalTopics([missing],'study',now),/Missing canonical/);
});
