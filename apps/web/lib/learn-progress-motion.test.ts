import assert from "node:assert/strict";
import test from "node:test";
import { isForwardLearnAdvance, learnPhaseProgress, LEARN_PROGRESS_HEAT, LEARN_PROGRESS_PERCENT } from "./learn-progress-motion";
import { LEARN_PHASES } from "./learning-mission-stages";

test("five persisted lesson phases visibly advance in >=22 point increments", () => {
  const values = LEARN_PHASES.map(learnPhaseProgress);
  assert.deepEqual(values, [12,34,56,78,100]);
  assert.ok(values.slice(1).every((n,i) => n - values[i] >= 22));
});

test("positive forward motion only in same quest, never on back, resume or other quest", () => {
  assert.equal(isForwardLearnAdvance(null, { topicId: "a", phase: "brief" }), false);
  assert.equal(isForwardLearnAdvance({ topicId: "a", phase: "brief" }, { topicId: "a", phase: "show" }), true);
  assert.equal(isForwardLearnAdvance({ topicId: "a", phase: "show" }, { topicId: "a", phase: "show" }), false);
  assert.equal(isForwardLearnAdvance({ topicId: "a", phase: "show" }, { topicId: "a", phase: "brief" }), false);
  assert.equal(isForwardLearnAdvance({ topicId: "a", phase: "show" }, { topicId: "b", phase: "try" }), false);
});

test("progress heat uses only declared Studigo design tokens", () => {
  assert.deepEqual(Object.keys(LEARN_PROGRESS_PERCENT), [...LEARN_PHASES]);
  assert.ok(Object.values(LEARN_PROGRESS_HEAT).every((color) =>
    /^var\(--(?:tangerine|dandelion|kiwi)\)$|^color-mix\(in oklab, var\(--(?:tangerine|dandelion|kiwi)\) [0-9]+%, var\(--(?:tangerine|dandelion|kiwi)\)\)$/.test(color)));
});
