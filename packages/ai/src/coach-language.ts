import type { ChallengeKind, ScaffoldLevel } from "./coach-challenge";

// ---------------------------------------------------------------------------
// Low language floor, high reasoning ceiling.
//
// Language burden and reasoning demand are separate variables
// (ADAPTIVE_LEARNING_ENGINE.md §1, §13). The renderer lowers the first and
// must hold the second fixed: a harder challenge kind changes the *task*,
// never the vocabulary. These rules are assembled into prompts from code so
// they are testable and cannot drift silently inside one giant prompt.
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

/**
 * What each rung of the reasoning ladder asks the learner to *do*, with a
 * plain-language shape. The shapes are illustrations of register, not
 * templates to copy; the model phrases the real question from the material.
 */
const CHALLENGE_KIND_GUIDANCE: Record<ChallengeKind, string> = {
  recognize: "Reasoning task: recognize. Ask the learner to pick out or name the idea in a simple case. A short answer is fine.",
  recall: "Reasoning task: recall. Ask what the learner remembers about one thing. A short answer is fine. Shape: 'What happens when ice melts?'",
  explain: "Reasoning task: explain. Ask what happens or why it happens, in one familiar case. Shape: 'What happens when ice melts?' then, next turn, 'Why does it do that?'",
  compare: "Reasoning task: compare. Ask how exactly two things are alike or different. Shape: 'How is melting different from freezing?'",
  predict: "Reasoning task: predict. Describe one simple situation and ask what will happen and why. Shape: 'You leave a cup of water in the freezer overnight. What will you find? Why?'",
  apply: "Reasoning task: apply. Give one concrete situation and ask the learner to use the idea on it.",
  transfer: "Reasoning task: transfer. Put the same idea in a new, familiar situation that the material does not describe, and ask whether and why the idea applies. Shape: 'Candle wax turns liquid when it gets hot. Is that like melting ice? Why?'",
  novel_problem: "Reasoning task: solve a new problem. Give a small problem in everyday words that can only be solved with the idea.",
  defend: "Reasoning task: defend reasoning. State one claim plainly (it may be a common mistake) and ask whether the learner agrees and why.",
  teach_back: "Reasoning task: teach back. Ask the learner to explain the idea in their own words, as if to a friend who missed the lesson."
};

/** How much support the question itself may carry (§7). */
const SCAFFOLD_GUIDANCE: Record<ScaffoldLevel, string> = {
  0: "Support level 0 (independent): give no clue inside the question.",
  1: "Support level 1 (gentle prompt): you may add one short nudge, such as what to think about, without hinting at the answer.",
  2: "Support level 2 (hint): you may include one clue that narrows the search but does not state the answer.",
  3: "Support level 3 (concrete example): anchor the question in one concrete example from the excerpts.",
  4: "Support level 4 (choices): offer two or three short answer choices, then ask why.",
  5: "Support level 5 (worked example): show one short worked example from the excerpts, then ask a similar question."
};

export function challengeKindGuidance(kind: ChallengeKind): string {
  return CHALLENGE_KIND_GUIDANCE[kind];
}

export function scaffoldGuidance(level: ScaffoldLevel): string {
  return SCAFFOLD_GUIDANCE[level];
}

// ---------------------------------------------------------------------------
// Deterministic language-floor check. Used by tests (language invariants,
// never exact prose) and surfaced in the Coach turn log for observability.
// It does not rewrite or block model output.
// ---------------------------------------------------------------------------

export type LanguageFloorReport = {
  /** Questions with 3+ words. A bare probe like "Why?" or "How come?" is not a main question. */
  mainQuestionCount: number;
  longestSentenceWords: number;
  /** Sentences that pack a list of 4+ items ("a, b, c, and d"). */
  denseListSentences: number;
};

export const MAX_SENTENCE_WORDS = 20;

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
  return {
    mainQuestionCount: sentences.filter((sentence) => sentence.endsWith("?") && wordCount(sentence) >= 3).length,
    longestSentenceWords: sentences.reduce((max, sentence) => Math.max(max, wordCount(sentence)), 0),
    denseListSentences: sentences.filter((sentence) => (sentence.match(/,/g) ?? []).length >= 3).length
  };
}

/** A Coach question passes when it asks exactly one main question in short, list-free sentences. */
export function questionMeetsLanguageFloor(text: string): boolean {
  const report = assessLanguageFloor(text);
  return report.mainQuestionCount === 1 && report.longestSentenceWords <= MAX_SENTENCE_WORDS && report.denseListSentences === 0;
}
