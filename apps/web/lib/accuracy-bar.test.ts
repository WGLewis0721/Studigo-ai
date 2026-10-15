import assert from "node:assert/strict";
import test from "node:test";
import { gaugeOutcome } from "./accuracy-bar";

test("a cold gauge accepts most of an answer and still leaves the rest to correct", () => {
  assert.equal(gaugeOutcome(0.67, 50), "partial");
  assert.equal(gaugeOutcome(1, 50), "correct");
});

test("a hot gauge rejects that same partial answer", () => {
  assert.equal(gaugeOutcome(0.67, 95), "incorrect");
  assert.equal(gaugeOutcome(0.95, 95), "correct");
});

test("the mark moves with the gauge and wording is not compared", () => {
  assert.equal(gaugeOutcome(0.8, 80), "partial");
  assert.equal(gaugeOutcome(0.5, 80), "incorrect");
});
