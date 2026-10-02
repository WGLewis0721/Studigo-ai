import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachState, CoachEvaluation } from '@studigo/ai';
import type { LearningEvent } from './types';
import { toObservationRow,fromObservationRow,loadConceptLearningState } from './persistence';
import { projectConcept } from '@studigo/learning';

export async function commitAdaptiveCoachTurn(args:{reader:SupabaseClient;writer:SupabaseClient;conversationId:string;userId:string;interactionId:string;expectedRevision:number;state:CoachState;events:LearningEvent[]}) {
  const projections=await Promise.all([...new Set(args.events.map(e=>e.topicId))].map(async topicId=>{
    const key={userId:args.userId,roomId:args.events.find(e=>e.topicId===topicId)!.roomId,topicId};
    const {events}=await loadConceptLearningState(args.reader,key);
    return {topic_id:topicId,expected_revision:events.length,projection:projectConcept(key,[...events,...args.events.filter(e=>e.topicId===topicId).map(e=>fromObservationRow(toObservationRow(e)))])};
  }));
  const {data,error}=await args.writer.rpc('commit_adaptive_coach_turn',{p_conversation_id:args.conversationId,p_owner_id:args.userId,p_interaction_id:args.interactionId,
    p_expected_revision:args.expectedRevision,p_state:args.state,p_events:args.events.map(toObservationRow),p_projections:projections});
  if(error||!data)throw new Error(error?.code==='40001'?'Your Coach session changed in another tab. Reload before answering.':'Could not commit this Coach turn. Retry the same interaction.');
  return data;
}
export async function readAcceptedEvaluation(supabase:SupabaseClient,interactionId:string):Promise<CoachEvaluation|null> {
  const {data,error}=await supabase.from('adaptive_semantic_evidence').select('evaluation').eq('interaction_id',interactionId).maybeSingle();
  if(error)throw new Error('Could not load accepted evaluation');return data?.evaluation??null;
}
export async function acceptEvaluation(args:{writer:SupabaseClient;userId:string;interactionId:string;encounterId:string;fingerprint:Record<string,unknown>;evaluation:CoachEvaluation}) {
  const {data,error}=await args.writer.rpc('accept_adaptive_semantic_evidence',{p_interaction_id:args.interactionId,p_encounter_id:args.encounterId,p_owner_id:args.userId,
    p_fingerprint:args.fingerprint,p_evaluation:args.evaluation,p_evaluator_version:'semantic-concepts-1'});
  if(error||!data)throw new Error('Could not persist semantic evaluation. Retry the same interaction.');return data as CoachEvaluation;
}
