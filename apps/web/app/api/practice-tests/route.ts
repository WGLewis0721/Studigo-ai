import { generateQuizQuestions } from '@studigo/ai';
import { requireApiUser } from '@/lib/auth';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { assertRoomAccess, markersToCitations, retrieveForRoom } from '@/lib/retrieval';
import { allocateTestQuestions } from '@/lib/study-planning';
import { readConfidence, readSelectedChoice } from '@/lib/grading';
import { TOPIC_COLUMNS, type Topic } from '@/lib/rooms';
export const runtime='nodejs';
export const maxDuration=300;
const SAFE_QUESTION_COLUMNS='id,kind,prompt,choices,difficulty,topic_id,test_position';
/** Starts with short answer so the opening question cannot be guessed. */
const TEST_KIND_ROTATION=['short_answer','multiple_choice','fill_blank','true_false','multiple_choice'] as const;

export async function GET(request: Request) {
  const {supabase,user,unauthorized}=await requireApiUser(); if(!user) return unauthorized;
  const url=new URL(request.url); const testId=url.searchParams.get('testId'); const roomId=url.searchParams.get('roomId');
  if(testId) {
    const {data:test,error}=await supabase.from('practice_tests').select('*').eq('id',testId).maybeSingle();
    if(error||!test) return Response.json({error:'Practice test not found.'},{status:404});
    const {data:questions,error:questionError}=await supabase.from('quiz_questions').select(SAFE_QUESTION_COLUMNS).eq('practice_test_id',test.id).order('test_position');
    if(questionError) return Response.json({error:'Could not load test questions.'},{status:500});
    return Response.json({test,questions});
  }
  if(!roomId) return Response.json({error:'A room is required.'},{status:400});
  const {data:tests,error}=await supabase.from('practice_tests').select('id,title,status,created_at,submitted_at,result,topic_snapshot').eq('room_id',roomId).order('created_at',{ascending:false}).limit(10);
  if(error) return Response.json({error:'Could not load practice tests.'},{status:500});
  return Response.json({tests:tests??[]});
}

export async function POST(request: Request) {
  const {supabase,user,unauthorized}=await requireApiUser(); if(!user) return unauthorized;
  const body=await request.json().catch(()=>null);
  if(typeof body?.roomId!=='string' || ![6,10,15,20].includes(body?.count)) return Response.json({error:'Choose a room and test length.'},{status:400});
  const room=await assertRoomAccess(supabase,body.roomId); if(!room) return Response.json({error:'Study Room not found.'},{status:404});
  const {data:rows,error}=await supabase.from('topics').select(TOPIC_COLUMNS).eq('room_id',body.roomId).eq('active',true);
  if(error) return Response.json({error:'Could not load the current study scope.'},{status:500});
  const topics=(rows??[]) as Topic[];
  if(topics.length<2) return Response.json({error:'A full practice test needs at least two study topics. Add your study guide or use Quiz for one topic.'},{status:422});
  const allocation=allocateTestQuestions(topics,body.count);
  try {
    const questions: Array<Record<string,unknown>>=[];
    // Two at a time bounds model pressure while preserving deterministic positions.
    for(let offset=0;offset<allocation.length;offset+=2) {
      const batches=await Promise.all(allocation.slice(offset,offset+2).map(async({topic,count},index)=>{
        const chunks=await retrieveForRoom({supabase,roomId:body.roomId,query:`${topic.title}. ${topic.objective??''}`,matchCount:8});
        if(!chunks.length) throw new Error(`Add supporting material for “${topic.title}” before testing it.`);
        // Rotate the format per topic so one test exercises recognition,
        // recall and explanation rather than twenty of the same shape.
        const kind=TEST_KIND_ROTATION[(offset+index)%TEST_KIND_ROTATION.length];
        const generated=(await generateQuizQuestions({chunks,topicTitle:topic.title,objective:topic.objective??undefined,count,kind})).filter(q=>q.kind===kind&&q.sourceMarkers.length>0).slice(0,count);
        if(generated.length!==count) throw new Error(`Could not produce enough grounded questions for “${topic.title}”. Try again.`);
        return generated.map(q=>({topic_id:topic.id,kind:q.kind,prompt:q.prompt,choices:q.choices,correct_choice:q.correctChoice,
          expected_answer:q.expectedAnswer,accepted_answers:q.acceptedAnswers,explanation:q.explanation,difficulty:q.difficulty,citations:markersToCitations(q.sourceMarkers,chunks)}));
      }));
      questions.push(...batches.flat());
    }
    const {data:testId,error:saveError}=await createServiceSupabaseClient().rpc('create_practice_test',{
      p_room_id:body.roomId,p_owner_id:user.id,
      p_topics:allocation.map(a=>({id:a.topic.id,title:a.topic.title,objective:a.topic.objective,priority:a.topic.priority,questions:a.count})),p_questions:questions
    });
    if(saveError||!testId) throw new Error('The test could not be saved. The study scope may have changed; try again.');
    return Response.json({testId,coveredTopics:allocation.length,totalTopics:topics.length},{status:201});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Could not build the test.'},{status:422}); }
}

/** Autosave only responses, never scores or answer keys. */
export async function PATCH(request: Request) {
  const {supabase,user,unauthorized}=await requireApiUser(); if(!user) return unauthorized;
  const body=await request.json().catch(()=>null);
  if(typeof body?.testId!=='string'||!body.answers||typeof body.answers!=='object') return Response.json({error:'Invalid draft.'},{status:400});
  const {data:owned}=await supabase.from('practice_tests').select('id,status').eq('id',body.testId).maybeSingle();
  if(!owned) return Response.json({error:'Test not found.'},{status:404});
  const {data:questions,error:questionError}=await supabase.from('quiz_questions').select('id,choices').eq('practice_test_id',owned.id);
  if(questionError||!questions?.length) return Response.json({error:'Could not load this draft.'},{status:500});
  const answers: Record<string,{selectedChoice:number|null;response:string;confidence:number|null}>={};
  for(const q of questions??[]) {
    const a=body.answers[q.id];
    if(a) answers[q.id]={selectedChoice:readSelectedChoice(a.selectedChoice,q),
      response:typeof a.response==='string'?a.response.slice(0,4000):'',
      confidence:readConfidence(a.confidence)};
  }
  const {data:saved,error}=await createServiceSupabaseClient().from('practice_tests').update({draft_answers:answers}).eq('id',owned.id).eq('owner_id',user.id).eq('status','draft').select('id').maybeSingle();
  if(error||!saved) return Response.json({error:'This draft could not be saved. Reload the test.'},{status:409});
  return Response.json({saved:true});
}
