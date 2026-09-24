import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachEvaluation, CoachState, ExpectedConcept, RetrievedChunk } from "@studigo/ai";
import { runCoachTurn } from "./coach-router";
import type { CoachDirector } from "./coach-director";
import type { CoachEvidenceStore } from "./coach-evidence-store";
import { CoachEvidenceScopeError, type CoachInteraction } from "./coach-learning-events";
import { InteractionConflictError, persistUserInteraction } from "./coach-interaction";
import {
  REASONING_LADDER,
  initialLearningState,
  nextChallenge,
  replayLearningEvents,
  type ChallengeKind,
  type ChallengeRequest,
  type ChallengeSpec,
  type LearningEvent,
  type ReasoningLevel
} from "./learning";
import type { Topic } from "./rooms";

// Coach <-> learning-control-plane loop. Fakes mirror the real contracts:
// the evidence store behaves like record_learning_event (identical retry is a
// no-op, conflicting reuse throws) and the director runs Astra's real
// nextChallenge over replayLearningEvents of whatever was persisted.

const USER = "user-1";
const ROOM = "room-1";
const topic: Topic = {
  id: "topic-magnets", room_id: ROOM, title: "Magnetism", objective: "Explain how magnets attract and repel.",
  key_terms: ["pole"], priority: 1, order_index: 0, origin: "study_guide", mastery_score: 0,
  status: "learning", last_practiced_at: null, learner_edited: false
};
const key = { userId: USER, roomId: ROOM, topicId: topic.id };
const chunk: RetrievedChunk = { id: "chunk-m", documentId: "d", documentName: "Magnets", content: "Opposite poles attract. Like poles repel.", similarity: 0.9 };
const concepts: ExpectedConcept[] = [
  { id: "opposites_attract", description: "Opposite poles pull together", weight: 0.5, critical: true },
  { id: "likes_repel", description: "Like poles push apart", weight: 0.5, critical: false }
];
const T0 = "2026-09-24T10:00:00.000Z";

function specAt(kind: ChallengeKind = "explain"): ChallengeSpec {
  return nextChallenge({
    concept: { ...key, objective: topic.objective! },
    learnerState: { ...initialLearningState(key), reasoningLevel: REASONING_LADDER.indexOf(kind) as ReasoningLevel },
    recentEvents: [], activity: "coach", route: "studigo_default", now: T0
  });
}

function pending(spec: ChallengeSpec | undefined = specAt(), scaffoldUsed: number | null = 0, contextId: string | null = null, topicId = topic.id): CoachState {
  return {
    version: 1, kind: "awaiting_answer", question: "What happens when two north poles meet? Why?", topicId,
    expectedConcepts: concepts, sourceChunkIds: [chunk.id], askedAt: T0,
    ...(spec ? { issuedChallenge: { spec: spec as unknown as Record<string, unknown>, encounterId: "enc-1", scaffoldUsed, contextId } } : {})
  };
}

function world(initial: CoachState | null, options: { failSaves?: number } = {}) {
  const events = new Map<string, LearningEvent>();
  const saved: CoachState[] = [];
  let current: unknown = initial;
  let failSaves = options.failSaves ?? 0;
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { coach_state: current }, error: null }) }) }),
      update: (row: { coach_state: CoachState }) => ({
        eq: async () => {
          if (failSaves > 0) { failSaves--; return { error: { message: "write failed" } }; }
          saved.push(row.coach_state); current = row.coach_state; return { error: null };
        }
      })
    })
  } as unknown as SupabaseClient;
  let failRecords = false;
  const evidence: CoachEvidenceStore = {
    async record(event) {
      if (failRecords) throw new Error("Learning observation did not save; retry the same interaction");
      const prior = events.get(event.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error("Conflicting learning interaction ID");
      events.set(event.id, event);
    },
    async recordedResult(_supabase, id) { return events.get(id)?.result ?? null; }
  };
  const requests: ChallengeRequest[] = [];
  const directorSaw: number[] = [];
  const issuedSpecs: ChallengeSpec[] = [];
  const director: CoachDirector = {
    async challengeFor(args) {
      requests.push(args.challengeRequest);
      const persisted = [...events.values()];
      directorSaw.push(persisted.length);
      const spec = nextChallenge({
        concept: { ...key, objective: topic.objective! }, learnerState: replayLearningEvents(key, persisted),
        recentEvents: persisted, activity: "coach", route: args.route, now: T0, challengeRequest: args.challengeRequest
      });
      issuedSpecs.push(spec);
      return spec;
    }
  };
  const replay = () => replayLearningEvents(key, [...events.values()]);
  return {
    supabase, saved, events, requests, directorSaw, issuedSpecs, director, evidence, replay,
    failEvents: (on: boolean) => { failRecords = on; },
    failNextSaves: (n: number) => { failSaves = n; },
    state: () => current as CoachState
  };
}

