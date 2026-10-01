/**
 * Live eval: does each Coach setting actually change the reply?
 *
 * Asks the real model the same questions under different settings and scores
 * each reply with simple, explainable checks. Needs OPENAI_API_KEY (or the AI
 * Gateway env) and network access, so it does not run in CI.
 *
 *   pnpm --filter @studigo/web eval:coach-styles            # 23 combos x 2 questions
 *   pnpm --filter @studigo/web eval:coach-styles -- --full  # all 270 combos
 *   pnpm --filter @studigo/web eval:coach-styles -- --dry-run  # no model calls
 *
 * Writes a Markdown report to eval-results/coach-styles-<timestamp>.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { answerFromRetrievedContext, type RetrievedChunk } from "@studigo/ai";
import { PRACTICE_PROTOCOLS, STYLES, TRADITIONS, directivesForTurn, type CoachPreferences } from "../lib/coach-preferences";
import { formatDirectives } from "../lib/directive-format";
import { MATERIAL_NOTES } from "../lib/fixture-materials";

const args = new Set(process.argv.slice(2));
const LEVELS = ["simpler", "standard", "deeper"] as const;
const QUESTIONS = [
  "Coach me on instinctive and learned behaviors.",
  "Why do some traits get passed down and others don't?"
];

const chunks: RetrievedChunk[] = Object.entries(MATERIAL_NOTES).map(([topic, note], index) => ({
  id: `fixture-${index}`, documentId: "fixture-guide", documentName: "Fifth Grade Science study guide",
  content: `${topic}. ${note.summary} Example: ${note.example}`, similarity: 0.8,
  sourceType: "study_guide", pageNumber: index + 1, pageLabel: "page", priority: 100
}));

const base: CoachPreferences = { style: "default", tradition: "tradition-default", practice: "adaptive", explainLevel: "standard" };
const combos: CoachPreferences[] = args.has("--full")
  ? STYLES.flatMap(s => TRADITIONS.flatMap(t => PRACTICE_PROTOCOLS.flatMap(p => LEVELS.map(l => ({ style: s.id, tradition: t.id, practice: p.id, explainLevel: l })))))
  : [
      ...STYLES.flatMap(s => LEVELS.map(l => ({ ...base, style: s.id, explainLevel: l }))),
      ...TRADITIONS.map(t => ({ ...base, tradition: t.id }))
    ];

// ---- Scoring: observable signals only, so a failure is easy to read. ----
const words = (text: string) => text.match(/[A-Za-z']+/g) ?? [];
const sentences = (text: string) => text.split(/[.!?]+\s/).filter(s => s.trim().length > 0);
export function readability(text: string) {
  const w = words(text);
  return {
    wordsPerSentence: w.length / Math.max(1, sentences(text).length),
    longWordShare: w.filter(x => x.length >= 9).length / Math.max(1, w.length)
  };
}
export function styleChecks(style: string, text: string): Array<[string, boolean]> {
  const questions = (text.match(/\?/g) ?? []).length;
  const numbered = (text.match(/^\s*(\d+[.)]|[-*])\s+/gm) ?? []).length;
  const lower = text.toLowerCase();
  switch (style) {
    case "socratic": return [["asks 2+ questions", questions >= 2], ["ends on a question", text.trim().endsWith("?")]];
    case "direct": return [["shows a worked example", /example|for instance|step 1|first,/.test(lower)]];
    case "drill": return [["gives 3+ items", numbered >= 3 || questions >= 3]];
    case "progression": return [["splits into steps", /step|part 1|first|next|then/.test(lower)]];
    case "visual": return [["starts concrete", /picture|imagine|model|diagram|think of|like a/.test(lower)]];
    default: return [["gives an example and a task", /example/.test(lower) && questions >= 1]];
  }
}
export function commonChecks(text: string): Array<[string, boolean]> {
  return [["cites the material", /\[\d+\]/.test(text)], ["no em dashes", !text.includes("—")]];
}

async function main() {
  const dry = args.has("--dry-run");
  if (!dry && !process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    console.log("No OPENAI_API_KEY or AI_GATEWAY_API_KEY set. Re-run with a key, or use --dry-run.");
    process.exit(0);
  }
  const rows: string[] = [];
  const levelStats = new Map<string, { wps: number[]; long: number[] }>();
  let passed = 0, total = 0;
  for (const prefs of combos) {
    for (const question of QUESTIONS) {
      const instructions = formatDirectives(directivesForTurn("coach", prefs));
      const text = dry
        ? `Here is an example [1]. What do you notice? Why might that be?`
        : (await answerFromRetrievedContext({ question, instructions, chunks })).text;
      const checks = [...styleChecks(prefs.style, text), ...commonChecks(text)];
      passed += checks.filter(([, ok]) => ok).length; total += checks.length;
      const r = readability(text);
      const stat = levelStats.get(`${prefs.style}:${prefs.explainLevel}`) ?? { wps: [], long: [] };
      stat.wps.push(r.wordsPerSentence); stat.long.push(r.longWordShare);
      levelStats.set(`${prefs.style}:${prefs.explainLevel}`, stat);
      rows.push(`| ${prefs.style} | ${prefs.tradition} | ${prefs.practice} | ${prefs.explainLevel} | ${question.slice(0, 28)}... | ${checks.map(([n, ok]) => `${ok ? "pass" : "FAIL"} ${n}`).join("; ")} | ${r.wordsPerSentence.toFixed(1)} | ${(r.longWordShare * 100).toFixed(0)}% |`);
      process.stdout.write(".");
    }
  }
  // Level check: for each style, simpler should read easier than deeper.
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const levelRows = STYLES.map(s => {
    const simple = levelStats.get(`${s.id}:simpler`), deep = levelStats.get(`${s.id}:deeper`);
    if (!simple || !deep) return null;
    const ok = avg(simple.long) <= avg(deep.long);
    passed += ok ? 1 : 0; total += 1;
    return `| ${s.name} | ${(avg(simple.long) * 100).toFixed(0)}% | ${(avg(deep.long) * 100).toFixed(0)}% | ${ok ? "pass" : "FAIL"} |`;
  }).filter(Boolean);
  const report = [
    `# Coach settings eval${dry ? " (dry run, canned replies)" : ""}`, "",
    `${combos.length} setting combinations x ${QUESTIONS.length} questions. Checks passed: ${passed}/${total}.`, "",
    "## Simpler vs deeper (share of long words)", "", "| Style | Simpler | Deeper | Simpler is plainer |", "| --- | --- | --- | --- |", ...levelRows, "",
    "## Every reply", "", "| Style | Tradition | Practice | Level | Question | Checks | Words/sentence | Long words |", "| --- | --- | --- | --- | --- | --- | --- | --- |", ...rows, ""
  ].join("\n");
  mkdirSync("eval-results", { recursive: true });
  const file = `eval-results/coach-styles-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  writeFileSync(file, report);
  console.log(`\nChecks passed ${passed}/${total}. Report: ${file}`);
}

if (process.argv[1]?.includes("eval-coach-styles")) void main();
