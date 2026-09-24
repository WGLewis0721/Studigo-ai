import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLearningState, reduceLearningEvent, replayLearningEvents, nextChallenge,
  REASONING_LADDER, LEARNING_ROUTES, ACTIVITIES, type LearningEvent, type ConceptLearningState, type LearningActivity } from './learning';
import { fromExistingAttempt, fromObservationRow, toObservationRow, loadConceptLearningState, recordLearningEvent } from './learning/persistence';
import type { SupabaseClient } from '@supabase/supabase-js';

const key = { userId: 'u', roomId: 'r', topicId: 't' };
const base = Date.parse('2026-09-24T10:00:00Z');
const at = (n: number) => new Date(base + n * 1000).toISOString();
function event(n: number, overrides: Partial<LearningEvent> = {}): LearningEvent {
  return { ...key, id: `e${n}`, encounterId: `q${n}`, activity: 'coach', challengeKind: 'recognize',
    result: 'correct', scaffoldUsed: 0, evidence: 'assessed', contextId: `ctx${n}`,
    newContext: false, misconceptionId: null, createdAt: at(n), ...overrides };
}
const replay = (events: LearningEvent[]) => replayLearningEvents(key, events);
function direct(state: ConceptLearningState, overrides: Partial<Parameters<typeof nextChallenge>[0]> = {}) {
  return nextChallenge({ concept: { ...key, objective: 'Explain melting' }, learnerState: state,
    recentEvents: [], activity: 'coach', route: 'studigo_default', now: at(100000), ...overrides });
}

test('deterministic replay orders events, ignores exact retries and never mutates inputs', () => {
  const events = [event(1), event(2), event(3, { challengeKind: 'recall', result: 'partial' })];
  const copy = structuredClone(events);
  assert.deepEqual(replay(events), replay([events[2], events[0], events[1], events[0]]));
  assert.deepEqual(events, copy);
  const initial = initialLearningState(key);
  reduceLearningEvent(initial, events[0]);
  assert.deepEqual(initial, initialLearningState(key));
  assert.throws(() => replay([events[0], { ...events[0], result: 'incorrect' }]), /Conflicting/);
});

test('independent success advances only at demonstrated demand, with ceiling 9', () => {
  let state = initialLearningState(key);
  for (let n = 0; n < 24; n++) {
    const before = state.reasoningLevel;
    state = reduceLearningEvent(state, event(n, { challengeKind: REASONING_LADDER[before] }));
    assert.equal(state.reasoningLevel, Math.min(9, Math.floor((n + 1) / 2)));
  }
  for (let n = 24; n < 30; n++) state = reduceLearningEvent(state, event(n));
  assert.equal(state.reasoningLevel, 9);
  const low = replay(Array.from({ length: 12 }, (_, n) => event(n)));
  assert.equal(low.reasoningLevel, 1, 'recognition cannot manufacture recall/explanation evidence');
});

test('partial answers hold reasoning and increase support separately', () => {
  const state = replay([event(1), event(2), event(3, { result: 'partial' }), event(4, { result: 'partial' })]);
  assert.equal(state.reasoningLevel, 1);
  assert.equal(state.scaffoldLevel, 2);
  assert.equal(state.partialStreak, 2);
  assert.equal(direct(state).action, 'retry');
});

test('repeated failures split task, keep objective, and cap support at worked example', () => {
  const state = replay(Array.from({ length: 9 }, (_, n) => event(n, { result: 'incorrect' })));
  const spec = direct(state);
  assert.equal(spec.taskSize, 'single_step');
  assert.equal(spec.scaffoldLevel, 5);
  assert.equal(spec.concept.objective, 'Explain melting');
  assert.equal(state.reasoningLevel, 0);
});

test('reveal taints the encounter, including a later independently claimed correct answer', () => {
  const state = replay([event(1, { result: 'revealed', encounterId: 'same' }),
    event(2, { encounterId: 'same', challengeKind: 'transfer', newContext: true })]);
  assert.equal(state.independentSuccessCount, 0);
  assert.equal(state.successfulTransferCount, 0);
  assert.equal(state.masteryEvidence, 'not_demonstrated');
  assert.equal(state.recoveryCount, 1);
});

