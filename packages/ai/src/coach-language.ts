// ---------------------------------------------------------------------------
// Low language floor, high reasoning ceiling.
//
// Language burden and reasoning demand are separate variables
// (ADAPTIVE_LEARNING_ENGINE.md §1, §13). The renderer lowers the first and
// must hold the second fixed: a harder challenge kind changes the *task*,
// never the vocabulary. These rules are assembled into prompts from code so
// they are testable and cannot drift silently inside one giant prompt.
// What the task IS comes from the control plane's ChallengeSpec, rendered in
// apps/web/lib/coach-render.ts; this package never interprets it.
// ---------------------------------------------------------------------------

export const LANGUAGE_FLOOR_RULES: readonly string[] = [
  "Ask one main question per turn. A short follow-up probe such as 'Why?' is allowed; a second full question is not.",
  "Keep to one concept at a time.",
  "Use short sentences and familiar words first. Prefer 'turns into' over 'undergoes a transition to'.",
  "Only use a technical word when the learner needs it, and define it in plain words right away.",
  "When it helps, use one concrete, everyday example before any abstract statement.",
  "Never pack several processes, lists, or clauses into one prompt. Split multi-step reasoning across turns.",
  "Be respectful and age-neutral: plain is not childish. No baby talk, no praise inflation.",
  "Make a question harder by making the thinking harder, never by making the English harder."
];

// ---------------------------------------------------------------------------
// Deterministic language-floor check and its bounded enforcement.
//
// This is a small, explainable lint, not a readability model. It catches the
// obvious burdens: more than one main question, long sentences, packed lists,
// stacked task verbs ("explain ... and describe ..."), academic connectors
// ("the process by which", "whereby"), and a pile-up of long words.
// ---------------------------------------------------------------------------

export type LanguageFloorReport = {
  /** Questions with 3+ words. A bare probe like "Why?" or "How come?" is not a main question. */
  mainQuestionCount: number;
  longestSentenceWords: number;
  /** Sentences that pack a list of 4+ items ("a, b, c, and d"). */
  denseListSentences: number;
  /** Distinct task verbs asked for at once ("explain", "describe", "compare"...). */
  taskVerbs: number;
  /** Academic connectors that signal nested, formal syntax. */
  academicPhrases: string[];
  /** Words of 13+ letters. One defined technical term is fine; a pile-up is not. */
  longWords: number;
};

export const MAX_SENTENCE_WORDS = 20;
export const MAX_LONG_WORDS = 2;
const LONG_WORD_LETTERS = 13;

const TASK_VERB_PATTERN =
  /\b(explain|describe|compare|contrast|identify|list|discuss|analy[sz]e|evaluate|justify|summari[sz]e|outline|define|illustrate)\b/gi;
const ACADEMIC_PHRASES = [
  "the process by which",
  "the extent to which",
  "the manner in which",
  "whereby",
  "wherein",
  "thereby",
  "thereof",
  "aforementioned",
  "notwithstanding",
  "respectively",
  "in terms of",
  "with respect to",
  "in relation to"
];