type World = ReturnType<typeof world>;
type Eval = CoachEvaluation;
const graded = (a: "demonstrated" | "partial" | "absent" | "contradicted", b: typeof a): Eval =>
  ({ intent: "answer", concepts: [{ id: "opposites_attract", status: a }, { id: "likes_repel", status: b }] });

let counter = 0;
function interaction(createdAt = T0): CoachInteraction {
  counter++;
  return { id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, createdAt };
}

async function turn(w: World, question: string, options: { evaluation?: Eval; interaction?: CoachInteraction; generated?: string } = {}) {
  const ix = options.interaction ?? interaction();
  let feedbackOutcome: string | undefined;
  const texts: string[] = [];
  const generator = runCoachTurn({
    supabase: w.supabase, roomId: ROOM, conversationId: "conv-1", question, topics: [topic], userId: USER, interaction: ix,
    deps: {
      director: w.director,
      evidence: w.evidence,
      retrieveForRoom: async () => [chunk],
      fetchChunksByIds: async () => [chunk],
      evaluateCoachAnswer: async () => options.evaluation ?? graded("demonstrated", "demonstrated"),
      generateCoachQuestion: async () => ({ question: options.generated ?? "Two north ends meet. What will happen? Why?", expectedConcepts: concepts, sourceChunkIds: [chunk.id], sourceMarkers: [] }),
      generateCoachFeedback: async (args) => { feedbackOutcome = args.outcome; return "Feedback."; },
      renderCoachSupport: async () => "A fridge magnet sticks to the door.",
      answerFromRetrievedContext: async () => ({ text: "Like poles push apart [1].", citations: [], grounded: true }),
      rewriteCoachQuestion: async (args) => args.question
    }
  });
  let result = await generator.next();
  while (!result.done) {
    const event = result.value as { type: string; text?: string };
    if (event.type === "delta" && event.text) texts.push(event.text);
    result = await generator.next();
  }
  return { log: result.value, ix, feedbackOutcome, texts };
}

const byId = (w: World, ix: CoachInteraction, part: string) => w.events.get(`coach:${ix.id}:${part}`);
const pendingIssued = (w: World) => (w.state() as Extract<CoachState, { kind: "awaiting_answer" }>).issuedChallenge;

// --- Challenge me -----------------------------------------------------------

test("1. 'Challenge me' asks the director for a stretch and renders its spec unchanged", async () => {
  const w = world(null);
  await turn(w, "Challenge me");
  assert.deepEqual(w.requests, ["stretch"]);
  assert.deepEqual(pendingIssued(w)?.spec, w.issuedSpecs[0]);
  assert.ok(w.issuedSpecs[0].reasons.includes("learner_requested_stretch"));
});

test("2. a normal new question and 'another one' ask for normal demand", async () => {
  const w = world(null);
  await turn(w, "Coach me on magnetism");
  await turn(w, "Opposite ends pull and same ends push");
  await turn(w, "yes");
  assert.deepEqual(w.requests, ["normal", "normal"]);
});

test("3. repeated 'Challenge me' does not stair-step on the Coach side", async () => {
  const w = world(null);
  await turn(w, "Challenge me");
  await turn(w, "Challenge me");
  await turn(w, "Challenge me");
  const levels = w.issuedSpecs.map((spec) => spec.reasoningLevel);
  assert.equal(new Set(levels).size, 1, `levels ${levels}`);
  // The abandoned stretch questions are skips, which carry no mastery credit.
  assert.equal(w.replay().independentSuccessCount, 0);
});

// --- Assessed answers ------------------------------------------------------

