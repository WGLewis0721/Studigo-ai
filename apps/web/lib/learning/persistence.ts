import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLearningEvent, replayLearningEvents } from './reducer';
import type { ConceptKey, LearningEvent } from './types';

export type ExistingAttempt = {
  id: string; owner_id: string; room_id: string; topic_id: string;
  source: 'quiz' | 'flashcard'; score: number; is_correct: boolean;
  created_at: string; question_id: string | null; question_kind: string | null;
  practice_test_id: string | null;
};

/** Preserve missing evidence as missing. Question format is not proof of transfer. */
export function fromExistingAttempt(row: ExistingAttempt): LearningEvent {
  const card = row.source === 'flashcard';
  return {
    id: `attempt:${row.id}`, userId: row.owner_id, roomId: row.room_id, topicId: row.topic_id,
    encounterId: row.question_id ?? `attempt:${row.id}`,
    activity: card ? 'flashcard' : row.practice_test_id ? 'practice_test' : 'quiz',
    challengeKind: ['multiple_choice','true_false'].includes(row.question_kind ?? '') ? 'recognize' : 'recall',
    result: row.is_correct ? 'correct' : Number(row.score) >= 45 ? 'partial' : 'incorrect',
    scaffoldUsed: null, evidence: card ? 'self_reported' : 'legacy',
    contextId: null, newContext: false, misconceptionId: null, createdAt: row.created_at
  };
}

export function toObservationRow(event: LearningEvent) {
  assertLearningEvent(event);
  if (['quiz','practice_test','flashcard'].includes(event.activity) || event.evidence === 'legacy') {
    throw new Error('Use the authoritative attempt table for this activity');
  }
  return { id: event.id, owner_id: event.userId, room_id: event.roomId, topic_id: event.topicId,
    encounter_id: event.encounterId, activity: event.activity, challenge_kind: event.challengeKind,
    result: event.result, scaffold_used: event.scaffoldUsed, evidence: event.evidence,
    context_id: event.contextId, new_context: event.newContext, misconception_id: event.misconceptionId,
    created_at: new Date(event.createdAt).toISOString() };
}
type ObservationRow = ReturnType<typeof toObservationRow>;
export function fromObservationRow(row: ObservationRow): LearningEvent {
  const event: LearningEvent = { id: `observation:${row.id}`, userId: row.owner_id, roomId: row.room_id,
    topicId: row.topic_id, encounterId: `observation:${row.encounter_id}`, activity: row.activity,
    challengeKind: row.challenge_kind, result: row.result, scaffoldUsed: row.scaffold_used,
    evidence: row.evidence, contextId: row.context_id, newContext: row.new_context,
    misconceptionId: row.misconception_id, createdAt: row.created_at };
  assertLearningEvent(event);
  return event;
}

/** User-scoped client required. Failure must never masquerade as an empty history. */
export async function loadConceptLearningState(supabase: SupabaseClient, key: ConceptKey) {
  const { data, error } = await supabase.rpc('read_concept_learning_history', {
    p_room_id: key.roomId, p_topic_id: key.topicId
  });
  if (error || !data || !Array.isArray(data.attempts) || !Array.isArray(data.observations)) {
    throw new Error('Could not load learning history');
  }
  const events = [
    ...(data.attempts as ExistingAttempt[]).map(fromExistingAttempt),
    ...(data.observations as ObservationRow[]).map(fromObservationRow)
  ];
  const state = replayLearningEvents(key, events);
  return { state, events };
}

/** Call only after server grading and an RLS ownership check. Reuse ALL fields
 * on a transport retry, including timestamp and interaction/encounter IDs. */
export async function recordLearningEvent(service: SupabaseClient, event: LearningEvent): Promise<void> {
  const { error, data } = await service.rpc('record_learning_event', { p_event: toObservationRow(event) });
  if (error || !data) throw new Error('Learning observation did not save; retry the same interaction');
}
