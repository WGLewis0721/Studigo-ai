import type { SupabaseClient } from '@supabase/supabase-js';
import { projectConcept, type ConceptProjection } from '@studigo/learning';
import { loadConceptLearningState } from './learning/persistence';
import { loadUsableSessionDocuments } from './learning/session-service';

export type CanonicalTopicEvidence = {
  schemaVersion: 1; revision: number; stage: ConceptProjection['stage'];
  reviewDue: boolean; needsCheck: boolean; dueAt: string | null;
  reasoningLevel: number; scaffoldLevel: number;
  rematchAt: string | null; supported: boolean;
};
type TopicRow = { id:string;room_id:string;mastery_score:number;status:string;last_practiced_at:string|null };
/** Existing presentation accepts a number. It is a compatibility index, never a policy input. */
export function projectTopicView<T extends TopicRow>(topic:T, projection:ConceptProjection, now:string,supported=true) {
  if(topic.id!==projection.state.topicId||topic.room_id!==projection.state.roomId||!Number.isFinite(Date.parse(now)))throw new Error('Invalid canonical topic scope');
  const dueAt=projection.review.dueAt;
  const canonical:CanonicalTopicEvidence={schemaVersion:1,revision:projection.revision,stage:projection.stage,
    reviewDue:dueAt!==null&&Date.parse(dueAt)<=Date.parse(now),needsCheck:projection.needsCheck,dueAt,
    reasoningLevel:projection.state.reasoningLevel,scaffoldLevel:projection.state.scaffoldLevel,
    rematchAt:projection.state.rematch?.dueAt??null,supported};
  const status:'not_started'|'learning'|'mastered'=projection.stage==='transfer'?'mastered':projection.stage==='not_checked'?'not_started':'learning';
  return {...topic,mastery_score:{not_checked:0,practicing:25,independent:60,transfer:100}[projection.stage],status,
    last_practiced_at:projection.state.lastPracticedAt,canonical};
}
/** Complete RLS history supplies the view. A failed read never falls back to inflated legacy mastery. */
export async function loadCanonicalTopicViews<T extends TopicRow>(args:{supabase:SupabaseClient;userId:string;roomId:string;topics:T[];now:string}) {
  if(args.topics.length>200||args.topics.some(t=>t.room_id!==args.roomId))throw new Error('Invalid canonical topic scope');
  const ready=await loadUsableSessionDocuments(args.supabase,args.roomId);
  const {data:links,error}=await args.supabase.from('topics').select('id, source_document_ids').eq('room_id',args.roomId).eq('active',true);
  if(error)throw new Error('Could not verify canonical source scope');
  const linked=new Map<string,string[]>((links??[]).map(t=>[t.id,t.source_document_ids??[]]));
  const result:Array<ReturnType<typeof projectTopicView<T>>>=[];
  for(let offset=0;offset<args.topics.length;offset+=8) {
    result.push(...await Promise.all(args.topics.slice(offset,offset+8).map(async topic=>{
      const key={userId:args.userId,roomId:args.roomId,topicId:topic.id};
      const {events}=await loadConceptLearningState(args.supabase,key);
      const sources=linked.get(topic.id)??[];
      return projectTopicView(topic,projectConcept(key,events),args.now,linked.has(topic.id)&&(sources.length?sources.some(id=>ready.has(id)):ready.size>0));
    })));
  }
  return result;
}