test("4. a correct answer writes an assessed attempt from the issued spec", async () => {
  const spec = specAt("predict");
  const w = world(pending(spec));
  const { ix } = await turn(w, "They push apart because like poles repel");
  const attempt = byId(w, ix, "attempt");
  assert.deepEqual(attempt, {
    id: `coach:${ix.id}:attempt`, userId: USER, roomId: ROOM, topicId: topic.id, encounterId: "enc-1",
    activity: "coach", challengeKind: "predict", result: "correct", scaffoldUsed: 0, evidence: "assessed",
    contextId: null, newContext: false, misconceptionId: null, createdAt: T0
  });
  assert.equal(w.events.size, 1);
});

test("5. a partial answer writes partial", async () => {
  const w = world(pending());
  const { ix } = await turn(w, "They pull together", { evaluation: graded("demonstrated", "absent") });
  assert.equal(byId(w, ix, "attempt")?.result, "partial");
  assert.equal(byId(w, ix, "support"), undefined);
});

test("6. an incorrect attempt records the PRE-feedback scaffold", async () => {
  const w = world(pending(undefined, 0));
  const { ix } = await turn(w, "All magnets pull together", { evaluation: graded("demonstrated", "contradicted") });
  assert.equal(byId(w, ix, "attempt")?.result, "incorrect");
  assert.equal(byId(w, ix, "attempt")?.scaffoldUsed, 0);
});

test("7. the correction after an incorrect attempt is recorded separately, after it", async () => {
  const w = world(pending(undefined, 0));
  const { ix } = await turn(w, "All magnets pull together", { evaluation: graded("demonstrated", "contradicted") });
  const support = byId(w, ix, "support");
  assert.equal(support?.result, "revealed");
  assert.equal(support?.scaffoldUsed, 5);
  assert.equal(support?.encounterId, "enc-1");
  assert.equal(pendingIssued(w)?.scaffoldUsed, 5);
});

// --- Support on the same encounter -----------------------------------------

for (const [label, question, result, level, evaluation] of [
  ["8. a hint", "I don't know", "help", 2, undefined],
  ["9. an example", "Show me an example", "help", 3, undefined],
  ["10. show answer", "show me the answer", "revealed", 5, undefined],
  ["11. simplify", "Make it simpler", "help", 1, undefined],
  ["12. an answered clarification", "What is a pole?", "help", 2, { intent: "clarification", concepts: [] } as Eval]
] as const) {
  test(`${label} records ${result} at level ${level} on the same encounter`, async () => {
    const w = world(pending(undefined, 0));
    const { ix } = await turn(w, question, { evaluation });
    const support = byId(w, ix, "support");
    assert.equal(support?.result, result);
    assert.equal(support?.scaffoldUsed, level);
    assert.equal(support?.encounterId, "enc-1");
    assert.equal(support?.createdAt, T0);
    assert.equal(byId(w, ix, "attempt"), undefined, "support is never an attempt");
    assert.equal(pendingIssued(w)?.encounterId, "enc-1");
    assert.equal(pendingIssued(w)?.scaffoldUsed, level);
  });
}

test("13. a correct answer after a hint cannot become independent", async () => {
  const w = world(pending(undefined, 0));
  await turn(w, "I don't know", { interaction: interaction("2026-09-24T10:00:00.000Z") });
  const { ix } = await turn(w, "Same ends push apart, opposite ends pull", { interaction: interaction("2026-09-24T10:01:00.000Z") });
  assert.equal(byId(w, ix, "attempt")?.scaffoldUsed, 2);
  const state = w.replay();
  assert.equal(state.independentSuccessCount, 0);
  assert.equal(state.hintDependentSuccessCount, 1);
});

test("14. a correct answer after a reveal cannot become independent", async () => {
  const w = world(pending(undefined, 0));
  await turn(w, "show me the answer", { interaction: interaction("2026-09-24T10:00:00.000Z") });
  const { ix } = await turn(w, "Same ends push apart, opposite ends pull", { interaction: interaction("2026-09-24T10:01:00.000Z") });
  assert.equal(byId(w, ix, "attempt")?.scaffoldUsed, 5);
  assert.equal(w.replay().independentSuccessCount, 0);
  assert.equal(w.replay().masteryEvidence, "not_demonstrated");
});

