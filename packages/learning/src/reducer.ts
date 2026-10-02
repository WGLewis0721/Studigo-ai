import { ACTIVITIES, REASONING_LADDER, type ConceptKey, type ConceptLearningState,
  type LearningEvent, type ScaffoldLevel, type ReasoningLevel, type EncounterSignal } from './types';

export const POLICY = { independentSuccessesToAdvance: 2, failuresToSplit: 2,
  misconceptionEncountersToRematch: 2, rematchDelayMs: 86_400_000, delayedRecallMs: 86_400_000 } as const;

export function initialLearningState(key: ConceptKey): ConceptLearningState {
  return { ...key, policyVersion: 1, reasoningLevel: 0, scaffoldLevel: 0, taskSize: 'whole',
    correctStreak: 0, partialStreak: 0, incorrectStreak: 0, independentSuccessCount: 0,
    firstAttemptSuccessCount: 0, independentRecallCount: 0, successfulTransferCount: 0,
    hintDependentSuccessCount: 0, recoveryCount: 0, masteryEvidence: 'not_demonstrated',
    lastResult: null, lastPracticedAt: null, signals: [], rematch: null,
    seen: {}, encounters: {}, misconceptions: {} };
}

export function assertLearningEvent(event: LearningEvent): void {
  const identifiers = [event.id, event.encounterId, event.userId, event.roomId, event.topicId];
  if (identifiers.some(v => typeof v !== 'string' || !v.trim() || v.length > 200)
    || !ACTIVITIES.includes(event.activity) || !REASONING_LADDER.includes(event.challengeKind)
    || !['correct', 'partial', 'incorrect', 'skipped', 'revealed', 'help'].includes(event.result)
    || !['assessed', 'self_reported', 'legacy'].includes(event.evidence)
    || (event.scaffoldUsed !== null && (!Number.isInteger(event.scaffoldUsed) || event.scaffoldUsed < 0 || event.scaffoldUsed > 5))
    || typeof event.newContext !== 'boolean'
    || [event.contextId, event.misconceptionId].some(v => v !== null && (typeof v !== 'string' || !v.trim() || v.length > 200))
    || (event.newContext && !event.contextId)
    || typeof event.createdAt !== 'string' || !Number.isFinite(Date.parse(event.createdAt))) {
    throw new Error('Invalid learning observation');
  }
}

export function sameConcept(a: ConceptKey, b: ConceptKey) {
  return a.userId === b.userId && a.roomId === b.roomId && a.topicId === b.topicId;
}

/** Canonical fingerprint ignores object property insertion order. */
function fingerprint(e: LearningEvent) {
  return JSON.stringify([e.userId, e.roomId, e.topicId, e.encounterId, e.activity,
    e.challengeKind, e.result, e.scaffoldUsed, e.evidence, e.contextId,
    e.newContext, e.misconceptionId, Date.parse(e.createdAt)]);
}

