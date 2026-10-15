import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleTurn, hintStreak, nextHint } from "./coach-help";

test("three hints in a row move from a clue to a stronger clue to the answer", () => {
  assert.equal(nextHint(1), "hint");
  assert.equal(nextHint(2), "stronger");
  assert.equal(nextHint(3), "reveal");
});

test("any other action resets the hint streak", () => {
  assert.equal(hintStreak(2, "other"), 0);
  assert.equal(hintStreak(2, "hint"), 3);
});

test("an example shows the shape and repeats the same question", () => {
  const turn = exampleTurn("Who enforces the laws?", "Name the branch and its job.");
  assert.equal(turn.question, "Who enforces the laws?");
});
