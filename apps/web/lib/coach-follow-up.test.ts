import assert from "node:assert/strict";
import test from "node:test";
import { followUpQuestion } from "./coach-follow-up";

const pending = "Who leads the national government, and where do those leaders work?";
const asked = "President, not Congress. The President works in Washington, D.C. Can you now tell me who leads the state government and where they work?";

test("a new question in the last reply is the one the learner is answering", () => {
  assert.equal(
    followUpQuestion(pending, asked),
    "Can you now tell me who leads the state government and where they work?"
  );
});

test("the same question is not treated as a new one", () => {
  assert.equal(followUpQuestion(pending, `Not quite. ${pending}`), null);
});

test("a hint nudge does not replace the question", () => {
  assert.equal(followUpQuestion(pending, "Want a hint?"), null);
});
