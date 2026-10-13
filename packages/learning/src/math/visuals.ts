import type { MathProblem } from "./problems";

/**
 * Pictures as data. Each spec is built from the same integers the answer key
 * uses, so a drawing cannot disagree with the problem it illustrates. The web
 * layer only renders these; it never works out a quantity of its own.
 */
export type FractionBar = { parts: number; shaded: number; label: string };

/** A box in a bar model. Widths are nominal units, never the unknown's value, so the picture cannot give the answer away. */
export type BarModelBox = { label: string; width: number; unknown: boolean };

/** A labelled tick on a number line, `at` parts along from 0. */
export type NumberLineMark = { at: number; label: string };

/** A hop between two ticks. It points forward when `to` is greater than `from`. */
export type NumberLineJump = { from: number; to: number; label: string };

export type MathVisual =
  /** Two or more bars with no operator are drawn one under the other, at the same length, to be compared. */
  | { kind: "fraction_bars"; bars: FractionBar[]; operator: "+" | "−" | "=" | null }
  | { kind: "area_grid"; columns: number; rows: number; unit: string }
  /** A null cell is the unknown the learner is asked for. */
  | { kind: "ratio_table"; headers: [string, string]; rows: Array<[number, number | null]> }
  /** Rows are drawn one under the other, each as long as its boxes add up to. */
  | { kind: "bar_model"; rows: BarModelBox[][] }
  /** 0 to 1 split into `parts`, with tick marks at every part. */
  | { kind: "number_line"; parts: number; marks: NumberLineMark[]; jumps: NumberLineJump[] };

const bar = (shaded: number, parts: number, label = `${shaded}/${parts}`): FractionBar => ({ parts, shaded, label });

const UNKNOWN_WIDTH = 3;
const CONSTANT_WIDTH = 4;

/**
 * `unknowns` boxes labelled x, then a box for `constant` when there is one,
 * as long as one box labelled `total`. Only the labels carry numbers.
 */
export function barModel(unknowns: number, constant: number | null, total: number): MathVisual {
  const top: BarModelBox[] = Array.from({ length: unknowns }, () => ({ label: "x", width: UNKNOWN_WIDTH, unknown: true }));
  if (constant !== null) top.push({ label: String(constant), width: CONSTANT_WIDTH, unknown: false });
  const length = top.reduce((sum, box) => sum + box.width, 0);
  return { kind: "bar_model", rows: [top, [{ label: String(total), width: length, unknown: false }]] };
}

const tickLabel = (at: number, parts: number) => (at === 0 ? "0" : at === parts ? "1" : `${at}/${parts}`);

/** 0 to 1 in `parts` equal steps, with a hop for each [from, to] pair of ticks. 0, 1 and every hop's ends are labelled. */
export function numberLine(parts: number, hops: Array<[from: number, to: number]>): MathVisual {
  const ticks = [...new Set([0, parts, ...hops.flat()])].sort((first, second) => first - second);
  return {
    kind: "number_line",
    parts,
    marks: ticks.map((at) => ({ at, label: tickLabel(at, parts) })),
    jumps: hops.map(([from, to]) => ({ from, to, label: `${to > from ? "+" : "−"}${Math.abs(to - from)}/${parts}` }))
  };
}

/** What the learner sees with the question. It shows the problem, never the answer. */
export function mathVisual(problem: MathProblem): MathVisual {
  switch (problem.family) {
    case "fraction_name":
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.d, "?")], operator: null };
    case "fraction_add_like":
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.d), bar(problem.b, problem.d)], operator: "+" };
    case "fraction_subtract_like":
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.d), bar(problem.b, problem.d)], operator: "−" };
    case "fraction_equivalent": {
      const parts = problem.d * problem.k;
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.d), bar(0, parts, `?/${parts}`)], operator: "=" };
    }
    case "fraction_add_unlike":
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.b), bar(problem.c, problem.d)], operator: "+" };
    case "rect_area":
      return { kind: "area_grid", columns: problem.length, rows: problem.width, unit: problem.unit };
    case "ratio_scale":
      return { kind: "ratio_table", headers: ["Red tiles", "Blue tiles"], rows: [[problem.a, problem.b], [problem.a * problem.k, null]] };
    case "fraction_compare":
      return { kind: "fraction_bars", bars: [bar(problem.a, problem.b), bar(problem.c, problem.d)], operator: null };
    case "linear_equation":
      return barModel(problem.a, problem.b, problem.c);
  }
}
