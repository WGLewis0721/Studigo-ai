import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {operateDurableSession, type DurableSession} from './learning/durable-session';
import {sessionOperation} from './durable-session-policy';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const user=id(1),room=id(2),topic=id(3),sessionId=id(4),requestId=id(5),doc=id(6);
const now='2026-10-02T12:00:00Z';
const plan={schemaVersion:1 as const,policyVersion:'session-1' as const,mode:'study' as const,budgetMinutes:30 as const,status:'ready' as const,topicId:topic,activity:'coach' as const,stateRevision:0,reasons:['cover_teacher_scope'],offerTopicChange:false};
const stored:DurableSession={id:sessionId,owner_id:user,room_id:room,revision:0,mode:'study',minutes:30,selected_topic_id:null,plan,ended:false,started_at:'2026-10-02T11:00:00Z',updated_at:now};
const operation=(action='recommend',extra={})=>sessionOperation({roomId:room,sessionId,requestId,expectedRevision:0,action,mode:'study',minutes:30,...extra});
function harness(snapshot:DurableSession|null=stored,receipt:unknown=null,usable=[doc]) {
 const writes:Record<string,unknown>[]=[];
 function query(data:unknown) {const q={select:()=>q,eq:()=>q,limit:()=>q,maybeSingle:async()=>({data,error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};return q;}
 const service={rpc:async(name:string,args:Record<string,unknown>)=>{
  if(name==='read_learning_session')return {data:{session:snapshot,now},error:null};
  writes.push(args);return {data:{...stored,plan:args.p_plan},error:null};
 },from:()=>query(receipt)} as unknown as SupabaseClient;
 const caller={from:()=>query([{id:topic,title:'Grounded topic',priority:100,order_index:0,origin:'study_guide',source_document_ids:[doc]}]),
  rpc:async(name:string)=>({data:name==='read_session_source_scope'?usable:{attempts:[],observations:[]},error:null})} as unknown as SupabaseClient;
 return {service,caller,writes};
}
test('durable scheduler uses stored database start and clock rather than browser duration',async()=>{
 const h=harness();await operateDurableSession(h.caller,h.service,user,operation());
 assert.equal((h.writes[0].p_plan as typeof plan).status,'complete');
 assert.equal(h.writes[0].p_owner,user);
 assert.equal(h.writes[0].p_selected,null);
 const fresh=harness(null);await operateDurableSession(fresh.caller,fresh.service,user,operation('start'));
 assert.equal((fresh.writes[0].p_plan as typeof plan).status,'ready');
});
test('durable exact retry returns immutable snapshot before source reads and rejects changed payload',async()=>{
 const op=operation('start');
 const fingerprint={owner:user,room,session:sessionId,revision:0,action:'start',mode:'study',minutes:30,selected:null};
 const h=harness(stored,{fingerprint,snapshot:stored},[]);
 assert.deepEqual(await operateDurableSession(h.caller,h.service,user,op),stored);assert.equal(h.writes.length,0);
 await assert.rejects(operateDurableSession(h.caller,h.service,user,operation('select')),(e:{code:string})=>e.code==='40001');
});
test('new recommendations exclude empty source material and stale actions never write',async()=>{
 const h=harness(null,null,[]);await operateDurableSession(h.caller,h.service,user,operation('start'));
 assert.equal((h.writes[0].p_plan as typeof plan).status,'empty');
 const stale=harness();await assert.rejects(operateDurableSession(stale.caller,stale.service,user,operation('recommend',{expectedRevision:1})),(e:{code:string})=>e.code==='40001');
 assert.equal(stale.writes.length,0);
});
test('end remains available after source removal; clearing explicit topic restores automatic selection',async()=>{
 const ended=harness(stored,null,[]);await operateDurableSession(ended.caller,ended.service,user,operation('end'));
 assert.equal((ended.writes[0].p_plan as typeof plan).status,'complete');
 const selected=harness({...stored,selected_topic_id:id(999),started_at:now});
 await operateDurableSession(selected.caller,selected.service,user,operation('select',{selectedTopicId:null}));
 assert.equal((selected.writes[0].p_plan as typeof plan).topicId,topic);
});
