import assert from "node:assert/strict";
import { test } from "node:test";
import { assessLanguageFloor, enforceLanguageFloor, languageFloorViolations, rewriteLosesDemand } from "./coach-language";

test("the lint catches stacked tasks, formal connectors and long-word pile-ups", () => {
  assert.ok(assessLanguageFloor("Explain photosynthesis and describe its stages?").taskVerbs > 1);
  assert.deepEqual(assessLanguageFloor("What is the process by which ice melts?").academicPhrases, ["the process by which"]);
  assert.ok(languageFloorViolations("Why does electromagnetic interference complicate telecommunications infrastructure?").length > 0);
  // One defined technical word stays allowed.
  assert.deepEqual(languageFloorViolations("Photosynthesis is how plants make food. Why do plants need light for it?"), []);
  // Plain reasoning questions pass.
  assert.deepEqual(languageFloorViolations("Candle wax turns liquid when it gets hot. Is that like melting ice? Why?"), []);
});

test("the reasoning guard rejects rewrites that make the thinking easier", () => {
  assert.equal(rewriteLosesDemand("Why do like poles push apart?", "What do like poles do?", true), "dropped the reasoning demand");
  assert.equal(rewriteLosesDemand("Predict what the car will do.", "Is the car a magnet?", true), "dropped the reasoning demand");
  assert.equal(rewriteLosesDemand("Name the pole [1].", "Is this the north pole?", true), "became a bare yes/no question");
  assert.equal(rewriteLosesDemand("Why does ice melt?", "Why does ice melt [2]?", true), "cited a source the question did not");
  assert.equal(rewriteLosesDemand("Why does ice melt in the sun [1]?", "Why does ice melt in the sun [1]?", true), null);
});

const failing = "Explain the process by which ice melts and describe why?";

test("a passing question is never rewritten", async () => {
  let calls = 0;
  const result = await enforceLanguageFloor({ question: "Why does ice melt?", requiresReasoning: true, rewrite: async () => { calls++; return "x"; } });
  assert.equal(calls, 0);
  assert.equal(result.enforcement.passedInitially, true);
});

test("a failing question gets exactly one rewrite, which is used only if it passes", async () => {
  let calls = 0;
  let violationsSeen: string[] = [];
  const result = await enforceLanguageFloor({
    question: failing,
    requiresReasoning: true,
    rewrite: async (violations) => { calls++; violationsSeen = violations; return "Ice melts in a warm room. Why does that happen?"; }
  });
  assert.equal(calls, 1);
  assert.ok(violationsSeen.length > 0);
  assert.equal(result.question, "Ice melts in a warm room. Why does that happen?");
  assert.equal(result.enforcement.rewriteAccepted, true);
});

test("no rewrite loop: a still-failing rewrite keeps the original after one call", async () => {
  let calls = 0;
  const result = await enforceLanguageFloor({
    question: failing,
    requiresReasoning: true,
    rewrite: async () => { calls++; return "Explain and describe why ice melts, whereby heat moves?"; }
  });
  assert.equal(calls, 1);
  assert.equal(result.question, failing);
  assert.equal(result.enforcement.rewriteAccepted, false);
  assert.match(result.enforcement.rejectedReason ?? "", /still/);
});

test("a plain but easier rewrite is rejected; difficulty is never traded for the floor", async () => {
  const result = await enforceLanguageFloor({ question: failing, requiresReasoning: true, rewrite: async () => "What is melting?" });
  assert.equal(result.question, failing);
  assert.equal(result.enforcement.rejectedReason, "dropped the reasoning demand");
});

test("a failed rewrite call keeps the original", async () => {
  const result = await enforceLanguageFloor({ question: failing, requiresReasoning: true, rewrite: async () => { throw new Error("network"); } });
  assert.equal(result.question, failing);
  assert.equal(result.enforcement.rejectedReason, "rewrite unavailable");
});
