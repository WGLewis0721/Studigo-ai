import assert from "node:assert/strict";
import test from "node:test";
import { MATH_FAMILIES, generateMathProblems, mathAnswerText, mathVisual, seededRandom } from "./learning";
import { GradingError, gradeAnswer, type GradableQuestion } from "./grading";
import { describeMathVisual, mathPrompt, mathSteps } from "./math-copy";
import { buildMathQuestions, isMathKey, mathFamilyForTopic, mathSolution, readMathKey } from "./math-practice";

const BLANK = "____";

test("a topic is given math practice only when its whole title names a skill a family covers", () => {
  const practised: Array<[Parameters<typeof mathFamilyForTopic>[0], string]> = [
    [{ title: "Adding fractions with like denominators" }, "fraction_add_like"],
    [{ title: "Adding Fractions" }, "fraction_add_like"],
    [{ title: "Adding Fractions", objective: "Rewrite each fraction as an equivalent fraction with a common denominator, then add." }, "fraction_add_unlike"],
    [{ title: "Unit 4: Adding fractions with unlike denominators" }, "fraction_add_unlike"],
    [{ title: "Subtracting Fractions", objective: "Subtract fractions that have the same denominator." }, "fraction_subtract_like"],
    [{ title: "Equivalent Fractions" }, "fraction_equivalent"],
    [{ title: "Fractions", objective: "A fraction names equal parts of a whole." }, "fraction_name"],
    [{ title: "What is a fraction?" }, "fraction_name"],
    [{ title: "Area of a Rectangle" }, "rect_area"],
    [{ title: "Lesson 2 - Finding the area of rectangles and squares" }, "rect_area"],
    [{ title: "Ratios", key_terms: ["ratio table"] }, "ratio_scale"],
    [{ title: "Equivalent ratios" }, "ratio_scale"]
  ];
  for (const [topic, family] of practised) assert.equal(mathFamilyForTopic(topic), family, topic.title);

  const leftAlone: Array<Parameters<typeof mathFamilyForTopic>[0]> = [
    // Other subjects that happen to use the word.
    { title: "The American Revolution", objective: "Only a fraction of the colonists stayed loyal; the ratio shifted over time." },
    { title: "Photosynthesis", key_terms: ["leaf area"] },
    { title: "Financial Ratios", objective: "Compute the current ratio and debt-to-equity ratio from a balance sheet." },
    { title: "Mole Ratios in Stoichiometry" },
    { title: "Inference for Proportions" },
    { title: "Odds Ratios" },
    { title: "Genotypic and Phenotypic Ratios" },
    { title: "Law of Definite Proportions" },
    { title: "Ejection Fraction" },
    { title: "Partial Fractions" },
    { title: "Area Under a Curve", objective: "Approximate area with left and right rectangular sums." },
    { title: "Area Model for Multiplication", objective: "Use a rectangular area model." },
    // Math skills no family covers.
    { title: "Dividing fractions" },
    { title: "Simplifying Fractions" },
    { title: "Fractions of an Amount" },
    { title: "Fractions on a Number Line" },
    { title: "Fractions and decimals" },
    { title: "Comparing fractions" },
    { title: "Fraction word problems" },
    { title: "Adding and subtracting fractions" },
    { title: "Subtracting fractions with unlike denominators" },
    { title: "Introduction to Fractions", objective: "Identify the numerator and denominator. In addition, place fractions on a number line." },
    { title: "Fractions", objective: "Add and subtract fractions." },
    { title: "Area" },
    { title: "Area", key_terms: ["rectangle", "square units"] },
    { title: "Area of a triangle" },
    { title: "Surface area of rectangular prisms" },
    { title: "Area and perimeter of rectangles" },
    { title: "Unit rates and ratios" },
    { title: "Ratios and percent" },
    { title: "Ratios", objective: "Find the unit rate." }
  ];
  for (const topic of leftAlone) assert.equal(mathFamilyForTopic(topic), null, topic.title);
});

test("a room whose subject is not math never gets math practice, whatever a topic is called", () => {
  const topic = { title: "Ratios" };
  assert.equal(mathFamilyForTopic(topic), "ratio_scale");
  for (const subject of ["Math", "5th grade math", "Mathematics", "Pre-Algebra", null, "", "  "]) {
    assert.equal(mathFamilyForTopic(topic, { subject }), "ratio_scale", String(subject));
  }
  for (const subject of ["Chemistry", "Science", "Accounting", "US History", "Biology"]) {
    assert.equal(mathFamilyForTopic(topic, { subject }), null, subject);
  }
});

