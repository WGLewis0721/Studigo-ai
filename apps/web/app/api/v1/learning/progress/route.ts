import { requireApiUser } from '@/lib/auth';
import { assertRoomAccess } from '@/lib/retrieval';
import { loadConceptLearningState } from '@/lib/learning/persistence';
import { loadUsableSessionDocuments } from '@/lib/learning/session-service';
import { projectConcept,planSession,type SessionConcept } from '@studigo/learning';
export const runtime='nodejs';
/** Native/browser clients read canonical evidence, not a client-supplied mastery percentage. */
export async function GET(request:Request) {
  const {supabase,user,unauthorized}=await requireApiUser();if(!user)return unauthorized;
  const url=new URL(request.url),roomId=url.searchParams.get('roomId');
  if(!roomId||!await assertRoomAccess(supabase,roomId))return Response.json({error:'Study Room not found'},{status:404});
  try {
    const {data,error}=await supabase.from('topics').select('id,title,objective,priority,order_index,origin,source_document_ids').eq('room_id',roomId).eq('active',true).order('order_index');
    if(error||!data||data.length>200)throw new Error('Invalid study scope');
    const ready=await loadUsableSessionDocuments(supabase,roomId);const concepts:SessionConcept[]=[];
    for(let offset=0;offset<data.length;offset+=8)concepts.push(...await Promise.all(data.slice(offset,offset+8).map(async topic=>{
      const key={userId:user.id,roomId,topicId:topic.id};const {events}=await loadConceptLearningState(supabase,key);
      return {key,title:topic.title,objective:topic.objective??topic.title,priority:topic.priority,order:topic.order_index,teacherScoped:topic.origin==='study_guide',active:true,
        supported:topic.source_document_ids?.length?topic.source_document_ids.some((id:string)=>ready.has(id)):ready.size>0,projection:projectConcept(key,events)};
    })));
    const now=new Date().toISOString();const plan=planSession({concepts,mode:'study',budgetMinutes:30,elapsedSeconds:0,now});
    return Response.json({schemaVersion:1,asOf:now,plan,concepts:concepts.map(c=>({topicId:c.key.topicId,title:c.title,revision:c.projection.revision,stage:c.projection.stage,
      needsCheck:c.projection.needsCheck,reviewAt:c.projection.review.dueAt,reviewDue:Boolean(c.projection.review.dueAt&&Date.parse(c.projection.review.dueAt)<=Date.parse(now)),reasoningLevel:c.projection.state.reasoningLevel,scaffoldLevel:c.projection.state.scaffoldLevel}))},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Could not read canonical learning progress.'},{status:503});}
}
