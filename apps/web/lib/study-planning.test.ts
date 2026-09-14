import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateTestQuestions, buildCramPlan, buildStudyPlan, rankWeakAreas, summarizeCalibration, type PracticeEvidence } from './study-planning';
import type { Topic } from './rooms';
const now=Date.parse('2026-09-12T12:00:00Z');
const topic=(id:string,overrides:Partial<Topic>={}):Topic=>({id,room_id:'room',title:id,objective:null,key_terms:[],priority:50,order_index:0,origin:'study_guide',mastery_score:0,status:'not_started',last_practiced_at:null,learner_edited:false,...overrides});
const attempt=(topic_id:string,source:'quiz'|'flashcard',score:number,confidence:number|null=null):PracticeEvidence=>({topic_id,source,score,is_correct:score>=70,created_at:'2026-09-12T10:00:00Z',confidence});
test('Weak Areas names missing evidence and prioritizes teacher scope without awarding mastery',()=>{
  const topics=[topic('low'),topic('high',{priority:100})];
  const areas=rankWeakAreas(topics,[],now);
  assert.equal(areas[0].topic.id,'high');assert.equal(areas[0].recommendation,'learn');
  assert.match(areas[0].reasons.join(' '),/Not practiced yet/);assert.equal(topics[1].mastery_score,0);
});
test('Quiz misses and self-reported recall recommend different actions',()=>{
  const t=topic('a',{mastery_score:60,status:'learning',last_practiced_at:'2026-09-12T10:00:00Z'});
  assert.equal(rankWeakAreas([t],[attempt('a','flashcard',0)],now)[0].recommendation,'cards');
  const result=rankWeakAreas([t],[attempt('a','quiz',0),attempt('a','flashcard',0)],now)[0];
  assert.equal(result.recommendation,'quiz');assert.equal(result.recentMisses,1);assert.match(result.reasons.join(' '),/self-reported/);
});
test('Fresh strong topics leave the weak list; stale recall returns without erasing earned mastery',()=>{
  const t=topic('a',{mastery_score:95,status:'mastered',last_practiced_at:'2026-09-12T10:00:00Z'});
  assert.equal(rankWeakAreas([t],[],now).length,0);
  assert.equal(rankWeakAreas([{...t,last_practiced_at:'2026-09-01T10:00:00Z'}],[],now)[0].label,'Recall check');
  assert.equal(t.mastery_score,95);
});
test('Test allocation covers every affordable topic before priority-weighted extras',()=>{
  const result=allocateTestQuestions([topic('low',{priority:10}),topic('high',{priority:100}),topic('middle')],10);
  assert.equal(result.length,3);assert.equal(result.reduce((n,a)=>n+a.count,0),10);
  assert.ok(result.find(a=>a.topic.id==='high')!.count>result.find(a=>a.topic.id==='low')!.count);
  assert.equal(allocateTestQuestions([topic('low'),topic('high',{priority:100})],1)[0].topic.id,'high');
});
test('Every Cram duration fits its exact budget and reuses the three existing learning modes',()=>{
  const topics=Array.from({length:10},(_,i)=>topic(String(i)));
  for(const minutes of [15,30,60,120]) {
    const plan=buildCramPlan(rankWeakAreas(topics,[],now),topics,minutes);
    assert.equal(plan.reduce((n,a)=>n+a.minutes,0),minutes);assert.ok(plan.every(a=>a.minutes>0));
    assert.deepEqual([...new Set(plan.map(a=>a.mode))],['learn','quiz','cards']);
  }
  assert.deepEqual(buildCramPlan([],[],30),[]);
});
test('Study plan responds to test date, completion, skips, and improved performance',()=>{
  const topics=[topic('a',{priority:100}),topic('b')];
  const args={topics,areas:rankWeakAreas(topics,[],now),testDate:null,cardsDue:3,events:[],now};
  const initial=buildStudyPlan(args);assert.equal(initial[0].actions[0].topicId,'a');assert.ok(initial[0].actions.some(a=>a.mode==='cards'));
  const skipped=buildStudyPlan({...args,events:[{plan_day:'2026-09-12',action_key:'learn:a',status:'skipped'}]});
  assert.ok(!skipped[0].actions.some(a=>a.key==='learn:a'));assert.ok(skipped[1].actions.some(a=>a.key==='learn:a'));
  const improved=[{...topics[0],mastery_score:100,status:'mastered' as const,last_practiced_at:'2026-09-12T10:00:00Z'},topics[1]];
  assert.equal(buildStudyPlan({...args,topics:improved,areas:rankWeakAreas(improved,[],now)})[0].actions[0].topicId,'b');
  const imminent=buildStudyPlan({...args,testDate:'2026-09-13'});
  assert.equal(imminent[0].actions[0].mode,'test');assert.equal(imminent[1].actions[0].mode,'cram');
  assert.deepEqual(buildStudyPlan({...args,testDate:'2026-09-11'}),[]);
  const completed=buildStudyPlan({...args,events:[{plan_day:'2026-09-12',action_key:'learn:a',status:'completed'}]});
  assert.ok(!completed[0].actions.some(a=>a.key==='learn:a'));assert.equal(topics[0].mastery_score,0);
});