test('help use remains sticky and same-question repeated correctness cannot farm progression', () => {
  const assisted = replay([event(1, { result: 'help', encounterId: 'same' }), event(2, { encounterId: 'same' })]);
  assert.equal(assisted.independentSuccessCount, 0);
  assert.equal(assisted.hintDependentSuccessCount, 1);
  const repeated = replay([event(1, { encounterId: 'same' }), event(2, { encounterId: 'same' })]);
  assert.equal(repeated.independentSuccessCount, 1);
  assert.equal(repeated.reasoningLevel, 0);
});

test('equal-time reveal and correctness are conservatively ordered independent of IDs', () => {
  const answer = event(1, { id: 'a', encounterId: 'same' });
  const reveal = event(1, { id: 'z', encounterId: 'same', result: 'revealed' });
  assert.equal(replay([answer, reveal]).independentSuccessCount, 0);
  assert.deepEqual(replay([answer, reveal]), replay([reveal, answer]));
});

test('independent transfer is strong evidence; failure in new context reopens and schedules rematch', () => {
  const pass = event(1, { challengeKind: 'transfer', newContext: true });
  const failed = event(2, { challengeKind: 'transfer', newContext: true, result: 'incorrect' });
  assert.equal(replay([pass]).masteryEvidence, 'transfer');
  const state = replay([pass, failed]);
  assert.equal(state.masteryEvidence, 'reopened');
  assert.equal(state.successfulTransferCount, 1);
  assert.ok(state.signals.includes('transfer_fail'));
  assert.ok(state.signals.includes('reopened'));
  assert.equal(direct(state, { now: at(3) }).action, 'retry');
  const rematch = direct(state);
  assert.equal(rematch.action, 'rematch');
  assert.equal(rematch.challengeKind, 'transfer');
  assert.equal(rematch.constraints.requireNewContext, true);
  assert.equal(rematch.constraints.avoidContextId, failed.contextId);
  const resolved = replay([pass, failed, event(100000, { challengeKind: 'transfer', newContext: true })]);
  assert.equal(resolved.rematch, null);
  assert.equal(resolved.masteryEvidence, 'transfer');
  assert.notEqual(replay([pass, failed, event(100000, { challengeKind: 'recall' })]).rematch, null);
});

test('misconceptions require recurrence across encounters, not transport or same-question retries', () => {
  const miss = { result: 'incorrect', misconceptionId: 'phase-direction' } as const;
  const first = event(1, miss);
  assert.equal(replay([first, first, event(2, { ...miss, encounterId: first.encounterId })]).rematch, null);
  const state = replay([first, event(2, miss)]);
  assert.ok(state.signals.includes('recurring_misconception'));
  assert.equal(state.rematch?.reason, 'recurring_misconception');
});

test('recovery is distinct from first-attempt success and survives cross-mini-game replay', () => {
  const state = replay([event(1, { activity: 'quiz', result: 'incorrect', encounterId: 'same' }),
    event(2, { activity: 'coach', encounterId: 'same' }), event(3, { activity: 'practice_test' })]);
  assert.equal(state.recoveryCount, 1);
  assert.equal(state.firstAttemptSuccessCount, 1);
  assert.equal(state.independentSuccessCount, 2);
  assert.ok(state.signals.includes('recovered'));
});

test('route changes delivery reference, never reasoning, scaffolding or mastery criteria', () => {
  const state = replay([event(1), event(2)]);
  const baseline = direct(state);
  for (const route of LEARNING_ROUTES) {
    const spec = direct(state, { route });
    assert.deepEqual({ ...spec, route: baseline.route, routeRecord: baseline.routeRecord }, baseline);
  }
});

