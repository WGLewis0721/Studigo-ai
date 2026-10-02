import type { SupabaseClient } from '@supabase/supabase-js';
import { planSession, projectConcept, type SessionConcept } from '@studigo/learning';
import { loadConceptLearningState } from './persistence';
import type { Topic } from '../rooms';

export type SessionRequest = { supabase:SupabaseClient;userId:string;roomId:string;topics:Topic[];now:string;
  mode?:'study'|'cram';minutes?:15|30|60|120;selectedTopicId?:string|null;pendingTopicId?:string|null;elapsedSeconds?:number };
/** RLS-scoped, source-aware scheduling. All timestamps and evidence originate on the server. */
export async function loadSessionRecommendation(args:SessionRequest) {
  const {data:documents,error:documentError}=await args.supabase.from('documents').select('id').eq('room_id',args.roomId).eq('status','ready');
  const {data:links,error:linkError}=await args.supabase.from('topics').select('id, source_document_ids').eq('room_id',args.roomId).eq('active',true);
  if(documentError||linkError)throw new Error('Could not verify session source scope');
  const ready=new Set((documents??[]).map((d:{id:string})=>d.id));
  const linked=new Map<string,string[]>((links??[]).map((t:{id:string;source_document_ids:string[]|null})=>[t.id,t.source_document_ids??[]]));
  if(args.topics.length>200)throw new Error('This study scope exceeds the session scheduler limit');
  const concepts:SessionConcept[]=[];
  // Bound read concurrency rather than saturating the data API on large guides.
  for(let offset=0;offset<args.topics.length;offset+=8) {
    const group=await Promise.all(args.topics.slice(offset,offset+8).map(async topic=>{
      const key={userId:args.userId,roomId:args.roomId,topicId:topic.id};
      const {events}=await loadConceptLearningState(args.supabase,key);
      const ids=linked.get(topic.id)??[];
      return {key,title:topic.title,objective:topic.objective??topic.title,priority:topic.priority,order:topic.order_index,
        active:linked.has(topic.id),supported:ids.length?ids.some(id=>ready.has(id)):ready.size>0,
        teacherScoped:topic.origin==='study_guide',projection:projectConcept(key,events)} satisfies SessionConcept;
    }));concepts.push(...group);
  }
  return planSession({concepts,mode:args.mode??'study',budgetMinutes:args.minutes??30,elapsedSeconds:args.elapsedSeconds??0,
    now:args.now,selectedTopicId:args.selectedTopicId,pendingTopicId:args.pendingTopicId});
}
