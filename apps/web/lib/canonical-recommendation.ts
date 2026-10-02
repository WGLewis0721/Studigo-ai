import { initialLearningState, orderSessionConcepts, type SessionConcept } from '@studigo/learning';
import type { Topic } from './rooms';
/** Read-only compatibility adapter; the shared scheduler supplies all ordering. */
export function orderCanonicalTopics(topics:Topic[],mode:'study'|'cram',now:number):Topic[] {
  if(topics.some(t=>!t.canonical))throw new Error('Missing canonical topic evidence');
  const concepts:SessionConcept[]=topics.map(topic=>{
    const c=topic.canonical!,key={userId:'canonical-view',roomId:topic.room_id,topicId:topic.id};
    const state={...initialLearningState(key),lastPracticedAt:topic.last_practiced_at,
      rematch:c.rematchAt?{dueAt:c.rematchAt,reason:'transfer_fail' as const,encounterId:'canonical-view',contextId:null,misconceptionId:null}:null};
    return {key,title:topic.title,objective:topic.objective??topic.title,priority:topic.priority,order:topic.order_index,
      active:true,supported:c.supported,teacherScoped:topic.origin==='study_guide',
      projection:{revision:c.revision,state,review:{step:0,dueAt:c.dueAt},stage:c.stage,needsCheck:c.needsCheck}};
  });
  const byId=new Map(topics.map(t=>[t.id,t]));
  return orderSessionConcepts(concepts,mode,new Date(now).toISOString()).map(c=>byId.get(c.key.topicId)!);
}
