import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CORRECT_THRESHOLD,
  IDLE_COACH_STATE,
  PARTIAL_THRESHOLD,
  decideOutcome,
  detectTurnIntent,
  normalizeExpectedConcepts,
  parseCoachState,
  scoreConcepts,
  type CoachState,
  type ExpectedConcept
} from "./coach";

// ---------------------------------------------------------------------------
// parseCoachState — malformed/foreign shapes must always collapse to idle,
// never throw. This is what keeps a corrupted or pre-migration row safe.
// ---------------------------------------------------------------------------

test("parseCoachState defaults unknown or malformed input to idle", () => {
  assert.deepEqual(parseCoachState(null), IDLE_COACH_STATE);
  assert.deepEqual(parseCoachState(undefined), IDLE_COACH_STATE);
  assert.deepEqual(parseCoachState({}), IDLE_COACH_STATE);
  assert.deepEqual(parseCoachState({ version: 2, kind: "idle" }), IDLE_COACH_STATE);
  assert.deepEqual(parseCoachState({ version: 1, kind: "awaiting_answer" }), IDLE_COACH_STATE);
  assert.deepEqual(parseCoachState("awaiting_answer"), IDLE_COACH_STATE);
});

test("parseCoachState round-trips a well-formed awaiting_answer state", () => {
  const state = {
    version: 1,
    kind: "awaiting_answer",
    question: "What is osmosis?",
    topicId: "topic-1",
    expectedConcepts: [{ id: "c1", description: "movement of water", weight: 1, critical: true }],
    sourceChunkIds: ["chunk-1", "chunk-2"],
    askedAt: "2026-09-23T00:00:00.000Z"
  };
  assert.deepEqual(parseCoachState(state), state);
});

test("parseCoachState round-trips a well-formed awaiting_control state", () => {
  const state = { version: 1, kind: "awaiting_control", action: "more_practice", topicId: null, sourceChunkIds: [] };
  assert.deepEqual(parseCoachState(state), state);
});

test("parseCoachState rejects an unknown control action", () => {
  const state = { version: 1, kind: "awaiting_control", action: "do_something_else", topicId: null, sourceChunkIds: [] };
  assert.deepEqual(parseCoachState(state), IDLE_COACH_STATE);
});

// ---------------------------------------------------------------------------
// detectTurnIntent — the routing invariant from the spec: "yes"/"no" while a
// question is pending is an ordinary answer attempt, but "next"/"stop"
// signals the learner wants out.
// ---------------------------------------------------------------------------

const AWAITING_ANSWER: CoachState = {
  version: 1,
  kind: "awaiting_answer",
  question: "q",
  topicId: null,
  expectedConcepts: [],
  sourceChunkIds: [],
  askedAt: "2026-09-23T00:00:00.000Z"
};

const AWAITING_CONTROL: CoachState = {
  version: 1,
  kind: "awaiting_control",
  action: "more_practice",
  topicId: null,
  sourceChunkIds: []
};

test("plain yes/no is state-aware while a question is pending", () => {
  const openEnded: CoachState = { ...AWAITING_ANSWER, question: "How do solid and liquid particles move differently?" };
  assert.equal(detectTurnIntent("yes", openEnded), "answer");
  assert.equal(detectTurnIntent("no", openEnded), "help_request");

  const yesNoQuestion: CoachState = { ...AWAITING_ANSWER, question: "Do solid particles move past each other?" };
  assert.equal(detectTurnIntent("yes", yesNoQuestion), "answer");
  assert.equal(detectTurnIntent("no", yesNoQuestion), "answer");
});

test("next/stop while a question is pending is conversation control", () => {
  assert.equal(detectTurnIntent("next", AWAITING_ANSWER), "conversation_control");
  assert.equal(detectTurnIntent("stop", AWAITING_ANSWER), "conversation_control");
});

test("yes/no/next while a control action is pending is always a command", () => {
  assert.equal(detectTurnIntent("yes", AWAITING_CONTROL), "conversation_control");
  assert.equal(detectTurnIntent("no", AWAITING_CONTROL), "conversation_control");
  assert.equal(detectTurnIntent("next", AWAITING_CONTROL), "conversation_control");
});

test("help and show-answer patterns are detected regardless of state", () => {
  assert.equal(detectTurnIntent("I don't know, can you give me a hint?", AWAITING_ANSWER), "help_request");
  assert.equal(detectTurnIntent("just show me the answer", AWAITING_ANSWER), "show_answer");
});

test("empty input is irrelevant", () => {
  assert.equal(detectTurnIntent("   ", AWAITING_ANSWER), "irrelevant");
});

// ---------------------------------------------------------------------------
// scoreConcepts / decideOutcome — the deterministic grading math. No model
// call decides pass/fail; these named thresholds do.
// ---------------------------------------------------------------------------

function concept(id: string, weight: number, critical = false): ExpectedConcept {
  return { id, description: id, weight, critical };
}

