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
  assert.match(choice.prompt, /Which statement from your guide explains/);
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
  assert.match(choice.prompt, /Which statement from your guide explains/);
  assert.equal(choice.options[choice.answer], sentences[0]);
});

test("government source question names the concept instead of asking Which one is it", () => {
  const lines = [
    "GOVERNMENT / STUDY MATERIALS",
    "Our Government Vocabulary",
    "primary source — a record of an event made by a person who was there when the event happened",
    "secondary source — a retelling made by someone who did not witness the event",
    "The Constitution is the written plan for the United States government.",
  ];
  const beats = missionBeats("Our Government Vocabulary", lines, 2, "simpler");
  assert.deepEqual(beats.map((beat) => beat.kind), ["read", "choice", "blank", "boxes"]);
  const question = beats[1];
  assert.equal(question.kind, "choice");
  if (question.kind !== "choice") return;
  assert.equal(question.prompt, "Which line from your guide explains what primary source means?");
  assert.equal(question.options[question.answer], lines[2]);
  assert.equal(question.options.some((option) => option === "GOVERNMENT / STUDY MATERIALS"), false);
  assert.equal(question.options.some((option) => option === "Our Government Vocabulary"), false);
});

test("never repeat a question when a document chunk contains only headings", () => {
  assert.deepEqual(missionBeats("Government vocabulary", ["GOVERNMENT / STUDY MATERIALS", "Page 2", "Our Government Vocabulary"], 0), []);
});

test("two eligible facts still produce exactly one activity per server cursor phase", () => {
  const beats = missionBeats("What is an inherited behavior?", [
    "An inherited behavior is a response that an animal is born knowing how to do.",
    "A learned behavior is something an animal develops through practice and experience.",
  ], 0, "simpler");
  assert.deepEqual(beats.map((beat) => beat.kind), ["read", "choice", "blank", "boxes"]);
  assert.match((beats[1].kind === "choice" ? beats[1].prompt : ""), /inherited behavior/);
});
