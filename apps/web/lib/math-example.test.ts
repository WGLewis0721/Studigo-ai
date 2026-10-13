import assert from "node:assert/strict";
import test from "node:test";
import { MATH_FAMILIES, generateMathProblems, mathAnswerText, mathVisual, seededRandom } from "./learning";
import { mathPrompt } from "./math-copy";
import { mathExampleFor, mathExampleForTopic } from "./math-example";
import { mathPresentation, mathSolution } from "./math-practice";

const BLANK = "____";

test("a math topic gets one example whose picture is the problem's and whose steps end at its answer", () => {
  const topics: Array<[Parameters<typeof mathExampleForTopic>[0], (typeof MATH_FAMILIES)[number]]> = [
    [{ title: "Adding fractions with like denominators" }, "fraction_add_like"],
    [{ title: "Area of a Rectangle" }, "rect_area"],
    [{ title: "Ratios", key_terms: ["ratio table"] }, "ratio_scale"]
  ];
  for (const [topic, family] of topics) {
    const [problem] = generateMathProblems(family, 1, seededRandom(11));
    const example = mathExampleForTopic(topic, {}, seededRandom(11));
    assert.ok(example, topic.title);
    assert.deepEqual(example, mathExampleFor(problem), topic.title);
    assert.deepEqual(example.presentation.visual, mathVisual(problem), topic.title);
  }
});

test("every family's example asks the problem with a blank and keeps the answer for the last step", () => {
  for (const family of MATH_FAMILIES) {
    for (const problem of generateMathProblems(family, 6, seededRandom(3))) {
      const example = mathExampleFor(problem);
      assert.equal(example.caption, mathPrompt(problem));
      assert.equal(example.caption.split(BLANK).length, 2, "exactly one blank");
      assert.deepEqual(example.presentation, mathPresentation(problem));
      assert.deepEqual(example.presentation.visual, mathVisual(problem));
      assert.deepEqual(example.steps, mathSolution(problem));
      assert.ok(example.steps.at(-1)!.text.includes(mathAnswerText(problem)), family);
      assert.deepEqual(JSON.parse(JSON.stringify(example)), example, "survives the trip to the browser");
    }
  }
});

test("a topic no family covers, and the off switch, yield no example", () => {
  assert.equal(mathExampleForTopic({ title: "The American Revolution", objective: "Only a fraction of the colonists stayed loyal." }), null);
  assert.equal(mathExampleForTopic({ title: "Dividing fractions" }), null);

  const before = process.env.STUDIGO_MATH_PRACTICE;
  process.env.STUDIGO_MATH_PRACTICE = "0";
  try {
    assert.equal(mathExampleForTopic({ title: "Adding fractions with like denominators" }), null);
  } finally {
    if (before === undefined) delete process.env.STUDIGO_MATH_PRACTICE;
    else process.env.STUDIGO_MATH_PRACTICE = before;
  }
  assert.ok(mathExampleForTopic({ title: "Adding fractions with like denominators" }));
});
