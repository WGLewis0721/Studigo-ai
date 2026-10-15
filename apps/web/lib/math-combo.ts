/**
 * A math reply is a combo: one move per line, in order.
 * A line is kept only when the quantity changes. One line is legal. Six is the maximum.
 * Notes are at most eight words. Nothing in this file calls a model.
 */

export type ComboStep = { move: string; result: string; note: string };

export type ComboColumn = { title: string; steps: ComboStep[] };

export type ComboPicture =
  | { kind: "number-line"; from: number; jumps: number[] }
  | { kind: "fraction-bar"; bars: { label: string; filled: number; parts: number }[] }
  | { kind: "place-value"; places: string[]; start: string[]; regrouped: string[] | null };

export type MathCombo = {
  picture: ComboPicture | null;
  columns: ComboColumn[];
  /** Second press: the last move of the last column stays unfinished. */
  hideLast: boolean;
};

const MAX_STEPS = 6;
const MAX_NOTE_WORDS = 8;

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function note(text: string): string {
  return words(text).slice(0, MAX_NOTE_WORDS).join(" ");
}

function step(move: string, result: string, comment: string): ComboStep {
  return { move, result, note: note(comment) };
}

function column(title: string, steps: ComboStep[]): ComboColumn | null {
  if (steps.length < 1 || steps.length > MAX_STEPS) return null;
  return { title, steps };
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

function digitsOf(value: number, width: number): number[] {
  return Array.from({ length: width }, (_, index) => Math.floor(value / 10 ** index) % 10);
}

function multiplyChain(a: number, b: number, then: number): ComboStep[] {
  const first = a * b;
  const second = first * then;
  return [
    step(`${a} × ${b}`, String(first), `makes ${first}`),
    step(`${first} × ${then}`, String(second), `makes ${second}`)
  ];
}

/** (a × b) × c, then a × (b × c). Two columns when both are present. */
function productCombo(text: string): MathCombo | null {
  const left = [...text.matchAll(/\((\d+)\s*[x×*]\s*(\d+)\)\s*[x×*]\s*(\d+)/gi)];
  const right = [...text.matchAll(/(\d+)\s*[x×*]\s*\((\d+)\s*[x×*]\s*(\d+)\)/gi)];
  const columns: ComboColumn[] = [];

  if (left[0]) {
    const made = column(`(${left[0][1]} × ${left[0][2]}) × ${left[0][3]}`, multiplyChain(Number(left[0][1]), Number(left[0][2]), Number(left[0][3])));
    if (made) columns.push(made);
  }
  if (right[0]) {
    const inner = Number(right[0][2]) * Number(right[0][3]);
    const made = column(`${right[0][1]} × (${right[0][2]} × ${right[0][3]})`, [
      step(`${right[0][2]} × ${right[0][3]}`, String(inner), `makes ${inner}`),
      step(`${right[0][1]} × ${inner}`, String(Number(right[0][1]) * inner), `makes ${Number(right[0][1]) * inner}`)
    ]);
    if (made) columns.push(made);
  }

  if (!columns.length) {
    const plain = text.match(/(\d+)\s*[x×*]\s*(\d+)/i);
    if (!plain) return null;
    const a = Number(plain[1]);
    const b = Number(plain[2]);
    const made = column(`${a} × ${b}`, [step(`${a} × ${b}`, String(a * b), `makes ${a * b}`)]);
    if (!made) return null;
    return { picture: null, columns: [made], hideLast: false };
  }

  if (columns.length === 2 && columns[0].steps.at(-1)?.result === columns[1].steps.at(-1)?.result) {
    const last = columns[1].steps.at(-1);
    if (last) last.note = "same answer";
  }
  return { picture: null, columns, hideLast: false };
}

function fractionCombo(text: string): MathCombo | null {
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*\+\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const c = Number(match[3]);
  const d = Number(match[4]);
  if (b === 0 || d === 0 || b > 16 || d > 16) return null;
  const common = lcm(b, d);
  if (common > 16) return null;
  const first = a * (common / b);
  const second = c * (common / d);
  const sum = first + second;
  const steps: ComboStep[] = [];
  if (b !== common) steps.push(step(`${a}/${b} = ${first}/${common}`, `${first}/${common}`, "same size"));
  if (d !== common) steps.push(step(`${c}/${d} = ${second}/${common}`, `${second}/${common}`, "same size"));
  steps.push(step(`${first}/${common} + ${second}/${common}`, `${sum}/${common}`, "add the parts"));
  const divisor = gcd(sum, common);
  if (divisor > 1) steps.push(step(`${sum}/${common} = ${sum / divisor}/${common / divisor}`, `${sum / divisor}/${common / divisor}`, "smaller parts"));
  const made = column(`${a}/${b} + ${c}/${d}`, steps);
  if (!made) return null;
  return {
    picture: {
      kind: "fraction-bar",
      bars: [
        { label: `${a}/${b}`, filled: a, parts: b },
        { label: `${c}/${d}`, filled: c, parts: d },
        { label: `${sum}/${common}`, filled: sum, parts: common }
      ]
    },
    columns: [made],
    hideLast: false
  };
}

function subtractionCombo(text: string): MathCombo | null {
  const match = text.match(/(\d{1,3})\s*(?:-|−|–|minus)\s*(\d{1,3})/i);
  if (!match) return null;
  const minuend = Number(match[1]);
  const subtrahend = Number(match[2]);
  if (subtrahend > minuend) return null;
  const width = minuend >= 100 || subtrahend >= 100 ? 3 : 2;
  const places = width === 3 ? ["H", "T", "O"] : ["T", "O"];
  const start = digitsOf(minuend, width);
  const sub = digitsOf(subtrahend, width);
  const current = [...start];
  let regrouped: string[] | null = null;
  const steps: ComboStep[] = [];

  for (let index = 0; index < width; index += 1) {
    if (current[index] < sub[index]) {
      let lender = index + 1;
      while (lender < width && current[lender] === 0) lender += 1;
      if (lender >= width) return null;
      current[lender] -= 1;
      for (let between = lender - 1; between > index; between -= 1) current[between] = 9;
      current[index] += 10;
      regrouped = [...current].reverse().map(String);
      const across = lender > index + 1;
      steps.push(step(
        `${minuend} → ${current.slice().reverse().join(" ")}`,
        regrouped.join(" "),
        across ? "borrow across zero" : "borrow one"
      ));
    }
    const value = 10 ** index;
    const left = current[index] * value;
    const right = sub[index] * value;
    if (left === 0 && right === 0) continue;
    steps.push(step(`${left} − ${right}`, String(left - right), places[width - 1 - index] === "O" ? "ones" : places[width - 1 - index] === "T" ? "tens" : "hundreds"));
  }

  const partials = steps.filter((item) => item.note === "ones" || item.note === "tens" || item.note === "hundreds");
  const total = minuend - subtrahend;
  if (partials.length > 1) {
    steps.push(step(partials.map((item) => item.result).join(" + "), String(total), `makes ${total}`));
  }
  const made = column(`${minuend} − ${subtrahend}`, steps);
  if (!made) return null;
  return {
    picture: {
      kind: "place-value",
      places,
      start: [...start].reverse().map(String),
      regrouped
    },
    columns: [made],
    hideLast: false
  };
}

function additionCombo(text: string): MathCombo | null {
  if (/\d\s*\/\s*\d/.test(text)) return null;
  const match = text.match(/(\d{1,3})\s*\+\s*(\d{1,3})/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  const made = column(`${a} + ${b}`, [
    step(`0 + ${a}`, String(a), `jump ${a}`),
    step(`${a} + ${b}`, String(a + b), `jump ${b}`)
  ]);
  if (!made) return null;
  return { picture: { kind: "number-line", from: 0, jumps: [a, b] }, columns: [made], hideLast: false };
}

/** The first arithmetic pattern in the text, or null when this is not a math combo. */
export function comboFromQuestion(text: string, options?: { hideLast?: boolean }): MathCombo | null {
  const combo = productCombo(text) ?? fractionCombo(text) ?? subtractionCombo(text) ?? additionCombo(text);
  if (!combo) return null;
  if (options?.hideLast) combo.hideLast = true;
  return combo;
}

export function formatCombo(combo: MathCombo, question: string): string {
  const asked = question.trim().match(/[^.?!]*\?/g);
  const line = words(question).length <= 20 ? question.trim() : (asked?.at(-1)?.trim() || question.trim());
  return "```studigo-combo\n" + JSON.stringify(combo) + "\n```\n\nYour turn: " + line;
}

export function parseComboBlock(text: string): MathCombo | null {
  const match = text.match(/```studigo-combo\n([\s\S]*?)\n```/);
  if (!match?.[1]) return null;
  try {
    const value = JSON.parse(match[1]) as MathCombo;
    if (!value || !Array.isArray(value.columns) || value.columns.length < 1) return null;
    return value;
  } catch {
    return null;
  }
}

/** Show the combo instead of a paragraph when the message is a math question or a played example. */
export function comboForDisplay(text: string): { combo: MathCombo; prompt: string } | null {
  const fenced = parseComboBlock(text);
  if (fenced) return { combo: fenced, prompt: comboPrompt(text) };
  if (!text.includes("?")) return null;
  if (/^\s*(nice|not quite|close|almost)\b/i.test(text)) return null;
  const combo = comboFromQuestion(text);
  if (!combo) return null;
  return { combo, prompt: comboPrompt(text) };
}
export function comboPrompt(text: string): string {
  const stripped = text.replace(/```studigo-combo\n[\s\S]*?\n```/g, "").trim();
  if (!stripped) return "";
  if (words(stripped).length <= 24) return stripped;
  const last = stripped.match(/[^.?!]*\?[^?]*$/)?.[0]?.trim();
  return last || stripped;
}