test('cards honor capability; practice tests remove support without mutating state', () => {
  const state = { ...initialLearningState(key), reasoningLevel: 7 as const, scaffoldLevel: 4 as const, taskSize: 'single_step' as const };
  assert.equal(direct(state, { activity: 'flashcard' }).challengeKind, 'recall');
  assert.equal(direct(state, { activity: 'practice_test' }).scaffoldLevel, 0);
  assert.equal(state.scaffoldLevel, 4);
});

test('legacy attempts keep unknown support; card self-report never grants independent mastery', () => {
  const row = { id: 'a', owner_id: 'u', room_id: 'r', topic_id: 't', source: 'quiz' as const,
    score: 100, is_correct: true, created_at: at(1), question_id: 'q', question_kind: 'short_answer', practice_test_id: null };
  const quiz = fromExistingAttempt(row);
  const card = fromExistingAttempt({ ...row, id: 'b', source: 'flashcard' });
  assert.equal(quiz.scaffoldUsed, null);
  assert.equal(card.evidence, 'self_reported');
  assert.equal(replay([quiz, card]).independentSuccessCount, 0);
  assert.equal(fromExistingAttempt({ ...row, practice_test_id: 'test' }).activity, 'practice_test');
  assert.equal(fromExistingAttempt({ ...row, is_correct: false, score: 50 }).result, 'partial');
  assert.equal(fromExistingAttempt({ ...row, is_correct: false, score: 20 }).result, 'incorrect');
});

test('validation rejects mismatched ownership, malformed observation, and out-of-order incremental writes', () => {
  assert.throws(() => replay([event(1, { userId: 'other' })]), /ownership/);
  assert.throws(() => replay([event(1, { newContext: true, contextId: null })]), /Invalid/);
  assert.throws(() => replay([event(1, { createdAt: 'never' })]), /Invalid/);
  assert.throws(() => reduceLearningEvent(replay([event(2)]), event(1)), /Out-of-order/);
  assert.throws(() => direct(initialLearningState(key), { concept: { ...key, topicId: 'other', objective: 'x' } }), /scope/);
  assert.doesNotThrow(() => replay([event(1, { id: '__proto__', encounterId: '__proto__', misconceptionId: '__proto__', result: 'incorrect' })]));
});

test('skipping is not failure; delayed independent recall is observed without a clock dependency', () => {
  const state = replay([event(1), event(2, { result: 'skipped' }), event(100000, { challengeKind: 'recall' })]);
  assert.equal(state.incorrectStreak, 0);
  assert.equal(state.scaffoldLevel, 0);
  assert.ok(state.signals.includes('delayed_recall_pass'));
});

test('persistence adapter reads both authoritative sources and fails closed on read/write errors', async () => {
  const e = event(1);
  const row = toObservationRow(e);
  assert.equal(fromObservationRow(row).id, 'observation:e1');
  const supabase = { rpc: async () => ({ data: { attempts: [], observations: [row] }, error: null }) } as unknown as SupabaseClient;
  assert.equal((await loadConceptLearningState(supabase, key)).state.independentSuccessCount, 1);
  const broken = { rpc: async () => ({ data: null, error: { message: 'offline' } }) } as unknown as SupabaseClient;
  await assert.rejects(loadConceptLearningState(broken, key), /Could not load/);
  await assert.rejects(recordLearningEvent(broken, e), /did not save/);
  assert.throws(() => toObservationRow(event(1, { activity: 'quiz' })), /authoritative/);
});

function atDemand(level: ConceptLearningState['reasoningLevel'], overrides: Partial<ConceptLearningState> = {}): ConceptLearningState {
  return { ...initialLearningState(key), reasoningLevel: level, ...overrides };
}

test('omitted challenge request matches an explicit normal request', () => {
  const state = replay([event(1), event(2, { result: 'incorrect' })]);
  const events = [event(1), event(2)];
  for (const activity of ACTIVITIES) {
    for (const route of ['studigo_default', 'socratic'] as const) {
      assert.deepEqual(
        direct(state, { activity, route, recentEvents: events }),
        direct(state, { activity, route, recentEvents: events, challengeRequest: 'normal' })
      );
    }
  }
  assert.throws(() => direct(state, { challengeRequest: 'harder' as 'normal' }), /Invalid challenge request/);
});

