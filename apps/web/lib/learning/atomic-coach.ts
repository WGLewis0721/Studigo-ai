import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachState, CoachEvaluation, GroundedAnswer } from '@studigo/ai';
import type { LearningEvent } from './types';
import { toObservationRow,fromObservationRow,loadConceptLearningState } from './persistence';
import { projectConcept } from '@studigo/learning';

export type AdaptiveCoachCommit={reader:SupabaseClient;writer:SupabaseClient;conversationId:string;userId:string;interactionId:string;expectedRevision:number;state:CoachState;events:LearningEvent[]};
export async function commitAdaptiveCoachTurn(args:AdaptiveCoachCommit & {answer:GroundedAnswer}) {
  const projections=await Promise.all([...new Set(args.events.map(e=>e.topicId))].map(async topicId=>{
    const key={userId:args.userId,roomId:args.events.find(e=>e.topicId===topicId)!.roomId,topicId};
    const {events}=await loadConceptLearningState(args.reader,key);
    return {topic_id:topicId,expected_revision:events.length,projection:projectConcept(key,[...events,...args.events.filter(e=>e.topicId===topicId).map(e=>fromObservationRow(toObservationRow(e)))])};
  }));
  const {data,error}=await args.writer.rpc('commit_adaptive_coach_response',{p_conversation_id:args.conversationId,p_owner_id:args.userId,p_interaction_id:args.interactionId,
    p_expected_revision:args.expectedRevision,p_state:args.state,p_events:args.events.map(toObservationRow),p_projections:projections,p_answer:args.answer});
  if(error||!data)throw new Error(error?.code==='40001'?'Your Coach session changed in another tab. Reload before answering.':'Could not commit this Coach turn. Retry the same interaction.');
  return data as {answer:GroundedAnswer;duplicate:boolean;revision:number};
}
/** The receipt is authoritative even after another question or source deletion. */
export async function readCommittedCoachAnswer(writer:SupabaseClient,userId:string,conversationId:string,interactionId:string):Promise<GroundedAnswer|null> {
  const {data,error}=await writer.from('adaptive_turn_receipts').select('answer').eq('interaction_id',interactionId).eq('owner_id',userId).eq('conversation_id',conversationId).maybeSingle();
  if(error)throw new Error('Could not load the committed Coach reply. Retry the same interaction.');
  if(!data)return null;
  if(!data.answer)throw new Error('This earlier turn has no saved reply. Resume the conversation with a new message.');
  return data.answer as GroundedAnswer;
}
export async function hasIssuedCoachEncounter(writer:SupabaseClient,userId:string,conversationId:string,encounterId:string):Promise<boolean> {
  const {data,error}=await writer.from('adaptive_encounters').select('id').eq('id',encounterId).eq('owner_id',userId).eq('conversation_id',conversationId).maybeSingle();
  if(error)throw new Error('Could not verify the pending Coach encounter. Please retry.');
  return Boolean(data);
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
