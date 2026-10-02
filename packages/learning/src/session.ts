import { POLICY, replayLearningEvents } from './reducer';
import type { ConceptLearningState, ConceptKey, LearningActivity, LearningEvent } from './types';

const DAY = 86_400_000;
export const REVIEW_DAYS = [1, 3, 7, 14] as const;
export type ReviewState = { step: number; dueAt: string | null };
export type EvidenceStage = 'not_checked' | 'practicing' | 'independent' | 'transfer';
export const EVIDENCE_LABELS: Record<EvidenceStage, string> = {
  not_checked: 'Not yet checked', practicing: 'Practicing', independent: 'Independent', transfer: 'Transfer demonstrated'
};
export type ConceptProjection = {
  revision: number; state: ConceptLearningState; review: ReviewState;
  stage: EvidenceStage; needsCheck: boolean;
};
/** Retention uses encounter-wide help and credits one independent recall per encounter. */
export function projectConcept(key: ConceptKey, events: readonly LearningEvent[]): ConceptProjection {
  const state = replayLearningEvents(key, events);
  const ordered = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const credited = new Set<string>();
  const seen = new Set<string>();
  let review: ReviewState = { step: 0, dueAt: null };
  for (const e of ordered) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (e.evidence !== 'assessed' || e.challengeKind !== 'recall' || credited.has(e.encounterId)) continue;
    if (e.result === 'incorrect' || e.result === 'partial') {
      review = { step: 0, dueAt: new Date(Date.parse(e.createdAt) + DAY).toISOString() };
    } else if (e.result === 'correct' && e.scaffoldUsed === 0) {
      const encounter = state.encounters[e.encounterId];
      if (encounter.revealed || encounter.scaffold !== 0) continue;
      const wasDue = review.dueAt !== null && Date.parse(e.createdAt) >= Date.parse(review.dueAt);
      const step = Math.min(3, review.step + (wasDue ? 1 : 0));
      review = { step, dueAt: new Date(Date.parse(e.createdAt) + REVIEW_DAYS[step] * DAY).toISOString() };
      credited.add(e.encounterId);
    }
  }
  const stage: EvidenceStage = state.masteryEvidence === 'transfer' ? 'transfer'
    : state.masteryEvidence === 'independent' ? 'independent' : events.length ? 'practicing' : 'not_checked';
  return { revision: Object.keys(state.seen).length, state, review, stage, needsCheck: state.masteryEvidence === 'reopened' };
}

export type SessionConcept = {
  key: ConceptKey; title: string; objective: string; priority: number; order: number;
  active: boolean; supported: boolean; teacherScoped: boolean; projection: ConceptProjection;
};
export type SessionPlan = {
  schemaVersion: 1; policyVersion: 'session-1'; mode: 'study' | 'cram'; budgetMinutes: 15 | 30 | 60 | 120;
  status: 'ready' | 'pending' | 'complete' | 'empty'; topicId: string | null;
  activity: LearningActivity; stateRevision: number; reasons: string[]; offerTopicChange: boolean;
};
export function planSession(args: {
  concepts: readonly SessionConcept[]; mode: SessionPlan['mode']; budgetMinutes: SessionPlan['budgetMinutes'];
  elapsedSeconds: number; now: string; selectedTopicId?: string | null; pendingTopicId?: string | null;
}): SessionPlan {
  if (!Number.isFinite(Date.parse(args.now)) || ![15,30,60,120].includes(args.budgetMinutes)
    || !Number.isFinite(args.elapsedSeconds) || args.elapsedSeconds < 0 || !['study','cram'].includes(args.mode)) throw new Error('Invalid session');
  const scope = args.concepts[0]?.key;
  if (scope && args.concepts.some(c => c.key.userId !== scope.userId || c.key.roomId !== scope.roomId)) throw new Error('Session crosses ownership');
  const base: SessionPlan = { schemaVersion: 1, policyVersion: 'session-1', mode: args.mode,
    budgetMinutes: args.budgetMinutes, status: 'empty', topicId: null, activity: args.mode === 'cram' ? 'cram' : 'coach',
    stateRevision: 0, reasons: [], offerTopicChange: false };
  if (args.pendingTopicId) {
    const pending = args.concepts.find(c => c.key.topicId === args.pendingTopicId);
    if (!pending || !pending.active || !pending.supported) throw new Error('Pending encounter is no longer supported');
    return { ...base, status: 'pending', topicId: pending.key.topicId, stateRevision: pending.projection.revision, reasons: ['finish_or_skip_pending'] };
  }
  if (args.elapsedSeconds >= args.budgetMinutes * 60) return { ...base, status: 'complete', reasons: ['time_budget_complete'] };
  const now = Date.parse(args.now);
  const eligible = args.concepts.filter(c => c.active && c.supported);
  const due = (c: SessionConcept) => Boolean((c.projection.state.rematch && Date.parse(c.projection.state.rematch.dueAt) <= now)
    || (c.projection.review.dueAt && Date.parse(c.projection.review.dueAt) <= now));
  const group = (c: SessionConcept) => args.mode === 'cram'
    ? !c.teacherScoped ? 4 : c.projection.stage === 'not_checked' ? 0 : c.projection.needsCheck || c.projection.stage === 'practicing' ? 1 : due(c) ? 2 : 3
    : due(c) ? 0 : c.teacherScoped && c.projection.stage === 'not_checked' ? 1
    : c.projection.needsCheck || c.projection.stage === 'practicing' ? 2 : 3;
  const sorted = [...eligible].sort((a,b) => group(a)-group(b) || b.priority-a.priority
    || Date.parse(a.projection.state.lastPracticedAt ?? '1970-01-01') - Date.parse(b.projection.state.lastPracticedAt ?? '1970-01-01')
    || a.order-b.order || a.key.topicId.localeCompare(b.key.topicId));
  const chosen = args.selectedTopicId ? eligible.find(c => c.key.topicId === args.selectedTopicId) : sorted[0];
  if (args.selectedTopicId && !chosen) throw new Error('Selected topic is not available');
  if (!chosen) return { ...base, reasons: ['no_supported_concepts'] };
  return { ...base, status: 'ready', topicId: chosen.key.topicId, stateRevision: chosen.projection.revision,
    reasons: [args.selectedTopicId ? 'learner_choice' : due(chosen) ? 'due_review_or_rematch' : chosen.projection.stage === 'not_checked' ? 'cover_teacher_scope' : 'practice_from_evidence'],
    offerTopicChange: chosen.projection.state.failureStreak >= POLICY.failuresToSplit };
}
