import { addRational, formatRational, lcm, rational, subtractRational, type Rational } from "./rational";

/**
 * Math practice whose answer is known before it is asked. Code generates the
 * numbers, so the key is correct by construction and grading needs no model.
 * A problem is small integers only: it is stored as JSON and re-validated
 * before every use, never trusted because it was stored.
 */
export const MATH_FAMILIES = [
  "fraction_name",
  "fraction_add_like",
  "fraction_subtract_like",
  "fraction_equivalent",
  "fraction_add_unlike",
  "rect_area",
  "ratio_scale"
] as const;

export type MathFamily = (typeof MATH_FAMILIES)[number];

export const AREA_UNITS = ["cm", "m", "in", "ft"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export type MathProblem =
  /** `a` of `d` equal parts are shaded. */
  | { v: 1; family: "fraction_name"; a: number; d: number }
  /** a/d + b/d, never more than one whole. */
  | { v: 1; family: "fraction_add_like"; a: number; b: number; d: number }
  /** a/d - b/d, with a > b. */
  | { v: 1; family: "fraction_subtract_like"; a: number; b: number; d: number }
  /** a/d = ?/(d*k). The answer is the missing numerator. */
  | { v: 1; family: "fraction_equivalent"; a: number; d: number; k: number }
  /** a/b + c/d with different denominators, never more than one whole. */
  | { v: 1; family: "fraction_add_unlike"; a: number; b: number; c: number; d: number }
  | { v: 1; family: "rect_area"; length: number; width: number; unit: AreaUnit }
  /** a to b, scaled by k: a*k of the first goes with b*k of the second. */
  | { v: 1; family: "ratio_scale"; a: number; b: number; k: number };

const MAX_PART = 12;

const FIELDS: Record<MathFamily, readonly string[]> = {
  fraction_name: ["a", "d"],
  fraction_add_like: ["a", "b", "d"],
  fraction_subtract_like: ["a", "b", "d"],
  fraction_equivalent: ["a", "d", "k"],
  fraction_add_unlike: ["a", "b", "c", "d"],
  rect_area: ["length", "width", "unit"],
  ratio_scale: ["a", "b", "k"]
};

function inRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function holds(problem: MathProblem): boolean {
  switch (problem.family) {
    case "fraction_name":
      return inRange(problem.d, 2, MAX_PART) && inRange(problem.a, 1, problem.d - 1);
    case "fraction_add_like":
      return inRange(problem.d, 2, MAX_PART) && inRange(problem.a, 1, MAX_PART) && inRange(problem.b, 1, MAX_PART) && problem.a + problem.b <= problem.d;
    case "fraction_subtract_like":
      return inRange(problem.d, 2, MAX_PART) && inRange(problem.a, 2, problem.d) && inRange(problem.b, 1, problem.a - 1);
    case "fraction_equivalent":
      return inRange(problem.d, 2, MAX_PART) && inRange(problem.a, 1, problem.d - 1) && inRange(problem.k, 2, 6);
    case "fraction_add_unlike":
      return (
        inRange(problem.b, 2, MAX_PART) &&
        inRange(problem.d, 2, MAX_PART) &&
        problem.b !== problem.d &&
        inRange(problem.a, 1, problem.b - 1) &&
        inRange(problem.c, 1, problem.d - 1) &&
        problem.a * problem.d + problem.c * problem.b <= problem.b * problem.d
      );
    case "rect_area":
      return inRange(problem.length, 1, MAX_PART) && inRange(problem.width, 1, MAX_PART) && (AREA_UNITS as readonly unknown[]).includes(problem.unit);
    case "ratio_scale":
      return inRange(problem.a, 1, MAX_PART) && inRange(problem.b, 1, MAX_PART) && problem.a !== problem.b && inRange(problem.k, 2, 9);
  }
}

/** The stored form, parsed back. Anything with an unknown family, an extra key or a value out of range is rejected. */
export function validateMathProblem(raw: unknown): MathProblem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.v !== 1 || typeof value.family !== "string") return null;
  if (!(MATH_FAMILIES as readonly string[]).includes(value.family)) return null;
  const fields = FIELDS[value.family as MathFamily];
  const keys = Object.keys(value);
  if (keys.length !== fields.length + 2 || !fields.every((field) => field in value)) return null;
  const problem = value as unknown as MathProblem;
  return holds(problem) ? problem : null;
}

