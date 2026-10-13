import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MATH_FAMILIES,
  checkMathAnswer,
  expectsWholeNumber,
  generateMathProblems,
  mathAnswerText,
  mathVisual,
  seededRandom,
  validateMathProblem,
  type MathProblem
} from "./math";

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
const SAMPLE: MathProblem[] = MATH_FAMILIES.flatMap((family) =>
  SEEDS.flatMap((seed) => generateMathProblems(family, 5, seededRandom(seed)))
);

/**
 * The answer as an unsimplified numerator and denominator, worked out here from
 * the parameters with plain integers. The checker is graded against this, not
 * against its own solver.
 */
function oracle(problem: MathProblem): [number, number] {
  switch (problem.family) {
    case "fraction_name": return [problem.a, problem.d];
    case "fraction_add_like": return [problem.a + problem.b, problem.d];
    case "fraction_subtract_like": return [problem.a - problem.b, problem.d];
    case "fraction_equivalent": return [problem.a * problem.k, 1];
    case "fraction_add_unlike": return [problem.a * problem.d + problem.c * problem.b, problem.b * problem.d];
    case "rect_area": return [problem.length * problem.width, 1];
    case "ratio_scale": return [problem.b * problem.k, 1];
  }
}

function onlyTwosAndFives(value: number): boolean {
  let rest = value;
  for (const factor of [2, 5]) while (rest % factor === 0) rest /= factor;
  return rest === 1;
}

function lowestDenominator(n: number, d: number): number {
  let [x, y] = [n, d];
  while (y) [x, y] = [y, x % y];
  return d / x;
}

/** n/d as an exact decimal string. Only called when the expansion terminates. */
function exactDecimal(n: number, d: number): string {
  let scale = 1n;
  let places = 0;
  while ((BigInt(n) * scale) % BigInt(d) !== 0n) { scale *= 10n; places++; }
  const digits = ((BigInt(n) * scale) / BigInt(d)).toString().padStart(places + 1, "0");
  return places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : `${digits}.0`;
}

test("the generators cover every family with valid, storable problems", () => {
  for (const family of MATH_FAMILIES) {
    assert.ok(SAMPLE.filter((problem) => problem.family === family).length >= 100, `${family}: too few problems generated`);
  }
  for (const problem of SAMPLE) {
    assert.deepEqual(validateMathProblem(JSON.parse(JSON.stringify(problem))), problem);
  }
});

test("a right answer is accepted in every form a learner might type", () => {
  for (const problem of SAMPLE) {
    const [n, d] = oracle(problem);
    const forms = [mathAnswerText(problem), ` ${mathAnswerText(problem)} `];
    if (expectsWholeNumber(problem)) {
      forms.push(String(n), `${n}.0`, `${n}.`);
      if (problem.family === "rect_area") forms.push(`${n} square ${problem.unit}`, `${n} sq ${problem.unit}`, `${n}${problem.unit}2`, `${n} ${problem.unit}^2`);
    } else {
      forms.push(`${n}/${d}`, `${n} / ${d}`, `${n * 2}/${d * 2}`, `${n * 3}/${d * 3}`, `${n}⁄${d}`);
      if (onlyTwosAndFives(lowestDenominator(n, d))) forms.push(exactDecimal(n, d));
    }
    for (const form of forms) {
      assert.equal(checkMathAnswer(problem, form).status, "correct", `${JSON.stringify(problem)} should accept "${form}"`);
    }
  }
});

test("a value that is close to the answer is never accepted", () => {
  for (const problem of SAMPLE) {
    const [n, d] = oracle(problem);
    const near = expectsWholeNumber(problem)
      ? [String(n + 1), String(n - 1), `${n}.1`, `${n * 10 + 1}`]
      : [`${n + 1}/${d}`, `${n * 1000 + 1}/${d * 1000}`, `${n * 1000 - 1}/${d * 1000}`, `${n}/${d + 1}`, `${d}/${n || 1}1`];
    for (const form of near) {
      assert.notEqual(checkMathAnswer(problem, form).status, "correct", `${JSON.stringify(problem)} must not accept "${form}"`);
    }
  }
});

test("an answer that cannot be read is never graded", () => {
  const unreadable = ["", "   ", "abc", "three fourths", "3/0", "1 1/0", "1/2/3", "3/4 and a bit", "1e3", "3,4", "--3", "+-1", "1 2 3", "9".repeat(50), "<b>3/4</b>"];
  for (const problem of SAMPLE.filter((_, index) => index % 7 === 0)) {
    for (const form of unreadable) {
      assert.equal(checkMathAnswer(problem, form).status, "unreadable", `${problem.family} should not grade "${form}"`);
    }
  }
});

