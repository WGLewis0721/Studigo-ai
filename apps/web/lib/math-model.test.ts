import assert from "node:assert/strict";
import test from "node:test";
import { gradeMath, mathModelFromPrompt, rejectForeignLabel } from "./math-model";

test("1/2 + 1/4 is a fraction bar with prompt digits and answer 0.75", () => {
  const model = mathModelFromPrompt("1/2 + 1/4");

  assert.ok(model);
  assert.equal(model.kind, "fraction-bar");
  assert.equal(model.examples.length, 2);
  assert.ok(model.labels.length > 0);
  assert.ok(model.labels.every((token) => ["1", "2", "4"].includes(token)));
  assert.equal(model.answer, 0.75);
});

test("gradeMath accepts 3/4 and rejects 9", () => {
  const model = mathModelFromPrompt("1/2 + 1/4");

  assert.ok(model);
  assert.equal(gradeMath(model, "3/4"), true);
  assert.equal(gradeMath(model, "9"), false);
});

test("rejectForeignLabel rejects a label that is not on the model", () => {
  const model = mathModelFromPrompt("1/2 + 1/4");

  assert.ok(model);
  assert.equal(rejectForeignLabel(model, "pi"), true);
});
