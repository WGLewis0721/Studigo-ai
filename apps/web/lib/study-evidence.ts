import { createServerSupabaseClient } from './supabase/server';
import type { PracticeEvidence, PlanEvent } from './study-planning';
export async function loadStudyEvidence(roomId: string) {
  const supabase=await createServerSupabaseClient();
  const [attempts,events]=await Promise.all([
    supabase.from('quiz_attempts').select('topic_id,source,score,is_correct,created_at,confidence').eq('room_id',roomId).order('created_at',{ascending:false}).limit(1000),
    supabase.from('study_plan_events').select('plan_day,action_key,status').eq('room_id',roomId).gte('plan_day',new Date(Date.now()-7*86400000).toISOString().slice(0,10))
  ]);
  if(attempts.error||events.error) throw new Error('Could not load your recent practice evidence.');
  return {evidence:(attempts.data??[]) as PracticeEvidence[],planEvents:(events.data??[]) as PlanEvent[],asOf:Date.now()};
}
