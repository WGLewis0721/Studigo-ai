import assert from "node:assert/strict";
import test from "node:test";
import { missionBeats, sourceSentences, tapCheck } from "./learn-tap";

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

test("government guide uses an actual question, not a heading as its answer", () => {
  const page = [
    "GOVERNMENT / STUDY MATERIALS",
    "Page 2",
    "Our Government Vocabulary",
    "The Constitution",
    "primary source — a record of an event made by a person who was there when it happened",
    "The legislative branch makes laws for the country and represents citizens.",
    "The judicial branch interprets laws and decides whether laws follow the Constitution."
  ].join("\n");
  const match = tapCheck("Our Government Vocabulary", page);
  assert.ok(match, "factual passage should supply grounded questions");
  assert.ok(match.sentences.every((line) => line.length >= 35));
  assert.ok(match.sentences.every((line) => !line.toLowerCase().startsWith("page 2") && !line.toLowerCase().startsWith("government /")));
  const beats = missionBeats("Our Government Vocabulary", match.sentences, match.target);
  assert.equal(beats[1]?.kind, "choice");
  if (beats[1]?.kind === "choice") {
    assert.equal(beats[1].prompt, 'What does "primary source" mean?');
    assert.ok(beats[1].options.every(line => line.split(/\s+/).length >= 5));
    assert.ok(beats[1].options.every(line => line !== "Our Government Vocabulary"));
  }
});
test("does not manufacture a question from OCR title-only material", () => {
  assert.equal(tapCheck("Vocabulary", ["STUDY GUIDE", "Page 2", "Contents", "Our Vocabulary"].join("\n")), null);
});