test("a decimal is only graded when it can state the answer exactly", () => {
  const third: MathProblem = { v: 1, family: "fraction_name", a: 1, d: 3 };
  for (const form of ["0.33", "0.3333", "0.9", ".3"]) {
    assert.deepEqual(checkMathAnswer(third, form), { status: "unreadable", reason: "needs_fraction" });
  }
  const quarter: MathProblem = { v: 1, family: "fraction_name", a: 1, d: 4 };
  assert.equal(checkMathAnswer(quarter, "0.25").status, "correct");
  assert.equal(checkMathAnswer(quarter, ".25").status, "correct");
  assert.equal(checkMathAnswer(quarter, "0.2").status, "incorrect");
  assert.equal(checkMathAnswer(quarter, "¼").status, "correct");
});

test("a whole-number blank does not grade a fraction or a different unit", () => {
  const equivalent: MathProblem = { v: 1, family: "fraction_equivalent", a: 2, d: 3, k: 4 };
  assert.equal(checkMathAnswer(equivalent, "8").status, "correct");
  assert.deepEqual(checkMathAnswer(equivalent, "8/12"), { status: "unreadable", reason: "whole_number" });
  const area: MathProblem = { v: 1, family: "rect_area", length: 6, width: 4, unit: "cm" };
  assert.equal(checkMathAnswer(area, "24 cm²").status, "correct");
  for (const form of ["24 cm", "24 square m", "24 squares", "24 cm3"]) {
    assert.deepEqual(checkMathAnswer(area, form), { status: "unreadable", reason: "whole_number" }, form);
  }
  assert.equal(checkMathAnswer(area, "20").status, "incorrect");
});

test("a simplified answer is told apart from an unsimplified one, and both are correct", () => {
  const problem: MathProblem = { v: 1, family: "fraction_add_like", a: 1, b: 1, d: 4 };
  assert.deepEqual(checkMathAnswer(problem, "1/2"), { status: "correct", answer: "1/2", simplest: true });
  assert.deepEqual(checkMathAnswer(problem, "2/4"), { status: "correct", answer: "1/2", simplest: false });
});

test("a stored problem that was altered is rejected", () => {
  const altered: unknown[] = [
    null, [], "fraction_name", { v: 1 }, { v: 2, family: "fraction_name", a: 1, d: 4 },
    { v: 1, family: "fraction_divide", a: 1, d: 4 },
    { v: 1, family: "fraction_name", a: 1, d: 4, answer: "9/9" },
    { v: 1, family: "fraction_name", a: 1 },
    { v: 1, family: "fraction_name", a: 1.5, d: 4 },
    { v: 1, family: "fraction_name", a: "1", d: 4 },
    { v: 1, family: "fraction_name", a: 5, d: 4 },
    { v: 1, family: "fraction_name", a: 1, d: 0 },
    { v: 1, family: "fraction_name", a: 1, d: 1000 },
    { v: 1, family: "fraction_add_like", a: 3, b: 3, d: 4 },
    { v: 1, family: "fraction_subtract_like", a: 1, b: 3, d: 4 },
    { v: 1, family: "fraction_add_unlike", a: 1, b: 4, c: 1, d: 4 },
    { v: 1, family: "fraction_add_unlike", a: 3, b: 4, c: 2, d: 3 },
    { v: 1, family: "rect_area", length: 6, width: 4, unit: "miles" },
    { v: 1, family: "ratio_scale", a: 2, b: 2, k: 3 }
  ];
  for (const raw of altered) assert.equal(validateMathProblem(raw), null, JSON.stringify(raw));
});

test("the picture shows the problem's own quantities and never the answer", () => {
  for (const problem of SAMPLE) {
    const visual = mathVisual(problem);
    switch (problem.family) {
      case "fraction_name":
        assert.deepEqual(visual, { kind: "fraction_bars", bars: [{ parts: problem.d, shaded: problem.a, label: "?" }], operator: null });
        break;
      case "fraction_add_like":
      case "fraction_subtract_like":
        assert.ok(visual.kind === "fraction_bars");
        assert.deepEqual(visual.bars.map((bar) => [bar.shaded, bar.parts]), [[problem.a, problem.d], [problem.b, problem.d]]);
        break;
      case "fraction_equivalent":
        assert.ok(visual.kind === "fraction_bars");
        assert.deepEqual(visual.bars.map((bar) => [bar.shaded, bar.parts]), [[problem.a, problem.d], [0, problem.d * problem.k]]);
        assert.ok(!visual.bars[1].label.includes(mathAnswerText(problem) + "/"), "the missing numerator is not printed");
        break;
      case "fraction_add_unlike":
        assert.ok(visual.kind === "fraction_bars");
        assert.deepEqual(visual.bars.map((bar) => [bar.shaded, bar.parts]), [[problem.a, problem.b], [problem.c, problem.d]]);
        break;
      case "rect_area":
        assert.deepEqual(visual, { kind: "area_grid", columns: problem.length, rows: problem.width, unit: problem.unit });
        break;
      case "ratio_scale":
        assert.ok(visual.kind === "ratio_table");
        assert.deepEqual(visual.rows, [[problem.a, problem.b], [problem.a * problem.k, null]]);
        break;
    }
    if (visual.kind === "fraction_bars") {
      for (const bar of visual.bars) assert.ok(bar.shaded >= 0 && bar.shaded <= bar.parts);
    }
  }
});