/** Chronological fold. No clock, random values, I/O, model calls or mutation. */
export function reduceLearningEvent(state: ConceptLearningState, event: LearningEvent): ConceptLearningState {
  assertLearningEvent(event);
  if (!sameConcept(state, event)) throw new Error('Learning observation crosses concept ownership');
  const mark = fingerprint(event);
  if (Object.hasOwn(state.seen, event.id)) {
    if (state.seen[event.id] !== mark) throw new Error('Conflicting learning interaction ID');
    return state;
  }
  if (state.lastPracticedAt && Date.parse(event.createdAt) < Date.parse(state.lastPracticedAt)) {
    throw new Error('Out-of-order observation: replay the complete history');
  }
  const previous = Object.hasOwn(state.encounters, event.encounterId) ? state.encounters[event.encounterId] : undefined;
  const encounter = { ...(previous ?? { revealed: false, scaffold: event.scaffoldUsed,
    struggled: false, credited: false, recovered: false }) };
  // Unknown help remains unknown for this encounter. A later independent claim
  // cannot erase an earlier hint or reveal.
  encounter.scaffold = encounter.scaffold === null || event.scaffoldUsed === null ? null
    : Math.max(encounter.scaffold, event.scaffoldUsed) as ScaffoldLevel;
  encounter.revealed ||= event.result === 'revealed';
  if (event.result === 'help' && encounter.scaffold !== null) encounter.scaffold = Math.max(1, encounter.scaffold) as ScaffoldLevel;
  const next: ConceptLearningState = { ...state, seen: { ...state.seen, [event.id]: mark },
    encounters: { ...state.encounters, [event.encounterId]: encounter },
    misconceptions: { ...state.misconceptions }, signals: [...state.signals],
    lastResult: event.result, lastPracticedAt: new Date(event.createdAt).toISOString() };
  const signal = (s: EncounterSignal) => { if (!next.signals.includes(s)) next.signals.push(s); };
  const support = () => { next.scaffoldLevel = Math.min(5, Math.max(next.scaffoldLevel, event.scaffoldUsed ?? 0) + 1) as ScaffoldLevel; };
  const schedule = (reason: 'transfer_fail' | 'recurring_misconception') => {
    // Keep the earliest outstanding rematch; retries must not postpone it forever.
    next.rematch ??= { reason, dueAt: new Date(Date.parse(event.createdAt) + POLICY.rematchDelayMs).toISOString(),
      encounterId: event.encounterId, contextId: event.contextId, misconceptionId: event.misconceptionId };
  };
  if (event.result === 'skipped') {
    next.correctStreak = next.partialStreak = next.incorrectStreak = 0;
    return next;
  }
  const independent = event.evidence === 'assessed' && encounter.scaffold === 0 && !encounter.revealed;
  const level = REASONING_LADDER.indexOf(event.challengeKind);
  if (event.result === 'correct') {
    next.partialStreak = next.incorrectStreak = 0;
    if (encounter.struggled && !encounter.recovered) {
      encounter.recovered = true;
      next.recoveryCount++;
      signal('recovered');
    }
    if (!encounter.credited) {
      encounter.credited = true;
      if (independent) {
        next.independentSuccessCount++;
        if (!encounter.struggled) next.firstAttemptSuccessCount++;
        if (event.challengeKind === 'recall') {
          next.independentRecallCount++;
          if (state.lastPracticedAt && Date.parse(event.createdAt) - Date.parse(state.lastPracticedAt) >= POLICY.delayedRecallMs) signal('delayed_recall_pass');
        }
        if (next.masteryEvidence === 'not_demonstrated') next.masteryEvidence = 'independent';
        if (event.challengeKind === 'transfer' && event.newContext) {
          next.successfulTransferCount++;
          next.masteryEvidence = 'transfer';
          signal('transfer_pass');
        }
        // Easier mini-games cannot farm advancement above their actual demand.
        next.correctStreak = level >= state.reasoningLevel ? state.correctStreak + 1 : 0;
        if (next.correctStreak >= POLICY.independentSuccessesToAdvance) {
          next.reasoningLevel = Math.min(9, state.reasoningLevel + 1) as ReasoningLevel;
          next.correctStreak = 0;
        }
        next.scaffoldLevel = Math.max(0, state.scaffoldLevel - 1) as ScaffoldLevel;
        next.taskSize = 'whole';
        const rematch = next.rematch;
        if (rematch && Date.parse(event.createdAt) >= Date.parse(rematch.dueAt)
          && event.encounterId !== rematch.encounterId && event.contextId !== rematch.contextId
          && event.newContext && (rematch.reason !== 'transfer_fail' || event.challengeKind === 'transfer')) {
          next.rematch = null;
          if (next.masteryEvidence === 'reopened') next.masteryEvidence = 'independent';
        }
      } else {
        next.correctStreak = 0;
        if (event.evidence === 'assessed' && (encounter.revealed || (encounter.scaffold ?? 0) > 0)) {
          next.hintDependentSuccessCount++;
          signal('hint_dependent');
          next.scaffoldLevel = Math.max(0, state.scaffoldLevel - 1) as ScaffoldLevel;
        }
      }
    } else next.correctStreak = 0;
    return next;
  }
  encounter.struggled = true;
  next.correctStreak = 0;
  next.partialStreak = event.result === 'partial' ? state.partialStreak + 1 : 0;
  next.incorrectStreak = event.result === 'incorrect' ? state.incorrectStreak + 1 : 0;
  if (event.result === 'revealed') next.scaffoldLevel = 5;
  else support();
  if (next.incorrectStreak >= POLICY.failuresToSplit) next.taskSize = 'single_step';

  if (event.evidence === 'assessed' && ['incorrect', 'partial'].includes(event.result)) {
    if (event.challengeKind === 'transfer' && event.newContext) {
      signal('transfer_fail');
      schedule('transfer_fail');
    }
    if (event.newContext && state.masteryEvidence === 'transfer') {
      next.masteryEvidence = 'reopened';
      signal('reopened');
      schedule('transfer_fail');
    }
    if (event.misconceptionId) {
      const encounters = Object.hasOwn(state.misconceptions, event.misconceptionId) ? state.misconceptions[event.misconceptionId] : [];
      next.misconceptions[event.misconceptionId] = [...new Set([...encounters, event.encounterId])];
      if (next.misconceptions[event.misconceptionId].length >= POLICY.misconceptionEncountersToRematch) {
        signal('recurring_misconception');
        schedule('recurring_misconception');
      }
    }
  }
  return next;
}

/** Equal timestamps are ambiguous: conservatively process support/failure before
 * success so a reveal and answer saved in one tick cannot become independent. */
const TIE_ORDER: Record<LearningEvent['result'], number> = {
  revealed: 0, help: 1, incorrect: 2, partial: 3, correct: 4, skipped: 5
};

/** Stable timestamp + outcome + ID order. Complete history, never a rolling reset. */
export function replayLearningEvents(key: ConceptKey, events: readonly LearningEvent[]): ConceptLearningState {
  events.forEach(assertLearningEvent);
  const ordered = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    || TIE_ORDER[a.result] - TIE_ORDER[b.result]
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ordered.reduce(reduceLearningEvent, initialLearningState(key));
}