export function solveMathProblem(problem: MathProblem): Rational {
  switch (problem.family) {
    case "fraction_name":
      return rational(problem.a, problem.d);
    case "fraction_add_like":
      return addRational(rational(problem.a, problem.d), rational(problem.b, problem.d));
    case "fraction_subtract_like":
      return subtractRational(rational(problem.a, problem.d), rational(problem.b, problem.d));
    case "fraction_equivalent":
      return rational(problem.a * problem.k);
    case "fraction_add_unlike":
      return addRational(rational(problem.a, problem.b), rational(problem.c, problem.d));
    case "rect_area":
      return rational(problem.length * problem.width);
    case "ratio_scale":
      return rational(problem.b * problem.k);
  }
}

/** Families whose blank is a single whole number, not a fraction. */
export function expectsWholeNumber(problem: MathProblem): boolean {
  return problem.family === "fraction_equivalent" || problem.family === "rect_area" || problem.family === "ratio_scale";
}

/** The answer as the learner would write it, in simplest form. */
export function mathAnswerText(problem: MathProblem): string {
  return formatRational(solveMathProblem(problem));
}

/** Deterministic for a given seed, so a failing case can be replayed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(family: MathFamily, random: () => number): MathProblem {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  switch (family) {
    case "fraction_name": {
      const d = int(2, MAX_PART);
      return { v: 1, family, a: int(1, d - 1), d };
    }
    case "fraction_add_like": {
      const d = int(3, MAX_PART);
      const a = int(1, d - 1);
      return { v: 1, family, a, b: int(1, d - a), d };
    }
    case "fraction_subtract_like": {
      const d = int(3, MAX_PART);
      const a = int(2, d);
      return { v: 1, family, a, b: int(1, a - 1), d };
    }
    case "fraction_equivalent": {
      const d = int(2, 8);
      return { v: 1, family, a: int(1, d - 1), d, k: int(2, 5) };
    }
    case "fraction_add_unlike": {
      const b = int(2, 6);
      const d = int(2, 8);
      return { v: 1, family, a: int(1, b - 1), b, c: int(1, d - 1), d };
    }
    case "rect_area":
      return { v: 1, family, length: int(2, MAX_PART), width: int(2, 9), unit: AREA_UNITS[int(0, AREA_UNITS.length - 1)] };
    case "ratio_scale":
      return { v: 1, family, a: int(1, 6), b: int(1, 9), k: int(2, 6) };
  }
}

/** Friendlier numbers than the rules strictly require: addends in lowest terms and a common denominator a bar can show. */
function tidy(problem: MathProblem): boolean {
  if (problem.family !== "fraction_add_unlike") return true;
  return rational(problem.a, problem.b).d === BigInt(problem.b) && rational(problem.c, problem.d).d === BigInt(problem.d) && lcm(problem.b, problem.d) <= 24;
}

/**
 * Up to `count` distinct problems. A draw that breaks a family rule is thrown
 * away, so every problem returned passes validateMathProblem.
 */
export function generateMathProblems(family: MathFamily, count: number, random: () => number = Math.random): MathProblem[] {
  const problems: MathProblem[] = [];
  const seen = new Set<string>();
  for (let tries = 0; problems.length < count && tries < count * 40; tries++) {
    const problem = draw(family, random);
    const key = JSON.stringify(problem);
    if (seen.has(key) || !holds(problem) || !tidy(problem)) continue;
    seen.add(key);
    problems.push(problem);
  }
  return problems;
}