function splitSentences(text: string): string[] {
  return (text.replace(/\[\d+\]/g, "").match(/[^.!?]+[.!?]*/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length;
}

export function assessLanguageFloor(text: string): LanguageFloorReport {
  const sentences = splitSentences(text);
  const lower = text.toLowerCase();
  return {
    mainQuestionCount: sentences.filter((sentence) => sentence.endsWith("?") && wordCount(sentence) >= 3).length,
    longestSentenceWords: sentences.reduce((max, sentence) => Math.max(max, wordCount(sentence)), 0),
    denseListSentences: sentences.filter((sentence) => (sentence.match(/,/g) ?? []).length >= 3).length,
    taskVerbs: new Set((text.match(TASK_VERB_PATTERN) ?? []).map((verb) => verb.toLowerCase())).size,
    academicPhrases: ACADEMIC_PHRASES.filter((phrase) => new RegExp(`\\b${phrase}\\b`).test(lower)),
    longWords: (text.match(/[a-z]+/gi) ?? []).filter((word) => word.length >= LONG_WORD_LETTERS).length
  };
}

/** Plain-language reasons a question fails the floor; empty when it passes. */
export function languageFloorViolations(text: string): string[] {
  const report = assessLanguageFloor(text);
  const violations: string[] = [];
  if (report.mainQuestionCount !== 1) violations.push(`asks ${report.mainQuestionCount} main questions; ask exactly one`);
  if (report.longestSentenceWords > MAX_SENTENCE_WORDS) {
    violations.push(`has a ${report.longestSentenceWords}-word sentence; keep every sentence to ${MAX_SENTENCE_WORDS} words or fewer`);
  }
  if (report.denseListSentences) violations.push("packs a long list into one sentence");
  if (report.taskVerbs > 1) violations.push("asks for several tasks at once; ask for one");
  if (report.academicPhrases.length) violations.push(`uses formal connectors (${report.academicPhrases.join(", ")})`);
  if (report.longWords > MAX_LONG_WORDS) violations.push("uses too many long words; prefer familiar words");
  return violations;
}

/** A Coach question passes when `languageFloorViolations` finds nothing. */
export function questionMeetsLanguageFloor(text: string): boolean {
  return languageFloorViolations(text).length === 0;
}

// --- Reasoning-demand guard -------------------------------------------------
// A rewrite may make the English easier, never the thinking. These are the
// surface markers of a reasoning demand; a rewrite that drops all of them, or
// turns a reasoning task into a bare yes/no question, is rejected.

const REASONING_MARKER =
  /\b(why|how|what\s+(?:would|will|if|happens|makes|causes)|which|predict|explain|compare|differ(?:ent|ence)?|alike|same|agree|because|what\s+do\s+you\s+think)\b/i;
const BARE_YES_NO = /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have)\b/i;

function citationMarkers(text: string): Set<string> {
  return new Set(text.match(/\[\d+\]/g) ?? []);
}

/** Why a rewrite would lose reasoning demand or source truth; null when it keeps both. */
export function rewriteLosesDemand(original: string, rewritten: string, requiresReasoning: boolean): string | null {
  if (REASONING_MARKER.test(original) && !REASONING_MARKER.test(rewritten)) return "dropped the reasoning demand";
  if (requiresReasoning && BARE_YES_NO.test(rewritten.trim()) && !REASONING_MARKER.test(rewritten)) {
    return "became a bare yes/no question";
  }
  const allowed = citationMarkers(original);
  if ([...citationMarkers(rewritten)].some((marker) => !allowed.has(marker))) return "cited a source the question did not";
  return null;
}

export type LanguageFloorEnforcement = {
  passedInitially: boolean;
  rewriteAttempted: boolean;
  rewriteAccepted: boolean;
  /** Why the rewrite was not used, when it was attempted and rejected. */
  rejectedReason?: string;
  finalViolations: string[];
};

/**
 * Validates a generated question and, if it fails, allows at most ONE
 * constrained rewrite. The rewrite is used only if it passes the floor AND
 * keeps the reasoning demand and citations; otherwise the original question
 * stands (harder English beats silently easier thinking). Never loops.
 */
export async function enforceLanguageFloor(args: {
  question: string;
  requiresReasoning: boolean;
  rewrite: (violations: string[]) => Promise<string>;
}): Promise<{ question: string; enforcement: LanguageFloorEnforcement }> {
  const initial = languageFloorViolations(args.question);
  if (!initial.length) {
    return { question: args.question, enforcement: { passedInitially: true, rewriteAttempted: false, rewriteAccepted: false, finalViolations: [] } };
  }

  let rewritten = "";
  try {
    rewritten = (await args.rewrite(initial)).trim();
  } catch {
    rewritten = "";
  }
  const reject = (reason: string) => ({
    question: args.question,
    enforcement: { passedInitially: false, rewriteAttempted: true, rewriteAccepted: false, rejectedReason: reason, finalViolations: initial }
  });
  if (!rewritten) return reject("rewrite unavailable");
  const lost = rewriteLosesDemand(args.question, rewritten, args.requiresReasoning);
  if (lost) return reject(lost);
  const after = languageFloorViolations(rewritten);
  if (after.length) return reject(`rewrite still ${after[0]}`);
  return { question: rewritten, enforcement: { passedInitially: false, rewriteAttempted: true, rewriteAccepted: true, finalViolations: [] } };
}
