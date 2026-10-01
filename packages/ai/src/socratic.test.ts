import assert from "node:assert/strict";
import test from "node:test";
import { EXPLAIN_OUTLINE_STRUCTURE, normalizeSocraticResponse } from "./study";

const QUESTION = "Why does ice float on liquid water?";

test("understood ends the check and carries no follow-up, even if the model wrote one", () => {
  const result = normalizeSocraticResponse(
    { verdict: "understood", feedback: "Yes, it is less dense [1].", follow_up: "Anything else?" },
    QUESTION
  );
  assert.equal(result.verdict, "understood");
  assert.equal(result.understood, true);
  assert.equal(result.followUp, null);
});

test("anything short of understood keeps a question open, so a reply never dead-ends the learner", () => {
  for (const verdict of ["partial", "not_sure", "off_topic"]) {
    const result = normalizeSocraticResponse({ verdict, feedback: "Not yet.", follow_up: null }, QUESTION);
    assert.equal(result.understood, false, verdict);
    assert.equal(result.followUp, QUESTION, `${verdict} falls back to asking the original question again`);
  }
});

test("the model's own follow-up is used when it wrote one", () => {
  const result = normalizeSocraticResponse(
    { verdict: "not_sure", feedback: "Think about density.", follow_up: "What happens to water when it freezes?" },
    QUESTION
  );
  assert.equal(result.followUp, "What happens to water when it freezes?");
});

test("an empty or missing feedback is replaced with a plain line that fits the verdict", () => {
  const offTopic = normalizeSocraticResponse({ verdict: "off_topic", feedback: "  ", follow_up: null }, QUESTION);
  assert.match(offTopic.feedback, /does not answer the question/);
  const unsure = normalizeSocraticResponse({ verdict: "not_sure", follow_up: null }, QUESTION);
  assert.match(unsure.feedback, /first guess/);
});

test("an unknown verdict from the model is treated as a half answer, never as understood", () => {
  const result = normalizeSocraticResponse({ verdict: "great", feedback: "ok", follow_up: null }, QUESTION);
  assert.equal(result.verdict, "partial");
  assert.equal(result.understood, false);
  const legacy = normalizeSocraticResponse({ understood: true, feedback: "ok", follow_up: null }, QUESTION);
  assert.equal(legacy.verdict, "understood", "a reply in the older shape still reads correctly");
});

test("a lesson is asked for as an outline in a fixed order, and leaves out sections the material lacks", () => {
  assert.match(EXPLAIN_OUTLINE_STRUCTURE, /Key points for the test/);
  assert.match(EXPLAIN_OUTLINE_STRUCTURE, /Example from the material/);
  assert.match(EXPLAIN_OUTLINE_STRUCTURE, /Common mistake/);
  assert.match(EXPLAIN_OUTLINE_STRUCTURE, /Leave a section out rather than pad it/);
});
