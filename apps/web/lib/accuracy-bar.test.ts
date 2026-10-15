import assert from "node:assert/strict";
import test from "node:test";
import { passesCoverage, requiredCoverage } from "./accuracy-bar";

test("low accepts an answer that covers about half the guide", () => {
  const required = requiredCoverage("low", false);
  assert.equal(required, 0.5);
  assert.equal(passesCoverage(0.5, required), true);
  assert.equal(passesCoverage(0.49, required), false);
});

test("high rejects that same half answer and accepts about 90 percent", () => {
  const required = requiredCoverage("high", true);
  assert.equal(passesCoverage(0.5, required), false);
  assert.equal(passesCoverage(0.9, required), true);
});

test("a first pass uses the low bar without comparing wording", () => {
  const required = requiredCoverage(null, true);
  assert.equal(required, 0.5);
  assert.equal(passesCoverage(0.5, required), true);
});
