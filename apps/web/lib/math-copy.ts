import { BLANK_MARKER } from "@studigo/ai";
import { barModel, compareFractions, lcm, mathAnswerText, mathVisual, numberLine, type BarModelBox, type FractionBar, type MathProblem, type MathVisual } from "@/lib/learning";

/**
 * The words around code-generated math: the question, the worked steps and the
 * text equivalent of each picture. Every number comes from the problem's own
 * integers or from its solved answer, so the wording cannot drift from the key.
 */
export type MathStep = { text: string; visual?: MathVisual };

/** The question, with the blank marker standing where the answer goes. */
export function mathPrompt(problem: MathProblem): string {
  const blank = BLANK_MARKER;
  switch (problem.family) {
    case "fraction_name":
      return `The shaded part of the bar is ${blank} of the whole bar.`;
    case "fraction_add_like":
      return `${problem.a}/${problem.d} + ${problem.b}/${problem.d} = ${blank}`;
    case "fraction_subtract_like":
      return `${problem.a}/${problem.d} − ${problem.b}/${problem.d} = ${blank}`;
    case "fraction_equivalent":
      return `${problem.a}/${problem.d} = ${blank}/${problem.d * problem.k}`;
    case "fraction_add_unlike":
      return `${problem.a}/${problem.b} + ${problem.c}/${problem.d} = ${blank}`;
    case "rect_area":
      return `A rectangle is ${problem.length} ${problem.unit} long and ${problem.width} ${problem.unit} wide. Its area is ${blank} square ${problem.unit}.`;
    case "ratio_scale":
      return `For every ${problem.a} red tiles there are ${problem.b} blue tiles. With ${problem.a * problem.k} red tiles, there are ${blank} blue tiles.`;
    case "fraction_compare":
      return `Compare ${problem.a}/${problem.b} and ${problem.c}/${problem.d}. Which is greater, or are they equal?`;
    case "linear_equation":
      return `Solve for x. ${problem.a}x + ${problem.b} = ${problem.c}, so x = ${blank}`;
  }
}

/** The choices of a question answered by picking one, in the order the right position is counted in. Null when the learner types. */
export function mathChoices(problem: MathProblem): string[] | null {
  if (problem.family !== "fraction_compare") return null;
  return [`${problem.a}/${problem.b} is greater`, `${problem.c}/${problem.d} is greater`, "They are equal"];
}

const bar = (shaded: number, parts: number): FractionBar => ({ parts, shaded, label: `${shaded}/${parts}` });
const bars = (items: FractionBar[], operator: "+" | "−" | "=" | null = null): MathVisual => ({ kind: "fraction_bars", bars: items, operator });

function simplifyStep(unsimplified: string, answer: string): MathStep[] {
  if (unsimplified === answer) return [];
  const [n, d] = answer.split("/").map(Number);
  return [{ text: `Simplify: ${unsimplified} = ${answer}.`, ...(d ? { visual: bars([bar(n, d)]) } : {}) }];
}