test('A confident wrong answer is ranked as a blind spot, above an ordinary gap',()=>{
  const topics=[topic('gap',{mastery_score:50,status:'learning',last_practiced_at:'2026-09-12T10:00:00Z'}),
    topic('blind',{mastery_score:50,status:'learning',last_practiced_at:'2026-09-12T10:00:00Z'})];
  const areas=rankWeakAreas(topics,[
    attempt('gap','quiz',0,2),
    attempt('blind','quiz',0,3)
  ],now);
  const blind=areas.find(a=>a.topic.id==='blind');
  const gap=areas.find(a=>a.topic.id==='gap');
  assert.equal(areas[0].topic.id,'blind');
  assert.equal(blind?.blindSpots,1);
  assert.equal(gap?.blindSpots,0);
  assert.equal(blind?.label,'Blind spot');
  assert.ok((blind?.urgency??0)>(gap?.urgency??0));
  assert.match(blind?.reasons.join(' ')??'',/blind spot/i);
});

test('A mastered topic answered wrongly while confident is still surfaced',()=>{
  const topics=[topic('mastered',{mastery_score:90,status:'mastered',last_practiced_at:'2026-09-12T10:00:00Z'})];
  assert.equal(rankWeakAreas(topics,[attempt('mastered','quiz',0,3)],now).length,1);
});

test('Calibration stays silent until there is enough rated evidence',()=>{
  const summary=summarizeCalibration([attempt('a','quiz',100,3),attempt('a','quiz',100,3)]);
  assert.equal(summary.label,'Not enough data');
  assert.equal(summary.accuracy,null);
  assert.equal(summary.reported,2);
});

test('Being sure and wrong reads as overconfident; guessing right reads as underconfident',()=>{
  const over=summarizeCalibration([
    attempt('a','quiz',0,3),attempt('a','quiz',0,3),attempt('a','quiz',100,3),attempt('a','quiz',100,3)
  ]);
  assert.equal(over.label,'Overconfident');
  assert.equal(over.blindSpots,2);
  assert.match(over.summary,/without your notes/);

  const under=summarizeCalibration([
    attempt('a','quiz',100,1),attempt('a','quiz',100,1),attempt('a','quiz',100,3),attempt('a','quiz',100,3)
  ]);
  assert.equal(under.label,'Underconfident');
  assert.equal(under.underconfident,2);
});

test('Accurate self-reading scores higher than confident guessing',()=>{
  const calibrated=summarizeCalibration([
    attempt('a','quiz',100,3),attempt('a','quiz',100,3),attempt('a','quiz',0,1),attempt('a','quiz',0,1)
  ]);
  const miscalibrated=summarizeCalibration([
    attempt('a','quiz',0,3),attempt('a','quiz',0,3),attempt('a','quiz',100,1),attempt('a','quiz',100,1)
  ]);
  assert.equal(calibrated.label,'Well calibrated');
  assert.ok((calibrated.accuracy??0)>(miscalibrated.accuracy??100));
});

test('Unrated and flashcard evidence is excluded from calibration',()=>{
  const summary=summarizeCalibration([
    attempt('a','quiz',100),attempt('a','quiz',0),attempt('a','flashcard',100,3),attempt('a','flashcard',0,3)
  ]);
  assert.equal(summary.reported,0);
  assert.equal(summary.label,'Not enough data');
});
