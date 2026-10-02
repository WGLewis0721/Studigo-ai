import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {runCoachTurn} from './coach-router';
import {recoverCoachConversation,InteractionConflictError} from './coach-interaction';
import {learningControlPlaneDirector} from './coach-director';
import {toObservationRow} from './learning/persistence';
import type {LearningEvent} from './learning';
import type {Topic} from './rooms';
import {nextChallenge,initialLearningState} from '@studigo/learning';
import {createHash} from 'node:crypto';
const interaction={id:'10000000-0000-4000-8000-000000009101',createdAt:'2026-10-02T00:00:00Z'};
const answer={text:'The original committed question [1]',citations:[{marker:1,chunkId:'chunk',documentId:'doc',documentName:'Source',pageNumber:1,pageLabel:'page'}],grounded:true};
function rows(tableRows:Record<string,{data:unknown;error:unknown}>):SupabaseClient {
  return {from:(table:string)=>{
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>tableRows[table]??{data:null,error:null}};
    return query;
  }} as unknown as SupabaseClient;
}
async function collect(args:Parameters<typeof runCoachTurn>[0]) {
  const events=[];const generator=runCoachTurn(args);let next=await generator.next();
  while(!next.done){events.push(next.value);next=await generator.next();}return events;
}
test('an old atomic retry returns its original answer without consulting current pending state',async()=>{
  const original=process.env.STUDIGO_ATOMIC_COACH;process.env.STUDIGO_ATOMIC_COACH='1';
  try {
    const writer=rows({adaptive_turn_receipts:{data:{answer},error:null}});
    const reader={from:()=>{throw new Error('Current encounter must not be read');}} as unknown as SupabaseClient;
    const events=await collect({supabase:reader,stateSupabase:writer,userId:'learner',roomId:'room',conversationId:'conv',interaction,question:'original answer',topics:[]});
    assert.deepEqual(events,[{type:'delta',text:answer.text},{type:'done',answer,responseStored:true}]);
  }finally{if(original===undefined)delete process.env.STUDIGO_ATOMIC_COACH;else process.env.STUDIGO_ATOMIC_COACH=original;}
});
test('atomic reply is not published before the response transaction succeeds',async()=>{
  const original=process.env.STUDIGO_ATOMIC_COACH;process.env.STUDIGO_ATOMIC_COACH='1';
  try {
    const writer=rows({});Object.assign(writer,{rpc:async()=>({data:null,error:{code:'40001'}})});
    const reader=rows({conversations:{data:{coach_state:{version:1,kind:'awaiting_control',action:'more_practice',topicId:null,sourceChunkIds:[]},learning_revision:3},error:null}});
    const generator=runCoachTurn({supabase:reader,stateSupabase:writer,userId:'learner',roomId:'room',conversationId:'conv',interaction,question:'no',topics:[]});
    await assert.rejects(generator.next(),/changed in another tab/);
  }finally{if(original===undefined)delete process.env.STUDIGO_ATOMIC_COACH;else process.env.STUDIGO_ATOMIC_COACH=original;}
});
test('a missing first-turn SSE recovers the existing owned conversation and rejects conflicting reuse',async()=>{
  const supabase=rows({messages:{data:{conversation_id:'conv',role:'user',content:'start'},error:null},conversations:{data:{id:'conv'},error:null}});
  assert.equal(await recoverCoachConversation({supabase,interactionId:interaction.id,roomId:'room',content:'start'}),'conv');
  await assert.rejects(recoverCoachConversation({supabase,interactionId:interaction.id,roomId:'room',content:'changed'}),InteractionConflictError);
  const noScope=rows({messages:{data:{conversation_id:'conv',role:'user',content:'start'},error:null}});
  await assert.rejects(recoverCoachConversation({supabase:noScope,interactionId:interaction.id,roomId:'other',content:'start'}),InteractionConflictError);
});
test('a skipped pending task participates in the spec issued by the same atomic turn',async()=>{
  const failure:LearningEvent={id:'failure',encounterId:'old',userId:'learner',roomId:'room',topicId:'topic',activity:'coach',challengeKind:'recall',result:'partial',scaffoldUsed:0,evidence:'assessed',contextId:null,newContext:false,misconceptionId:null,createdAt:'2026-10-01T00:00:00Z'};
  const skip={...failure,id:'skip',result:'skipped' as const,createdAt:interaction.createdAt};
  const reader={rpc:async()=>({data:{attempts:[],observations:[toObservationRow(failure)]},error:null})} as unknown as SupabaseClient;
  const spec=await learningControlPlaneDirector.challengeFor({supabase:reader,userId:'learner',roomId:'room',topic:{id:'topic',title:'Grounded topic',objective:null} as Topic,
    route:'studigo_default',challengeRequest:'normal',now:interaction.createdAt,pendingEvents:[skip]});
  assert.equal(spec.stateRevision,2);assert.equal(spec.action,'practice');assert.equal(spec.reasons[0],'last_skipped');
});
test('activation invalidates a historical unverified pending task without grading it',async()=>{
  const original=process.env.STUDIGO_ATOMIC_COACH;process.env.STUDIGO_ATOMIC_COACH='1';
  try {
    const pending={version:1,kind:'awaiting_answer',question:'Earlier question',topicId:'topic',expectedConcepts:[{id:'idea',description:'Idea',weight:1,critical:true}],sourceChunkIds:['chunk'],askedAt:interaction.createdAt};
    const reader=rows({conversations:{data:{coach_state:pending,learning_revision:0},error:null}});
    let committed:Record<string,unknown>|null=null;
    const writer=rows({});Object.assign(writer,{rpc:async(_name:string,p:Record<string,unknown>)=>{committed=p;return {data:{answer:p.p_answer,revision:1,duplicate:false},error:null};}});
    const events=await collect({supabase:reader,stateSupabase:writer,userId:'learner',roomId:'room',conversationId:'conv',interaction,question:'my answer',topics:[{id:'topic'} as Topic],
      deps:{evaluateCoachAnswer:async()=>{throw new Error('Historical task must not be graded');}}});
    assert.match(events.find(e=>e.type==='delta')!.text,/no verified encounter/);
    assert.deepEqual((committed as unknown as Record<string,unknown>).p_events,[]);
    assert.equal(((committed as unknown as Record<string,unknown>).p_state as {kind:string}).kind,'idle');
  }finally{if(original===undefined)delete process.env.STUDIGO_ATOMIC_COACH;else process.env.STUDIGO_ATOMIC_COACH=original;}
});
test('a model control intent cannot omit the concept evidence required by the assessed answer path',async()=>{
  const original=process.env.STUDIGO_ATOMIC_COACH;process.env.STUDIGO_ATOMIC_COACH='1';
  try {
    const key={userId:'learner',roomId:'room',topicId:'topic'},chunk={id:'chunk',documentId:'doc',documentName:'Source',content:'Grounded idea',similarity:1};
    const spec=nextChallenge({concept:{...key,objective:'Recall an idea'},learnerState:initialLearningState(key),recentEvents:[],activity:'coach',route:'studigo_default',now:interaction.createdAt});
    const pending={version:1,kind:'awaiting_answer',question:'Recall the idea?',topicId:'topic',expectedConcepts:[{id:'idea',description:'Grounded idea',weight:1,critical:true}],sourceChunkIds:['chunk'],askedAt:interaction.createdAt,
      issuedChallenge:{spec,encounterId:'encounter',scaffoldUsed:0,contextId:null,sourceRevisions:[{id:'chunk',sha256:createHash('sha256').update(JSON.stringify(['doc',chunk.content,null])).digest('hex')}]}};
    const reader=rows({conversations:{data:{coach_state:pending,learning_revision:1},error:null}});
    const writer=rows({adaptive_encounters:{data:{id:'encounter'},error:null}});
    await assert.rejects(collect({supabase:reader,stateSupabase:writer,userId:'learner',roomId:'room',conversationId:'conv',interaction,question:'I think the idea is gravity',topics:[{id:'topic'} as Topic],
      deps:{fetchChunksByIds:async()=>[chunk],evaluateCoachAnswer:async()=>({intent:'conversation_control',concepts:[]}),generateCoachFeedback:async()=>{throw new Error('Invalid evaluation must not create feedback');}}}),/evaluator could not verify/);
  }finally{if(original===undefined)delete process.env.STUDIGO_ATOMIC_COACH;else process.env.STUDIGO_ATOMIC_COACH=original;}
});