test('stretch raises coach demand by exactly one, keeps route and scope, and does not compound', () => {
  const state = atDemand(3, { lastResult: 'correct', scaffoldLevel: 2, taskSize: 'whole', masteryEvidence: 'independent' });
  const recent = [event(1), event(2)];
  const beforeState = structuredClone(state);
  const beforeEvents = structuredClone(recent);
  const normal = direct(state, { recentEvents: recent, route: 'socratic' });
  const stretch = direct(state, { recentEvents: recent, route: 'socratic', challengeRequest: 'stretch' });
  const again = direct(state, { recentEvents: recent, route: 'socratic', challengeRequest: 'stretch' });
  assert.equal(normal.reasoningLevel, 3);
  assert.equal(normal.challengeKind, 'compare');
  assert.equal(stretch.reasoningLevel, 4);
  assert.equal(stretch.challengeKind, 'predict');
  assert.deepEqual(again, stretch);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(recent, beforeEvents);
  assert.equal(stretch.route, 'socratic');
  assert.equal(stretch.routeRecord, normal.routeRecord);
  assert.equal(stretch.activity, 'coach');
  assert.deepEqual(stretch.concept, normal.concept);
  assert.equal(stretch.scaffoldLevel, 2);
  assert.equal(stretch.taskSize, 'whole');
  assert.equal(stretch.action, normal.action);
  assert.deepEqual(stretch.constraints, normal.constraints);
  assert.ok(stretch.reasons.includes('learner_requested_stretch'));
  assert.ok(stretch.reasons.includes('last_correct'));
  assert.equal(stretch.constraints.requireNewContext, false);
});

test('stretch at the top of the ladder stays at teach-back', () => {
  const state = atDemand(9, { lastResult: 'correct' });
  const stretch = direct(state, { challengeRequest: 'stretch' });
  assert.equal(stretch.reasoningLevel, 9);
  assert.equal(stretch.challengeKind, 'teach_back');
  assert.equal(state.reasoningLevel, 9);
  assert.ok(stretch.reasons.includes('learner_requested_stretch'));
});

test('stretch cannot carry flashcards past recall or change a practice test', () => {
  const high = atDemand(7, { scaffoldLevel: 4, taskSize: 'single_step', lastResult: 'incorrect' });
  const before = structuredClone(high);
  const cards = direct(high, { activity: 'flashcard', challengeRequest: 'stretch' });
  assert.equal(cards.reasoningLevel, 1);
  assert.equal(cards.challengeKind, 'recall');
  assert.ok(cards.reasons.includes('learner_requested_stretch'));
  assert.ok(cards.reasons.includes('flashcard_recall_only'));
  const beginner = direct(atDemand(0), { activity: 'flashcard', challengeRequest: 'stretch' });
  assert.equal(beginner.challengeKind, 'recall');
  assert.notEqual(beginner.challengeKind, 'transfer');
  const practiced = direct(high, { activity: 'practice_test', challengeRequest: 'stretch' });
  assert.deepEqual(practiced, direct(high, { activity: 'practice_test' }));
  assert.equal(practiced.scaffoldLevel, 0);
  assert.equal(practiced.taskSize, 'whole');
  assert.equal(practiced.reasoningLevel, 7);
  assert.equal(practiced.challengeKind, 'novel_problem');
  assert.equal(practiced.reasons.includes('learner_requested_stretch'), false);
  for (const activity of ['learn', 'quiz', 'weak_area', 'cram'] as const satisfies readonly LearningActivity[]) {
    assert.deepEqual(
      direct(high, { activity, challengeRequest: 'stretch' }),
      direct(high, { activity }),
      activity
    );
  }
  assert.deepEqual(high, before);
});

