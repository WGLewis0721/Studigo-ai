import { gradeShortAnswer } from '@studigo/ai';
import { requireApiUser } from '@/lib/auth';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request: Request) {
  const {supabase,user,unauthorized}=await requireApiUser(); if(!user) return unauthorized;
  const body=await request.json().catch(()=>null);
  if(typeof body?.testId!=='string'||!body.answers||typeof body.answers!=='object') return Response.json({error:'Submit answers for the full test.'},{status:400});
  const {data:owned}=await supabase.from('practice_tests').select('id,status,result').eq('id',body.testId).maybeSingle();
  if(!owned) return Response.json({error:'Test not found.'},{status:404});
  if(owned.status==='submitted') return Response.json({result:owned.result});
  const service=createServiceSupabaseClient();
  const {data:questions,error}=await service.from('quiz_questions').select('*').eq('practice_test_id',owned.id).eq('owner_id',user.id).order('test_position');
  if(error||!questions?.length) return Response.json({error:'Could not load this test.'},{status:500});
  try {
    const grades: Array<Record<string,unknown>>=[];
    const answers: Record<string,unknown>={};
    for(let offset=0;offset<questions.length;offset+=3) {
      const batch=await Promise.all(questions.slice(offset,offset+3).map(async q=>{
        const a=body.answers[q.id];
        const response=typeof a?.response==='string'?a.response.trim().slice(0,4000):'';
        const selected=Number.isInteger(a?.selectedChoice)&&a.selectedChoice>=0&&a.selectedChoice<(q.choices?.length??0)?a.selectedChoice:null;
        answers[q.id]={response,selectedChoice:selected};
        let score=0,isCorrect=false,feedback='Unanswered. Review the explanation and try this concept again.';
        if(q.kind==='multiple_choice'&&selected!==null) { isCorrect=selected===q.correct_choice;score=isCorrect?100:0;feedback=q.explanation; }
        else if(q.kind==='short_answer'&&response) {
          const grade=await gradeShortAnswer({question:q.prompt,expectedAnswer:q.expected_answer??'',learnerAnswer:response});
          score=grade.score;isCorrect=grade.isCorrect;feedback=grade.feedback;
        }
        return {id:q.id,response,selected_choice:selected,score,is_correct:isCorrect,feedback};
      }));
      grades.push(...batch);
    }
    const {data:result,error:saveError}=await service.rpc('submit_practice_test',{p_test_id:owned.id,p_owner_id:user.id,p_grades:grades,p_answers:answers});
    if(saveError||!result) throw new Error('Your test has not been submitted. The study scope may have changed; reload before trying again.');
    return Response.json({result});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:'Grading did not finish. Your answers are still available.'},{status:500}); }
}
