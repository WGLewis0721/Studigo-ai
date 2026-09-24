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
