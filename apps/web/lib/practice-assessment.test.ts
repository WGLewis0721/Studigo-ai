import assert from "node:assert/strict";
import test from "node:test";
import { ASSESSMENT_MODES, QUIZ_QUESTION_COUNTS, TEST_QUESTION_COUNTS, spokenQuestion } from "./practice-assessment";

test("question count choices are bounded by the existing quiz and practice-test APIs", () => {
  assert.deepEqual(QUIZ_QUESTION_COUNTS, [3, 5, 10]);
  assert.deepEqual(TEST_QUESTION_COUNTS, [6, 10, 15, 20]);
  assert.deepEqual(ASSESSMENT_MODES, ["multiple_choice", "fill_blank", "true_false"]);
});

test("speech includes prompts and visible answer choices without exposing a key", () => {
  assert.equal(spokenQuestion({kind:"multiple_choice", prompt:"What is a vote?", choices:["A choice", "A drawing"]}),
    "What is a vote? Option A: A choice. Option B: A drawing.");
  assert.equal(spokenQuestion({kind:"true_false", prompt:"Everyone votes.", choices:["True","False"]}),
    "Everyone votes. Option A: True. Option B: False.");
});

test("speech pronounces blanks and never reads the hidden answer", () => {
  assert.equal(spokenQuestion({kind:"fill_blank",prompt:"A ____ is counted.",choices:[]}),"A blank is counted.");
});