test("15. an irrelevant reply is not incorrect mastery evidence; only its clue is recorded", async () => {
  const w = world(pending(undefined, 0));
  const { ix } = await turn(w, "pizza", { evaluation: { intent: "irrelevant", concepts: [] } });
  assert.equal(byId(w, ix, "attempt"), undefined);
  assert.equal(byId(w, ix, "support")?.result, "help");
  assert.equal(w.replay().incorrectStreak, 0);
  assert.ok(![...w.events.values()].some((e) => e.result === "incorrect"));
});

test("16. an explicit skip of an issued question records skipped", async () => {
  const w = world(pending(undefined, 0));
  const { ix } = await turn(w, "next");
  assert.equal(byId(w, ix, "skip")?.result, "skipped");
  assert.equal(w.state().kind, "idle");
});

// --- Idempotency, timestamps, commit order ---------------------------------

test("17/19. an exact retry creates no duplicate event and keeps the attempt timestamp", async () => {
  const w = world(pending());
  const ix = interaction();
  w.failNextSaves(2); // event lands; both state writes fail -> retryable error
  await assert.rejects(turn(w, "Same ends push apart, opposite ends pull", { interaction: ix }));
  assert.equal(w.events.size, 1);
  assert.equal(w.saved.length, 0);
  await turn(w, "Same ends push apart, opposite ends pull", { interaction: ix });
  assert.equal(w.events.size, 1);
  assert.equal(byId(w, ix, "attempt")?.createdAt, T0);
  // A third delivery of the same, now completed, submission changes nothing.
  const savesBefore = w.saved.length;
  await turn(w, "Same ends push apart, opposite ends pull", { interaction: ix });
  assert.equal(w.saved.length, savesBefore);
  assert.equal(w.events.size, 1);
});

test("18. conflicting reuse of an interaction ID fails closed", async () => {
  const w = world(pending());
  const ix = interaction();
  await w.evidence.record({ ...(await (async () => { await turn(w, "Same ends push apart", { interaction: ix }); return byId(w, ix, "attempt")!; })()) });
  await assert.rejects(w.evidence.record({ ...byId(w, ix, "attempt")!, result: "incorrect" }), /Conflicting/);

  // The persisted-message layer: the same ID for a different message is rejected.
  const rows = new Map<string, { id: string; conversation_id: string; role: string; content: string; created_at: string }>();
  const messages = {
    from: () => ({
      insert: (row: { id: string; conversation_id: string; role: string; content: string }) => ({
        select: () => ({
          single: async () => {
            if (rows.has(row.id)) return { data: null, error: { code: "23505", message: "duplicate" } };
            rows.set(row.id, { ...row, created_at: T0 });
            return { data: { id: row.id, created_at: T0 }, error: null };
          }
        })
      }),
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }) }) })
    })
  } as unknown as SupabaseClient;
  const id = "11111111-1111-4111-8111-111111111111";
  const first = await persistUserInteraction({ supabase: messages, interactionId: id, conversationId: "conv-1", content: "A" });
  const retry = await persistUserInteraction({ supabase: messages, interactionId: id, conversationId: "conv-1", content: "A" });
  assert.deepEqual(retry, first, "an exact retry reuses the row and its server time");
  await assert.rejects(persistUserInteraction({ supabase: messages, interactionId: id, conversationId: "conv-1", content: "B" }), InteractionConflictError);
  await assert.rejects(persistUserInteraction({ supabase: messages, interactionId: id, conversationId: "conv-2", content: "A" }), InteractionConflictError);
  await assert.rejects(persistUserInteraction({ supabase: messages, interactionId: "not-a-uuid", conversationId: "conv-1", content: "A" }), InteractionConflictError);
});

test("20. support produced by the same request sorts strictly after the attempt", async () => {
  const w = world(pending(undefined, 0));
  const { ix } = await turn(w, "All magnets pull together", { evaluation: graded("demonstrated", "contradicted") });
  const attempt = byId(w, ix, "attempt")!;
  const support = byId(w, ix, "support")!;
  assert.equal(Date.parse(support.createdAt) - Date.parse(attempt.createdAt), 1);
  // Replayed, the attempt is judged at its own (independent) support level.
  const replayed = w.replay();
  assert.equal(replayed.lastResult, "revealed");
  assert.equal(replayed.encounters["enc-1"].struggled, true);
});

