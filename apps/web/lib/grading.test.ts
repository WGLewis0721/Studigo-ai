import assert from "node:assert/strict";
import test from "node:test";
import { GradingError, gradeAnswer, readConfidence, readSelectedChoice, type GradableQuestion } from "./grading";

const trueFalse: GradableQuestion = {
  kind: "true_false",
  prompt: "Supercells can produce tornadoes.",
  choices: ["True", "False"],
  correct_choice: 0,
  expected_answer: null,
  accepted_answers: null,
  explanation: "The guide says rotating updrafts can tighten into a tornado."
};

const fillBlank: GradableQuestion = {
  kind: "fill_blank",
  prompt: "Water vapour turning to liquid is ____.",
  choices: null,
  correct_choice: null,
  expected_answer: "condensation",
  accepted_answers: ["condensation", "condensing"],
  explanation: "Chapter 7 names the process."
};

const multipleChoice: GradableQuestion = {
  kind: "multiple_choice",
  prompt: "What drives a supercell?",
  choices: ["A rotating updraft", "A warm front", "A jet stream", "A sea breeze"],
  correct_choice: 0,
  expected_answer: null,
  accepted_answers: null,
  explanation: "The rotating updraft is the defining feature."
};

test("true/false is graded on the chosen index", async () => {
  const right = await gradeAnswer({ question: trueFalse, response: "", selectedChoice: 0 });
  const wrong = await gradeAnswer({ question: trueFalse, response: "", selectedChoice: 1 });

  assert.equal(right.isCorrect, true);
  assert.equal(right.score, 100);
  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.score, 0);
});

test("multiple choice and true/false share one scoring rule", async () => {
  const graded = await gradeAnswer({ question: multipleChoice, response: "", selectedChoice: 2 });

  assert.equal(graded.isCorrect, false);
  assert.equal(graded.feedback, multipleChoice.explanation);
});

test("a fill-in answer is graded against every accepted spelling", async () => {
  const exact = await gradeAnswer({ question: fillBlank, response: "Condensation", selectedChoice: null });
  const alternate = await gradeAnswer({ question: fillBlank, response: "condensing", selectedChoice: null });
  const wrong = await gradeAnswer({ question: fillBlank, response: "evaporation", selectedChoice: null });

  assert.equal(exact.isCorrect, true);
  assert.equal(alternate.isCorrect, true);
  assert.equal(wrong.isCorrect, false);
  assert.match(wrong.feedback, /condensation/, "a miss names the answer the learner needed");
});

test("a single quiz question refuses an empty submission instead of scoring it", async () => {
  await assert.rejects(
    () => gradeAnswer({ question: fillBlank, response: "  ", selectedChoice: null }),
    GradingError
  );
  await assert.rejects(
    () => gradeAnswer({ question: trueFalse, response: "", selectedChoice: null }),
    GradingError
  );
});

test("a practice test scores a skipped question as a miss rather than failing the submission", async () => {
  const skippedChoice = await gradeAnswer({
    question: multipleChoice, response: "", selectedChoice: null, allowUnanswered: true
  });
  const skippedBlank = await gradeAnswer({
    question: fillBlank, response: "", selectedChoice: null, allowUnanswered: true
  });

  for (const graded of [skippedChoice, skippedBlank]) {
    assert.equal(graded.isCorrect, false);
    assert.equal(graded.score, 0);
    assert.match(graded.feedback, /Unanswered/);
  }
});

test("a choice outside the options actually offered is discarded", () => {
  assert.equal(readSelectedChoice(2, trueFalse), null, "true/false has only two options");
  assert.equal(readSelectedChoice(1, trueFalse), 1);
  assert.equal(readSelectedChoice(3, multipleChoice), 3);
  assert.equal(readSelectedChoice(4, multipleChoice), null);
  assert.equal(readSelectedChoice(-1, multipleChoice), null);
  assert.equal(readSelectedChoice("1", multipleChoice), null);
});

test("only the three defined confidence levels are recorded", () => {
  assert.equal(readConfidence(1), 1);
  assert.equal(readConfidence(3), 3);
  assert.equal(readConfidence(0), null);
  assert.equal(readConfidence(4), null);
  assert.equal(readConfidence("3"), null);
  assert.equal(readConfidence(undefined), null);
});
