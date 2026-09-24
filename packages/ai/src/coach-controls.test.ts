import assert from "node:assert/strict";
import { test } from "node:test";
import { IDLE_COACH_STATE, detectTurnIntent, type CoachState } from "./coach";

const pending: CoachState = {
  version: 1,
  kind: "awaiting_answer",
  question: "What happens when ice melts?",
  topicId: null,
  expectedConcepts: [],
  sourceChunkIds: [],
  askedAt: "2026-01-01T00:00:00.000Z"
};

test("Coach control phrases route deterministically", () => {
  assert.equal(detectTurnIntent("Make it simpler", pending), "simplify");
  assert.equal(detectTurnIntent("Show me an example", pending), "example");
  assert.equal(detectTurnIntent("Challenge me", pending), "challenge");
  assert.equal(detectTurnIntent("Give me a hint", pending), "help_request");
  assert.equal(detectTurnIntent("show me the answer", pending), "show_answer");
});

test("long answers that mention a control word are still answers", () => {
  assert.equal(
    detectTurnIntent("For example the ice gets warmer and it turns into water because heat breaks it apart", pending),
    "answer"
  );
});

test("yes/no/next stay control commands", () => {
  const control: CoachState = { version: 1, kind: "awaiting_control", action: "more_practice", topicId: null, sourceChunkIds: [] };
  for (const word of ["yes", "no", "next"]) assert.equal(detectTurnIntent(word, control), "conversation_control");
  assert.equal(detectTurnIntent("yes", pending), "answer");
  assert.equal(detectTurnIntent("next", IDLE_COACH_STATE), "answer");
});
