import assert from "node:assert/strict";
import test from "node:test";
import { missionBeats, sourceSentences } from "./learn-tap";

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

test("a level reads, then plays a choice, a blank, and checkboxes", () => {
  const sentences = [
    "Some animal behaviors are inherited.",
    "Other behaviors are learned through experience.",
  ];
  const beats = missionBeats("Explain which behaviors are inherited.", sentences, 0, "simpler");
  assert.deepEqual(beats.map((beat) => beat.kind), ["read", "choice", "blank", "boxes"]);
  const choice = beats[1];
  assert.equal(choice.kind, "choice");
  if (choice.kind !== "choice") return;
  assert.equal(choice.prompt, "Which one is it?");
  assert.equal(choice.options[choice.answer], sentences[0]);
  const blank = beats[2];
  assert.equal(blank.kind, "blank");
  if (blank.kind !== "blank") return;
  assert.ok(blank.options.includes(blank.answer));
  const boxes = beats[3];
  assert.equal(boxes.kind, "boxes");
  if (boxes.kind !== "boxes") return;
  assert.ok(boxes.answers.includes(boxes.options.indexOf(sentences[0])));
});

test("deeper delivery changes the prompt, not the source line", () => {
  const sentences = ["A net force changes an object's motion.", "Balanced forces leave velocity the same."];
  const deeper = missionBeats("Explain what a net force does.", sentences, 0, "deeper");
  const choice = deeper.find((beat) => beat.kind === "choice");
  assert.equal(choice?.kind, "choice");
  if (choice?.kind !== "choice") return;
  assert.equal(choice.prompt, "Which line is the one?");
  assert.equal(choice.options[choice.answer], sentences[0]);
});
