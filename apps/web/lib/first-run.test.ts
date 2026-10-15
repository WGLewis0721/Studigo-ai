import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE, canLeaveMaterial, resumeFirstRun, sampleMastery } from "./first-run";

test('canLeaveMaterial("") is true', () => {
  assert.equal(canLeaveMaterial(""), true);
});

test("SAMPLE.labeled is true and sampleMastery() is 0", () => {
  assert.equal(SAMPLE.labeled, true);
  assert.equal(sampleMastery(), 0);
});

test('resumeFirstRun("lesson") is "lesson" and resumeFirstRun("nope") is "material"', () => {
  assert.equal(resumeFirstRun("lesson"), "lesson");
  assert.equal(resumeFirstRun("nope"), "material");
});