test("a math quiz row carries its own key, no citation, and an answer the grader agrees with", async () => {
  for (const family of MATH_FAMILIES) {
    const built = buildMathQuestions(family, 5);
    assert.ok(built.length >= 3, family);
    assert.equal(new Set(built.map(({ row }) => row.id)).size, built.length);
    for (const { row, problem } of built) {
      assert.equal(row.kind, "fill_blank");
      assert.equal(row.prompt.split(BLANK).length, 2, "exactly one blank");
      assert.deepEqual(row.citations, []);
      assert.deepEqual(readMathKey(row.accepted_answers), problem);
      assert.equal(row.expected_answer, mathAnswerText(problem));
      assert.ok(mathSolution(problem).at(-1)!.text.includes(row.expected_answer));

      const question: GradableQuestion = { ...row, choices: null };
      const right = await gradeAnswer({ question, response: ` ${row.expected_answer} `, selectedChoice: null });
      assert.deepEqual([right.isCorrect, right.score], [true, 100]);
      const wrong = await gradeAnswer({ question, response: `${row.expected_answer}9`, selectedChoice: null });
      assert.deepEqual([wrong.isCorrect, wrong.score], [false, 0]);
      assert.ok(wrong.feedback.includes(row.expected_answer));
    }
  }
});

test("math is graded by value, and an answer that cannot be read is sent back instead of marked wrong", async () => {
  const [{ row }] = buildMathQuestions("fraction_add_like", 1);
  const question: GradableQuestion = { ...row, choices: null, accepted_answers: ['studigo-math:v1:{"v":1,"family":"fraction_add_like","a":1,"b":1,"d":4}'], expected_answer: "1/2" };

  for (const response of ["1/2", "2/4", "0.5", "4 / 8", "½"]) {
    assert.equal((await gradeAnswer({ question, response, selectedChoice: null })).isCorrect, true, response);
  }
  assert.match((await gradeAnswer({ question, response: "2/4", selectedChoice: null })).feedback, /simplest form that is 1\/2/);
  for (const response of ["half", "1/0", "2 quarters", "1/2 maybe"]) {
    await assert.rejects(gradeAnswer({ question, response, selectedChoice: null }), GradingError, response);
  }
  // A whole practice test cannot hand one answer back, so it scores as unanswered rather than failing the submission.
  const inTest = await gradeAnswer({ question, response: "half", selectedChoice: null, allowUnanswered: true });
  assert.deepEqual([inTest.isCorrect, inTest.score], [false, 0]);
});

test("a row marked as math that does not hold a valid problem is refused, never graded another way", async () => {
  assert.equal(readMathKey(["condensation", "condensing"]), null);
  assert.equal(readMathKey(null), null);
  const tampered = [
    "studigo-math:v1:{not json",
    'studigo-math:v1:{"v":1,"family":"fraction_name","a":9,"d":4}',
    'studigo-math:v1:{"v":1,"family":"fraction_name","a":1,"d":4,"answer":"1/4"}',
    'studigo-math:v1:"1/4"'
  ];
  for (const key of tampered) {
    assert.ok(isMathKey(key));
    assert.equal(readMathKey([key]), "invalid", key);
    const question: GradableQuestion = { kind: "fill_blank", prompt: `x = ${BLANK}`, choices: null, correct_choice: null, expected_answer: "1/4", accepted_answers: [key, "1/4"], explanation: null };
    await assert.rejects(gradeAnswer({ question, response: "1/4", selectedChoice: null }), GradingError, key);
    const inTest = await gradeAnswer({ question, response: "1/4", selectedChoice: null, allowUnanswered: true });
    assert.deepEqual([inTest.isCorrect, inTest.score], [false, 0], "not graded by spelling even though 1/4 is listed");
  }
});

test("the words state the picture's quantities, and the worked steps end at the answer", () => {
  for (const family of MATH_FAMILIES) {
    for (const problem of generateMathProblems(family, 40, seededRandom(11))) {
      assert.equal(mathPrompt(problem).split(BLANK).length, 2);
      const visual = mathVisual(problem);
      const words = describeMathVisual(visual);
      if (visual.kind === "fraction_bars") {
        for (const bar of visual.bars) assert.ok(words.includes(`${bar.parts} equal part`) && words.includes(`${bar.shaded} shaded`), words);
      }
      if (visual.kind === "area_grid") assert.ok(words.includes(`${visual.columns} square`) && words.includes(`${visual.rows} square`), words);
      if (visual.kind === "ratio_table") assert.ok(words.includes("a missing number") && !words.includes(` ${mathAnswerText(problem)}.`), words);

      const steps = mathSteps(problem);
      assert.ok(steps.length >= 2);
      assert.ok(steps.at(-1)!.text.includes(mathAnswerText(problem)), `${JSON.stringify(problem)}: "${steps.at(-1)!.text}"`);
      for (const step of steps) {
        if (step.visual?.kind !== "fraction_bars") continue;
        for (const bar of step.visual.bars) assert.ok(Number.isInteger(bar.parts) && bar.parts >= 1 && bar.shaded >= 0 && bar.shaded <= bar.parts, JSON.stringify(step));
      }
    }
  }
});
