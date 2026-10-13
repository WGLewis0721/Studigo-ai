import { expectsWholeNumber, solveMathProblem, type AreaUnit, type MathProblem } from "./problems";
import { equalRational, formatRational, rational, terminates, type Rational } from "./rational";

/**
 * Why an answer could not be graded. An unreadable answer is never marked
 * wrong: the caller asks the learner to type it again.
 */
export type UnreadableReason =
  /** Not a number or fraction this checker can read. */
  | "not_a_number"
  /** The blank takes one whole number; a fraction, words or another unit were typed. */
  | "whole_number"
  /** A decimal was typed for a value no decimal states exactly, such as 1/3. */
  | "needs_fraction";

export type MathCheck =
  | { status: "correct"; answer: string; simplest: boolean }
  | { status: "incorrect"; answer: string }
  | { status: "unreadable"; reason: UnreadableReason };

const MAX_INPUT_CHARS = 40;
/** Checked before normalising: the whitespace rules below are quadratic on a very long run. */
const MAX_RAW_CHARS = 200;

const VULGAR: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6",
  "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8"
};

function normalize(input: string): string {
  return input
    .replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (char) => ` ${VULGAR[char]}`)
    .replace(/[⁄∕]/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

type Parsed = { value: Rational; form: "whole" | "fraction" | "mixed" | "decimal"; lowestTerms: boolean };

function parseNumber(text: string): Parsed | null {
  const mixed = /^(-?)(\d{1,6}) (\d{1,6})\/(\d{1,6})$/.exec(text);
  if (mixed) {
    const [, sign, whole, num, den] = mixed;
    if (BigInt(den) === 0n) return null;
    const value = rational(BigInt(whole) * BigInt(den) + BigInt(num), BigInt(den));
    return { value: sign ? rational(-value.n, value.d) : value, form: "mixed", lowestTerms: true };
  }
  const fraction = /^(-?)(\d{1,6})\/(\d{1,6})$/.exec(text);
  if (fraction) {
    const [, sign, num, den] = fraction;
    if (BigInt(den) === 0n) return null;
    const value = rational(BigInt(`${sign}${num}`), BigInt(den));
    return { value, form: "fraction", lowestTerms: value.d === BigInt(den) };
  }
  const decimal = /^(-?)(\d{0,6})\.(\d{1,6})$/.exec(text);
  if (decimal) {
    const [, sign, whole, digits] = decimal;
    return { value: rational(BigInt(`${sign}${whole}${digits}`), 10n ** BigInt(digits.length)), form: "decimal", lowestTerms: true };
  }
  return /^-?\d{1,9}$/.test(text) ? { value: rational(BigInt(text)), form: "whole", lowestTerms: true } : null;
}

const UNIT_NAMES: Record<AreaUnit, string> = {
  cm: "cm|centimeters?|centimetres?",
  m: "m|meters?|metres?",
  in: "in|inch|inches",
  ft: "ft|foot|feet"
};

/** The number part of an area answer. Null when words follow it that are not this problem's square unit. */
function withoutAreaUnit(text: string, unit: AreaUnit): string | null {
  const match = /^([-\d./ ]*\d)(?: ?(\D.*))?$/.exec(text);
  if (!match) return text;
  const [, number, suffix] = match;
  if (!suffix) return number;
  const names = UNIT_NAMES[unit];
  const squareUnit = new RegExp(`^(?:(?:square|sq\\.?) (?:${names})|(?:${names}) ?(?:\\^ ?2|2|²|squared))$`);
  return squareUnit.test(suffix.trim()) ? number.trim() : null;
}

/**
 * Grades by exact value: 2/4, 1/2 and 0.5 are the same answer. Anything the
 * checker cannot read with certainty is reported as unreadable instead of
 * guessed at, because a wrong grade costs more than asking again.
 */
export function checkMathAnswer(problem: MathProblem, input: string): MathCheck {
  const expected = solveMathProblem(problem);
  const whole = expectsWholeNumber(problem);
  const unreadable = (reason: UnreadableReason): MathCheck => ({ status: "unreadable", reason });

  if (input.length > MAX_RAW_CHARS) return unreadable(whole ? "whole_number" : "not_a_number");
  const text = normalize(input);
  if (!text || text.length > MAX_INPUT_CHARS) return unreadable(whole ? "whole_number" : "not_a_number");
  const numberText = problem.family === "rect_area" ? withoutAreaUnit(text, problem.unit) : text;
  const parsed = numberText === null ? null : parseNumber(numberText);
  if (!parsed) return unreadable(whole ? "whole_number" : "not_a_number");
  if (whole && (parsed.form === "fraction" || parsed.form === "mixed")) return unreadable("whole_number");
  if (parsed.form === "decimal" && !terminates(expected)) return unreadable("needs_fraction");

  const answer = formatRational(expected);
  if (!equalRational(parsed.value, expected)) return { status: "incorrect", answer };
  return { status: "correct", answer, simplest: parsed.lowestTerms };
}
