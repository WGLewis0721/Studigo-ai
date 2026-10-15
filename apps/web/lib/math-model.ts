/**
 * Code-owned arithmetic pictures. The quantities are parsed and graded here.
 * Nothing in this file asks a model whether an answer is right.
 */
export type MathModel = {
  kind: "number-line" | "fraction-bar" | "area";
  prompt: string;
  labels: string[];
  examples: [string, string];
  answer: number;
};

const FRACTION_SUM = /^(\d)\s*\/\s*(\d)\s*\+\s*(\d)\s*\/\s*(\d)$/;
const DIGIT_SUM = /^(\d)\s*\+\s*(\d)$/;

type Ratio = { n: number; d: number };

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/[?.!]+$/, "").trim();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function lcm(a: number, b: number): number {
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

/** Digits that actually appear, in order, including repeats. Nothing computed. */
function labelsFromPrompt(prompt: string): string[] {
  return prompt.match(/\d/g) ?? [];
}

function formatExact(n: number, d: number): string {
  if (d === 0) return "0";
  const negative = n < 0 !== d < 0;
  let remainder = Math.abs(n);
  const den = Math.abs(d);
  const whole = Math.floor(remainder / den);
  remainder %= den;
  if (remainder === 0) return `${negative ? "-" : ""}${whole}`;

  let digits = "";
  const seen = new Map<number, number>();
  while (remainder !== 0 && digits.length < 8 && !seen.has(remainder)) {
    seen.set(remainder, digits.length);
    remainder *= 10;
    digits += String(Math.floor(remainder / den));
    remainder %= den;
  }
  return `${negative ? "-" : ""}${whole}.${digits}`;
}

function fractionSumText(sumNum: number, common: number): string {
  const divisor = gcd(sumNum, common);
  const simplifiedN = sumNum / divisor;
  const simplifiedD = common / divisor;
  if (simplifiedD === 1) return String(simplifiedN);
  const fraction = `${simplifiedN}/${simplifiedD}`;
  const decimal = formatExact(sumNum, common);
  return decimal === fraction ? fraction : `${fraction}, which is ${decimal}`;
}

function fractionExamples(a: number, b: number, c: number, d: number): [string, string] {
  const common = lcm(b, d);
  const first = a * (common / b);
  const second = c * (common / d);
  const worked = `${a}/${b} + ${c}/${d}: ${a}/${b} is ${first}/${common} and ${c}/${d} is ${second}/${common}. ${first}/${common} + ${second}/${common} = ${fractionSumText(first + second, common)}.`;
  const shorter = `${a}/${b} + ${c}/${d}: ${a}/${b} is ${first}/${common}. What is ${first}/${common} + ${second}/${common}?`;
  return [worked, shorter];
}

function additionExamples(a: number, b: number): [string, string] {
  const sum = a + b;
  const worked = `${a} + ${b} on a number line from 0 to ${sum}: start at 0, jump ${a}, then jump ${b}. ${a} + ${b} = ${sum}.`;
  const shorter = `${a} + ${b} on a number line from 0: start at 0, jump ${a}, then jump ${b}. Where do you land?`;
  return [worked, shorter];
}

function ratioOf(prompt: string): Ratio | null {
  const normalized = normalizePrompt(prompt);
  const fractions = normalized.match(FRACTION_SUM);
  if (fractions) {
    const a = Number(fractions[1]);
    const b = Number(fractions[2]);
    const c = Number(fractions[3]);
    const d = Number(fractions[4]);
    if (b === 0 || d === 0) return null;
    return { n: a * d + c * b, d: b * d };
  }
  const digits = normalized.match(DIGIT_SUM);
  if (digits) return { n: Number(digits[1]) + Number(digits[2]), d: 1 };
  return null;
}

export function mathModelFromPrompt(prompt: string): MathModel | null {
  const normalized = normalizePrompt(prompt);
  const fractions = normalized.match(FRACTION_SUM);
  if (fractions) {
    const a = Number(fractions[1]);
    const b = Number(fractions[2]);
    const c = Number(fractions[3]);
    const d = Number(fractions[4]);
    if (b === 0 || d === 0) return null;
    const ratio = { n: a * d + c * b, d: b * d };
    return {
      kind: "fraction-bar",
      prompt: normalized,
      labels: labelsFromPrompt(normalized),
      examples: fractionExamples(a, b, c, d),
      answer: ratio.n / ratio.d
    };
  }

  const digits = normalized.match(DIGIT_SUM);
  if (digits) {
    const a = Number(digits[1]);
    const b = Number(digits[2]);
    return {
      kind: "number-line",
      prompt: normalized,
      labels: labelsFromPrompt(normalized),
      examples: additionExamples(a, b),
      answer: a + b
    };
  }

  return null;
}

function sameRatio(left: Ratio, right: Ratio): boolean {
  if (left.d === 0 || right.d === 0) return false;
  return left.n * right.d === right.n * left.d;
}

function ratioFromAnswer(answer: number): Ratio {
  if (Number.isInteger(answer) && Number.isSafeInteger(answer)) return { n: answer, d: 1 };
  return decimalTokenRatio(String(answer)) ?? { n: answer, d: 1 };
}

function decimalTokenRatio(token: string): Ratio | null {
  if (!/^\d+$/.test(token) && !/^\d*\.\d+$/.test(token)) return null;
  const normalized = token.startsWith(".") ? `0${token}` : token;
  const [whole, fraction = ""] = normalized.split(".");
  const d = 10 ** fraction.length;
  const n = Number(whole + fraction);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return null;
  return { n, d };
}

/**
 * True only when the response contains the computed value.
 * Fractions may be simplified (3/4) or written as the decimal (0.75).
 */
export function gradeMath(model: MathModel, response: string): boolean {
  const target = ratioOf(model.prompt) ?? ratioFromAnswer(model.answer);

  for (const match of response.matchAll(/(?<![0-9])(\d+)\s*\/\s*(\d+)(?![0-9])/g)) {
    const denominator = Number(match[2]);
    if (denominator === 0) continue;
    if (sameRatio(target, { n: Number(match[1]), d: denominator })) return true;
  }

  for (const match of response.matchAll(/(?<![0-9.])(\d*\.\d+|\d+)(?![0-9.])/g)) {
    const token = decimalTokenRatio(match[1] ?? "");
    if (token && sameRatio(target, token)) return true;
  }

  return false;
}

/** True when a picture label was not one of the numbers in the prompt. */
export function rejectForeignLabel(model: MathModel, label: string): boolean {
  return !model.labels.includes(label);
}
