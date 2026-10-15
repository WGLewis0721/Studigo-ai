import assert from "node:assert/strict";
import test from "node:test";
import { sourceSentences } from "./learn-tap";

test("study-guide lines stay separate instead of gluing into one sentence", () => {
  const excerpt = [
    "They make the laws for our country",
    "Judicial Branch",
    "Who?",
    "The United States Supreme Court - Judges",
    "Where?",
    "The Supreme Court Building",
    "Job?",
    "Makes sure the laws are fair by comparing them to the Constitution",
  ].join("\n");
  assert.deepEqual(sourceSentences(excerpt), [
    "They make the laws for our country",
    "Judicial Branch",
    "Who? The United States Supreme Court - Judges",
    "Where? The Supreme Court Building",
    "Job? Makes sure the laws are fair by comparing them to the Constitution",
  ]);
});

test("prose still splits on sentence punctuation", () => {
  assert.deepEqual(
    sourceSentences("Some animal behaviors are inherited. Other behaviors are learned through experience."),
    ["Some animal behaviors are inherited.", "Other behaviors are learned through experience."],
  );
});