test("scoreConcepts sums weight x concept value and clamps to [0, 1]", () => {
  const expected = [concept("a", 0.6), concept("b", 0.4)];
  assert.equal(scoreConcepts(expected, [{ id: "a", status: "demonstrated" }, { id: "b", status: "demonstrated" }]), 1);
  assert.equal(scoreConcepts(expected, [{ id: "a", status: "demonstrated" }, { id: "b", status: "absent" }]), 0.6);
  assert.equal(scoreConcepts(expected, [{ id: "a", status: "partial" }, { id: "b", status: "absent" }]), 0.3);
  // a fully contradicted, b absent -> negative raw sum clamps to 0
  assert.equal(scoreConcepts(expected, [{ id: "a", status: "contradicted" }, { id: "b", status: "absent" }]), 0);
});

test("scoreConcepts treats an unmentioned concept as absent", () => {
  const expected = [concept("a", 1)];
  assert.equal(scoreConcepts(expected, []), 0);
});

test("decideOutcome routes non-content intents before scoring", () => {
  const base = { expectedConcepts: [], evaluated: [], score: 1 };
  assert.equal(decideOutcome({ ...base, intent: "conversation_control" }), "control");
  assert.equal(decideOutcome({ ...base, intent: "help_request" }), "help");
  assert.equal(decideOutcome({ ...base, intent: "show_answer" }), "help");
  assert.equal(decideOutcome({ ...base, intent: "irrelevant" }), "irrelevant");
});

test("decideOutcome: a contradicted critical concept is always incorrect, regardless of score", () => {
  const expected = [concept("a", 0.05, true), concept("b", 0.95)];
  const evaluated = [{ id: "a", status: "contradicted" as const }, { id: "b", status: "demonstrated" as const }];
  const score = scoreConcepts(expected, evaluated);
  assert.ok(score >= CORRECT_THRESHOLD, "score alone would read as correct");
  assert.equal(decideOutcome({ intent: "answer", expectedConcepts: expected, evaluated, score }), "incorrect");
});

test("decideOutcome applies the correct/partial/incorrect thresholds", () => {
  const expected = [concept("a", 1)];
  const above = decideOutcome({ intent: "answer", expectedConcepts: expected, evaluated: [], score: CORRECT_THRESHOLD });
  const mid = decideOutcome({ intent: "answer", expectedConcepts: expected, evaluated: [], score: PARTIAL_THRESHOLD });
  const below = decideOutcome({ intent: "answer", expectedConcepts: expected, evaluated: [], score: PARTIAL_THRESHOLD - 0.01 });
  assert.equal(above, "correct");
  assert.equal(mid, "partial");
  assert.equal(below, "incorrect");
});

// ---------------------------------------------------------------------------
// normalizeExpectedConcepts — weights always sum to 1 for a well-formed
// question, and empty/zero-weight input degrades to an even split.
// ---------------------------------------------------------------------------

test("normalizeExpectedConcepts scales weights to sum to 1", () => {
  const result = normalizeExpectedConcepts([
    { id: "a", description: "x", weight: 3, critical: false },
    { id: "b", description: "y", weight: 1, critical: false }
  ]);
  assert.equal(result.length, 2);
  const total = result.reduce((sum, c) => sum + c.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.equal(result[0].weight, 0.75);
  assert.equal(result[1].weight, 0.25);
});

test("normalizeExpectedConcepts splits evenly when all weights are zero or missing", () => {
  const result = normalizeExpectedConcepts([
    { id: "a", description: "x", weight: 0, critical: false },
    { id: "b", description: "y", weight: 0, critical: false }
  ]);
  assert.equal(result[0].weight, 0.5);
  assert.equal(result[1].weight, 0.5);
});

test("normalizeExpectedConcepts drops concepts with an empty description", () => {
  const result = normalizeExpectedConcepts([
    { id: "a", description: "", weight: 1, critical: false },
    { id: "b", description: "keep", weight: 1, critical: false }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "b");
});

test("normalizeExpectedConcepts returns an empty array for empty input", () => {
  assert.deepEqual(normalizeExpectedConcepts(undefined), []);
  assert.deepEqual(normalizeExpectedConcepts([]), []);
});

test("normalizeExpectedConcepts assigns stable positional ids (concept_1, concept_2, ...) when the model omits an id, never a random one", () => {
  const raw = [
    { id: "", description: "first idea", weight: 1, critical: false },
    { id: "   ", description: "second idea", weight: 1, critical: false },
    { id: "custom_id", description: "third idea", weight: 1, critical: false }
  ];

  const first = normalizeExpectedConcepts(raw);
  const second = normalizeExpectedConcepts(raw);

  assert.deepEqual(first.map((c) => c.id), ["concept_1", "concept_2", "custom_id"]);
  // Repeatability: the exact same input yields the exact same ids every
  // time, unlike a Math.random()-based fallback which would differ per call.
  assert.deepEqual(second.map((c) => c.id), first.map((c) => c.id));
});

test("normalizeExpectedConcepts keeps positional numbering based on the concept's position in the raw list, not its post-filter position", () => {
  const raw = [
    { id: "", description: "", weight: 1, critical: false }, // dropped: empty description
    { id: "", description: "kept", weight: 1, critical: false }
  ];
  const result = normalizeExpectedConcepts(raw);
  assert.equal(result.length, 1);
  // This concept was at raw index 1, so its positional id is concept_2 even
  // though it is the only surviving concept after filtering.
  assert.equal(result[0].id, "concept_2");
});