test('a due rematch outranks a stretch request', () => {
  const failed = event(2, { challengeKind: 'transfer', newContext: true, result: 'incorrect' });
  const state = replay([event(1, { challengeKind: 'transfer', newContext: true }), failed]);
  const before = structuredClone(state);
  assert.equal(state.rematch?.reason, 'transfer_fail');
  const normal = direct(state);
  const stretch = direct(state, { challengeRequest: 'stretch' });
  assert.equal(normal.action, 'rematch');
  assert.deepEqual(stretch, normal);
  assert.equal(stretch.challengeKind, 'transfer');
  assert.equal(stretch.reasoningLevel, 6);
  assert.equal(stretch.constraints.requireNewContext, true);
  assert.equal(stretch.constraints.avoidContextId, failed.contextId);
  assert.equal(stretch.reasons.includes('learner_requested_stretch'), false);
  const advanced = atDemand(8, { rematch: state.rematch, lastResult: 'incorrect' });
  const stillRematch = direct(advanced, { challengeRequest: 'stretch' });
  assert.equal(stillRematch.action, 'rematch');
  assert.equal(stillRematch.challengeKind, 'transfer');
  assert.notEqual(stillRematch.challengeKind, 'defend');
  const cards = direct(state, { activity: 'flashcard', challengeRequest: 'stretch' });
  assert.equal(cards.action, 'retry');
  assert.equal(cards.challengeKind, 'recall');
  assert.equal(state.rematch?.reason, 'transfer_fail');
  assert.deepEqual(state, before);
});

test('stretch success and failure still use the normal reducer, with no mastery shortcut', () => {
  let state = initialLearningState(key);
  for (let n = 0; n < 6; n++) state = reduceLearningEvent(state, event(n, { challengeKind: REASONING_LADDER[state.reasoningLevel] }));
  assert.equal(state.reasoningLevel, 3);
  assert.equal(state.correctStreak, 0);
  const issued = direct(state, { challengeRequest: 'stretch' });
  assert.equal(issued.challengeKind, 'predict');
  const frozen = structuredClone(state);
  const passed = reduceLearningEvent(state, event(6, { challengeKind: issued.challengeKind }));
  assert.deepEqual(state, frozen);
  assert.equal(passed.reasoningLevel, 3);
  assert.equal(passed.correctStreak, 1);
  assert.equal(passed.masteryEvidence, 'independent');
  assert.equal(passed.successfulTransferCount, 0);
  const advanced = reduceLearningEvent(passed, event(7, { challengeKind: issued.challengeKind }));
  assert.equal(advanced.reasoningLevel, 4);
  assert.equal(advanced.correctStreak, 0);
  assert.equal(advanced.masteryEvidence, 'independent');
  const failed = reduceLearningEvent(state, event(8, { challengeKind: issued.challengeKind, result: 'incorrect', scaffoldUsed: 0 }));
  assert.equal(failed.reasoningLevel, 3);
  assert.equal(failed.scaffoldLevel, 1);
  assert.equal(failed.incorrectStreak, 1);
  assert.equal(failed.masteryEvidence, 'independent');
  assert.equal(failed.rematch, null);
  const again = direct(failed, { challengeRequest: 'stretch' });
  assert.equal(again.reasoningLevel, 4);
  assert.notEqual(again.reasoningLevel, 5);
});

test('support after an answer does not rewrite that answer or grant independent mastery', () => {
  const incorrect = event(1, { encounterId: 'same', result: 'incorrect', scaffoldUsed: 0, challengeKind: 'explain' });
  const help = event(2, { encounterId: 'same', result: 'help', scaffoldUsed: 2, challengeKind: 'explain' });
  const retry = event(3, { encounterId: 'same', result: 'correct', scaffoldUsed: 2, challengeKind: 'explain' });
  const state = replay([incorrect, help, retry]);
  assert.equal(incorrect.scaffoldUsed, 0);
  assert.equal(state.independentSuccessCount, 0);
  assert.equal(state.hintDependentSuccessCount, 1);
  assert.equal(state.recoveryCount, 1);
  assert.equal(state.reasoningLevel, 0);
  assert.equal(state.masteryEvidence, 'not_demonstrated');
});