/** The worked solution, shown one step at a time after the learner has answered. */
export function mathSteps(problem: MathProblem): MathStep[] {
  const answer = mathAnswerText(problem);
  switch (problem.family) {
    case "fraction_name":
      return [
        { text: `The bar is split into ${problem.d} equal parts, so the bottom number is ${problem.d}.` },
        { text: `${problem.a} of those parts ${problem.a === 1 ? "is" : "are"} shaded, so the top number is ${problem.a}: ${problem.a}/${problem.d}.`, visual: bars([bar(problem.a, problem.d)]) },
        ...simplifyStep(`${problem.a}/${problem.d}`, answer)
      ];
    case "fraction_add_like": {
      const sum = problem.a + problem.b;
      return [
        { text: `Both fractions are split into ${problem.d} equal parts, so the pieces are the same size.`, visual: mathVisual(problem) },
        { text: `Add the shaded pieces: ${problem.a} + ${problem.b} = ${sum}. That is ${sum}/${problem.d}.`, visual: bars([bar(sum, problem.d)]) },
        { text: `On a number line, start at 0 and jump ${problem.a}/${problem.d}, then ${problem.b}/${problem.d} more. You land on ${sum}/${problem.d}.`, visual: numberLine(problem.d, [[0, problem.a], [problem.a, sum]]) },
        ...simplifyStep(`${sum}/${problem.d}`, answer)
      ];
    }
    case "fraction_subtract_like": {
      const left = problem.a - problem.b;
      return [
        { text: `Both fractions are split into ${problem.d} equal parts, so the pieces are the same size.`, visual: mathVisual(problem) },
        { text: `Take away the shaded pieces: ${problem.a} − ${problem.b} = ${left}. That is ${left}/${problem.d}.`, visual: bars([bar(left, problem.d)]) },
        { text: `On a number line, start at ${problem.a}/${problem.d} and jump back ${problem.b}/${problem.d}. You land on ${left}/${problem.d}.`, visual: numberLine(problem.d, [[problem.a, left]]) },
        ...simplifyStep(`${left}/${problem.d}`, answer)
      ];
    }
    case "fraction_equivalent": {
      const parts = problem.d * problem.k;
      const top = problem.a * problem.k;
      return [
        { text: `The bottom number went from ${problem.d} to ${parts}. That is ${problem.d} × ${problem.k}.` },
        { text: `Do the same to the top number: ${problem.a} × ${problem.k} = ${top}. So ${problem.a}/${problem.d} = ${top}/${parts}.`, visual: bars([bar(problem.a, problem.d), bar(top, parts)], "=") }
      ];
    }
    case "fraction_add_unlike": {
      const common = lcm(problem.b, problem.d);
      const first = problem.a * (common / problem.b);
      const second = problem.c * (common / problem.d);
      const sum = first + second;
      return [
        { text: `The pieces are different sizes, so use a bottom number both ${problem.b} and ${problem.d} divide into: ${common}.`, visual: mathVisual(problem) },
        { text: `Rewrite both: ${problem.a}/${problem.b} = ${first}/${common} and ${problem.c}/${problem.d} = ${second}/${common}.`, visual: bars([bar(first, common), bar(second, common)], "+") },
        { text: `Add the shaded pieces: ${first} + ${second} = ${sum}. That is ${sum}/${common}.`, visual: bars([bar(sum, common)]) },
        ...simplifyStep(`${sum}/${common}`, answer)
      ];
    }
    case "rect_area":
      return [
        { text: "Area counts the unit squares that cover the rectangle.", visual: mathVisual(problem) },
        { text: `There are ${problem.length} squares in each row and ${problem.width} ${problem.width === 1 ? "row" : "rows"}: ${problem.length} × ${problem.width} = ${answer}.` },
        { text: `The area is ${answer} square ${problem.unit}.` }
      ];
    case "ratio_scale": {
      const scaled = problem.a * problem.k;
      return [
        { text: `${problem.a} red ${problem.a === 1 ? "tile" : "tiles"} became ${scaled}. That is ${problem.a} × ${problem.k}.` },
        { text: `Scale the blue tiles the same way: ${problem.b} × ${problem.k} = ${answer}.`, visual: { kind: "ratio_table", headers: ["Red tiles", "Blue tiles"], rows: [[problem.a, problem.b], [scaled, problem.b * problem.k]] } }
      ];
    }
  }
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** The text equivalent of a visual: the same quantities in words, for a screen reader or read-aloud. */
export function describeMathVisual(visual: MathVisual): string {
  switch (visual.kind) {
    case "fraction_bars": {
      const joiner = visual.operator === "+" ? ", plus " : visual.operator === "−" ? ", take away " : visual.operator === "=" ? ", next to " : ", then ";
      const described = visual.bars
        .map((item) => `a bar split into ${count(item.parts, "equal part", "equal parts")} with ${item.shaded} shaded`)
        .join(joiner);
      return `${described.charAt(0).toUpperCase()}${described.slice(1)}.`;
    }
    case "area_grid":
      return `A rectangle drawn on a grid: ${count(visual.columns, "square", "squares")} across and ${count(visual.rows, "square", "squares")} down. Each square is 1 ${visual.unit} on a side.`;
    case "ratio_table":
      return `A table with two columns, ${visual.headers[0]} and ${visual.headers[1]}. ${visual.rows
        .map(([first, second], index) => `Row ${index + 1}: ${first} and ${second === null ? "a missing number" : second}.`)
        .join(" ")}`;
  }
}
