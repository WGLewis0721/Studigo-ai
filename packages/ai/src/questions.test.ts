import assert from "node:assert/strict";
import test from "node:test";
import {
  BLANK_MARKER,
  gradeBlankAnswer,
  normalizeBlankAnswer,
  normalizeGeneratedQuestion
} from "./study";

const base = {
  explanation: "Because the material says so.",
  difficulty: "core",
  source_markers: [1]
};

test("a true/false item keeps its two fixed choices and a binary key", () => {
  const question = normalizeGeneratedQuestion(
    { ...base, kind: "true_false", prompt: "Supercells can produce tornadoes.", choices: [], correct_choice: 0 },
    3
  );

  assert.ok(question);
  assert.deepEqual(question.choices, ["True", "False"]);
  assert.equal(question.correctChoice, 0);
  assert.deepEqual(question.acceptedAnswers, []);
});

test("a true/false item with no answer key is discarded rather than shown", () => {
  assert.equal(
    normalizeGeneratedQuestion(
      { ...base, kind: "true_false", prompt: "Fronts move.", choices: [], correct_choice: null },
      3
    ),
    null
  );
});

test("a fill-in item must carry exactly one blank", () => {
  const none = normalizeGeneratedQuestion(
    { ...base, kind: "fill_blank", prompt: "Condensation forms clouds.", expected_answer: "condensation", accepted_answers: [] },
    3
  );
  const two = normalizeGeneratedQuestion(
    {
      ...base,
      kind: "fill_blank",
      prompt: `${BLANK_MARKER} forms when ${BLANK_MARKER} cools.`,
      expected_answer: "condensation",
      accepted_answers: []
    },
    3
  );

  assert.equal(none, null, "no blank is unanswerable");
  assert.equal(two, null, "two blanks are ambiguous to grade");
});

test("the expected answer is always an accepted spelling, even if the model omitted it", () => {
  const question = normalizeGeneratedQuestion(
    {
      ...base,
      kind: "fill_blank",
      prompt: `Water vapour turning to liquid is ${BLANK_MARKER}.`,
      expected_answer: "condensation",
      accepted_answers: ["condensing"]
    },
    3
  );

  assert.ok(question);
  assert.deepEqual(question.acceptedAnswers, ["condensation", "condensing"]);
});

test("a stem that already contains its own answer is rejected", () => {
  assert.equal(
    normalizeGeneratedQuestion(
      {
        ...base,
        kind: "fill_blank",
        prompt: `Condensation happens when vapour cools, so the process is called ${BLANK_MARKER}.`,
        expected_answer: "condensation",
        accepted_answers: ["condensation"]
      },
      3
    ),
    null
  );
});

test("a multiple-choice item needs four distinct options", () => {
  const duplicated = normalizeGeneratedQuestion(
    {
      ...base,
      kind: "multiple_choice",
      prompt: "What drives a supercell?",
      choices: ["Updraft", "Updraft", "Downdraft", "Shear"],
      correct_choice: 0
    },
    3
  );

  assert.equal(duplicated, null);
});

test("citation markers beyond the supplied excerpts are dropped", () => {
  const question = normalizeGeneratedQuestion(
    { ...base, kind: "true_false", prompt: "Fronts collide.", correct_choice: 1, source_markers: [1, 9, 2] },
    3
  );

  assert.ok(question);
  assert.deepEqual(question.sourceMarkers, [1, 2]);
});

test("blank answers are compared without case, accents, padding or articles", () => {
  assert.equal(normalizeBlankAnswer("  The  Water-Cycle "), "water cycle");
  assert.equal(normalizeBlankAnswer("Évaporation"), "evaporation");
});

test("a correct blank answer is graded locally, with no model call", () => {
  const grade = gradeBlankAnswer({
    learnerAnswer: "  Condensation ",
    acceptedAnswers: ["condensation", "condensing"]
  });

  assert.equal(grade.isCorrect, true);
  assert.equal(grade.score, 100);
  assert.equal(grade.matched, "condensation");
});

test("one typo in a long term still counts as knowing it", () => {
  const grade = gradeBlankAnswer({ learnerAnswer: "photosynthisis", acceptedAnswers: ["photosynthesis"] });

  assert.equal(grade.isCorrect, true);
  assert.equal(grade.score, 85, "a near miss is credited, but not as full marks");
});

test("a different short word is not forgiven as a typo", () => {
  // "mass" vs "mars" is one edit, but short terms are exactly where a one-edit
  // rule would mark a wrong answer correct.
  assert.equal(gradeBlankAnswer({ learnerAnswer: "mars", acceptedAnswers: ["mass"] }).isCorrect, false);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "evaporation", acceptedAnswers: ["condensation"] }).isCorrect, false);
  assert.equal(gradeBlankAnswer({ learnerAnswer: "   ", acceptedAnswers: ["condensation"] }).isCorrect, false);
});
