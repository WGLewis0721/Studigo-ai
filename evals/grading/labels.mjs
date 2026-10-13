/** Human-label loading and validation for the E9 live harness. Pure functions, no network. */
import { CLASSES } from "./score.mjs";

export const REQUIRED_FIELDS = ["id", "subject", "question", "reference_answer", "learner_answer", "label", "reviewer"];

/** Reviewer strings that are not a named human. Matched case-insensitively. */
const NOT_A_HUMAN = /fixture|template|\b(ai|llm|bot|model|assistant|auto|synthetic)\b|gpt|claude|openai|anthropic|gemini|llama|mistral|ollama|copilot|sonnet|opus|haiku/i;

export function isHumanReviewer(reviewer) {
  return typeof reviewer === "string" && reviewer.trim() !== "" && !NOT_A_HUMAN.test(reviewer);
}

export function parseLabelsJsonl(text) {
  const rows = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      rows.push(JSON.parse(line));
    } catch {
      throw new Error(`labels line ${index + 1} is not valid JSON`);
    }
  });
  return rows;
}

/** Returns a list of problems. An empty list means the rows may be run. */
export function validateLabelRows(rows) {
  const problems = [];
  if (!rows.length) problems.push("no label rows");
  const seen = new Set();
  rows.forEach((row, index) => {
    const where = `row ${index + 1}${row && row.id ? ` (${row.id})` : ""}`;
    for (const field of REQUIRED_FIELDS) {
      if (typeof row?.[field] !== "string" || (field !== "reviewer" && row[field].trim() === "")) {
        problems.push(`${where}: missing or non-string "${field}"`);
      }
    }
    if (typeof row?.id === "string") {
      if (/^TEMPLATE-/i.test(row.id)) problems.push(`${where}: TEMPLATE rows are examples, not labels`);
      if (seen.has(row.id)) problems.push(`${where}: duplicate id`);
      seen.add(row.id);
    }
    if (typeof row?.label === "string" && !CLASSES.includes(row.label)) {
      problems.push(`${where}: label "${row.label}" is not one of ${CLASSES.join(", ")}`);
    }
    if (typeof row?.reviewer === "string" && !isHumanReviewer(row.reviewer)) {
      problems.push(`${where}: reviewer "${row.reviewer}" is empty, a fixture, or model-like; a named human must label`);
    }
  });
  return problems;
}

/**
 * Score band -> class, taken only from the bands in the gradeShortAnswer prompt in
 * packages/ai/src/study.ts: "85-100 correct and complete. 60-84 the core idea with a gap.
 * 30-59 partly right. 0-29 incorrect or empty." The prompt has no band for equivalent,
 * misconception, off_topic or not_sure, so a number can never produce them.
 */
export const SCORE_BANDS = [
  { min: 85, max: 100, cls: "correct" },
  { min: 60, max: 84, cls: "partial" },
  { min: 30, max: 59, cls: "partial" },
  { min: 0, max: 29, cls: "incorrect" }
];

export function scoreToClass(score) {
  const band = SCORE_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ? band.cls : "incorrect";
}

/** Classes the Coach categorical verdict can emit directly (SOCRATIC_VERDICTS names). */
export const COACH_DIRECT = { off_topic: "off_topic", not_sure: "not_sure" };
/** Never produced by either grader, so rows with these labels are reported as unmappable. */
export const NEVER_PREDICTED = ["equivalent", "misconception"];

/** Combine: a Coach off_topic or not_sure verdict wins; otherwise the score band. */
export function predictClass(score, coachVerdict) {
  if (coachVerdict && COACH_DIRECT[coachVerdict]) return COACH_DIRECT[coachVerdict];
  return scoreToClass(score);
}