test("21. an event-persistence failure does not advance Coach or show feedback", async () => {
  const w = world(pending());
  w.failEvents(true);
  let texts: string[] = [];
  await assert.rejects(async () => { texts = (await turn(w, "Same ends push apart, opposite ends pull")).texts; });
  assert.equal(w.saved.length, 0);
  assert.equal(w.state().kind, "awaiting_answer");
  assert.deepEqual(texts, []);
  assert.equal(w.requests.length, 0, "no next challenge is issued");
});

test("22. event success + Coach-state failure retries safely, keeping the recorded outcome", async () => {
  const w = world(pending());
  const ix = interaction();
  w.failNextSaves(2);
  await assert.rejects(turn(w, "They push apart", { interaction: ix, evaluation: graded("demonstrated", "demonstrated") }));
  // The retry is re-evaluated differently by the model; the committed result wins.
  const retry = await turn(w, "They push apart", { interaction: ix, evaluation: graded("demonstrated", "absent") });
  assert.equal(retry.feedbackOutcome, "correct");
  assert.equal(w.events.size, 1);
  assert.equal(w.state().kind, "awaiting_control");
});

test("23. a forged room, topic or user in the issued spec is never written", async () => {
  for (const state of [
    // A tampered coach_state row: the stored spec names another learner/room.
    pending({ ...specAt(), concept: { ...specAt().concept, userId: "someone-else" } }),
    pending({ ...specAt(), concept: { ...specAt().concept, roomId: "other-room" } }),
    pending(specAt(), 0, null, "other-topic")
  ]) {
    const w = world(state);
    await assert.rejects(turn(w, "Same ends push apart"), CoachEvidenceScopeError);
    assert.equal(w.events.size, 0);
    assert.equal(w.saved.length, 0);
  }
});

test("24. newContext and contextId come from the issued challenge", async () => {
  const w = world(null);
  // Transfer requires a new context; the director issues it, the Coach records it.
  const transfer: CoachDirector = { challengeFor: async () => specAt("transfer") };
  const ix = interaction();
  await runCoachTurnWith(w, transfer, "Coach me on magnetism", ix);
  const issued = pendingIssued(w)!;
  assert.match(issued.contextId ?? "", /^coach-context:/);
  const { ix: answer } = await turn(w, "They push apart");
  const attempt = byId(w, answer, "attempt")!;
  assert.equal(attempt.newContext, true);
  assert.equal(attempt.contextId, issued.contextId);
  // Without the requirement there is no context identity.
  const plain = world(pending());
  const { ix: p } = await turn(plain, "They push apart");
  assert.equal(byId(plain, p, "attempt")?.newContext, false);
  assert.equal(byId(plain, p, "attempt")?.contextId, null);
});

async function runCoachTurnWith(w: World, director: CoachDirector, question: string, ix: CoachInteraction) {
  const generator = runCoachTurn({
    supabase: w.supabase, roomId: ROOM, conversationId: "conv-1", question, topics: [topic], userId: USER, interaction: ix,
    deps: {
      director, evidence: w.evidence, retrieveForRoom: async () => [chunk],
      generateCoachQuestion: async () => ({ question: "A fridge magnet meets a compass. What will the needle do? Why?", expectedConcepts: concepts, sourceChunkIds: [chunk.id], sourceMarkers: [] }),
      rewriteCoachQuestion: async (args) => args.question
    }
  });
  for (let r = await generator.next(); !r.done; r = await generator.next());
}

test("25. the next question's spec comes from freshly reloaded persisted evidence", async () => {
  const w = world(null);
  await turn(w, "Coach me on magnetism");
  assert.deepEqual(w.directorSaw, [0]);
  await turn(w, "Same ends push apart, opposite ends pull");
  await turn(w, "yes");
  assert.deepEqual(w.directorSaw, [0, 1], "the director saw the newly recorded attempt");
  await turn(w, "Same ends push apart, opposite ends pull");
  await turn(w, "yes");
  // Two independent successes: the control plane (not Coach) raises demand.
  assert.equal(w.issuedSpecs.at(-1)!.reasoningLevel, w.issuedSpecs[0].reasoningLevel + 1);
});
