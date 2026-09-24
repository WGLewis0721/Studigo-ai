import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLearningState, reduceLearningEvent, replayLearningEvents, nextChallenge,
  REASONING_LADDER, LEARNING_ROUTES, type LearningEvent, type ConceptLearningState } from './learning';
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
