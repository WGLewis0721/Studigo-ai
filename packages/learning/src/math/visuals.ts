import type { MathProblem } from "./problems";

/**
 * Pictures as data. Each spec is built from the same integers the answer key
 * uses, so a drawing cannot disagree with the problem it illustrates. The web
 * layer only renders these; it never works out a quantity of its own.
 */
export type FractionBar = { parts: number; shaded: number; label: string };

export type MathVisual =
  | { kind: "fraction_bars"; bars: FractionBar[]; operator: "+" | "−" | "=" | null }
  | { kind: "area_grid"; columns: number; rows: number; unit: string }
  /** A null cell is the unknown the learner is asked for. */
  | { kind: "ratio_table"; headers: [string, string]; rows: Array<[number, number | null]> };

const bar = (shaded: number, parts: number, label = `${shaded}/${parts}`): FractionBar => ({ parts, shaded, label });

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
  }
}
