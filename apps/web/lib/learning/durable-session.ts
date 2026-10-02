import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPlan } from '@studigo/learning';
import type { Topic } from '../rooms';
import { loadSessionRecommendation } from './session-service';
import type { SessionOperation } from '../durable-session-policy';
export type DurableSession={id:string;owner_id:string;room_id:string;revision:number;mode:SessionPlan['mode'];minutes:SessionPlan['budgetMinutes'];selected_topic_id:string|null;plan:SessionPlan;ended:boolean;started_at:string;updated_at:string};
export async function readDurableSession(service:SupabaseClient,userId:string,roomId:string,sessionId:string) {
  const result=await service.rpc('read_learning_session',{p_owner:userId,p_room:roomId,p_id:sessionId});
  if(result.error)throw result.error;
  return result.data as {session:DurableSession|null;now:string};
}
export async function operateDurableSession(caller:SupabaseClient,service:SupabaseClient,userId:string,op:SessionOperation) {
  const {session,now}=await readDurableSession(service,userId,op.roomId,op.sessionId);
  // An exact retry returns the original committed snapshot even when sources or evidence changed.
  const receipt=await service.from('learning_session_receipts').select('fingerprint,snapshot').eq('id',op.requestId).eq('owner_id',userId).maybeSingle();
  if(receipt.error)throw receipt.error;
  const fingerprint={owner:userId,room:op.roomId,session:op.sessionId,revision:op.expectedRevision,action:op.action,mode:op.mode,minutes:op.minutes,selected:op.selectedTopicId};
  if(receipt.data) {
    if(Object.keys(fingerprint).some(k=>receipt.data!.fingerprint[k]!==fingerprint[k as keyof typeof fingerprint]))throw {code:'40001'};
    return receipt.data.snapshot as DurableSession;
  }
  if(op.action!=='start'&&!session)throw {code:'P0002'};
  if(session&&(op.action==='start'||session.revision!==op.expectedRevision||session.ended||session.mode!==op.mode||session.minutes!==op.minutes))throw {code:'40001'};
  let plan:SessionPlan;
  if(op.action==='end') {
    plan={...session!.plan,status:'complete',topicId:null,reasons:['learner_ended_session'],offerTopicChange:false};
  }else {
    const topics=await caller.from('topics').select('id,title,objective,priority,order_index,origin').eq('room_id',op.roomId).eq('active',true).limit(201);
    if(topics.error)throw topics.error;
    const selected=op.action==='select'||op.action==='start'?op.selectedTopicId:session!.selected_topic_id;
    try {
      plan=await loadSessionRecommendation({supabase:caller,userId,roomId:op.roomId,topics:topics.data as Topic[],now,
        mode:op.mode,minutes:op.minutes,selectedTopicId:selected,
        elapsedSeconds:session?Math.max(0,(Date.parse(now)-Date.parse(session.started_at))/1000):0});
    }catch(error) {
      if(error instanceof Error && error.message==='Selected topic is not available')throw {code:'22023'};
      throw error;
    }
  }
  const committed=await service.rpc('commit_learning_session',{p_owner:userId,p_room:op.roomId,p_id:op.sessionId,p_request:op.requestId,
    p_expected:op.expectedRevision,p_action:op.action,p_mode:op.mode,p_minutes:op.minutes,p_selected:op.selectedTopicId,p_plan:plan});
  if(committed.error)throw committed.error;
  return committed.data as DurableSession;
}
