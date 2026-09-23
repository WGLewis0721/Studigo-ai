import type { Citation, GeneratedQuestion, RetrievedChunk } from "@studigo/ai";
import { generateQuizQuestions } from "@studigo/ai";
import { rankWeakAreas, type PracticeEvidence } from "@/lib/study-planning";
import type { Topic } from "@/lib/rooms";

/**
 * Studigo's single decision engine for "what should the learner practice
 * next, and what should the questions actually be." It fuses three layers
 * that are each independently testable:
 *
 *  1. Intent classification (deterministic, no model call): does this
 *     message ask for a batch of practice questions, and how many?
 *  2. Topic selection (deterministic, reuses the earned-mastery ranking in
 *     study-planning.ts): if the learner didn't name a topic, recommend the
 *     one their own attempt history says needs it most.
 *  3. Grounded generation with anti-repetition (RAG + LLM, via
 *     @studigo/ai's generateQuizQuestions): ask the model for a bit more
 *     than requested, then keep only items that are not near-duplicates of
 *     anything already asked in this conversation or in this batch, and
 *     top up in bounded retries until the count is met or the source
 *     material runs out.
 *
 * apps/web/lib/engine.ts (production, real retrieval) and
 * apps/web/lib/fixture-engine.ts (local dev fixture, synthetic chunks) both
 * call into this module so there is exactly one brain behind "give me N
 * practice questions," not one per surface.
 */

// ---------------------------------------------------------------------------
// 1. Intent classification
// ---------------------------------------------------------------------------

export type PracticeIntent = { type: "practice_questions"; count: number };
export type QaIntent = { type: "qa" };
export type EngineIntent = PracticeIntent | QaIntent;

export const MIN_PRACTICE_COUNT = 1;
export const MAX_PRACTICE_COUNT = 20;
export const DEFAULT_PRACTICE_COUNT = 5;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
  few: 3,
  several: 5,
  some: 5
};

// Matches "10 questions", "ten more questions", "a few practice questions", etc.
// \d{1,3} (not {1,2}) so a three-digit ask like "500 questions" is still
// recognized as a practice-question request before being clamped below.
const COUNTED_QUESTION_PATTERN =
  /\b(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple|few|several|some)\s+(?:more\s+|new\s+|practice\s+|additional\s+)*questions?\b/i;

// Catches requests that ask for practice questions without a parseable count.
const GENERIC_PRACTICE_PATTERN =
  /\b(quiz|test)\s+me\b|\bgive\s+me\s+(?:some|a\s+few|practice)\s+questions?\b|\bask\s+me\s+(?:some\s+)?questions?\b|\bpractice\s+questions?\b/i;

export function classifyIntent(message: string): EngineIntent {
  const text = message.trim().toLowerCase();
  if (!text) return { type: "qa" };

  const countedMatch = text.match(COUNTED_QUESTION_PATTERN);
  if (!countedMatch && !GENERIC_PRACTICE_PATTERN.test(text)) return { type: "qa" };

  let count = DEFAULT_PRACTICE_COUNT;
  if (countedMatch) {
    const token = countedMatch[1];
    count = /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token] ?? DEFAULT_PRACTICE_COUNT;
  }

  return {
    type: "practice_questions",
    count: Math.min(MAX_PRACTICE_COUNT, Math.max(MIN_PRACTICE_COUNT, Math.round(count)))
  };
}

// ---------------------------------------------------------------------------
// 2. Topic selection — decision support only, never a replacement for the
//    learner's earned mastery score computed elsewhere.
// ---------------------------------------------------------------------------

export type ResolvedPracticeTopic = { topic: Topic; reason: string };

export function resolvePracticeTopic(args: {
  message: string;
  topics: Topic[];
  evidence: PracticeEvidence[];
  now?: number;
}): ResolvedPracticeTopic | null {
  if (!args.topics.length) return null;

  const text = args.message.toLowerCase();
  const named = args.topics.find((topic) => topic.title && text.includes(topic.title.toLowerCase()));
  if (named) return { topic: named, reason: "The learner named this topic directly." };

  const ranked = rankWeakAreas(args.topics, args.evidence, args.now);
  const weakest = ranked[0];
  if (weakest) {
    return {
      topic: weakest.topic,
      reason: weakest.reasons[0] ?? "This is the learner's current highest-priority topic to practice."
    };
  }

  // Every topic already looks solid (e.g. everything mastered): fall back to
  // the teacher's stated priority order instead of refusing to generate.
  const byPriority = [...args.topics].sort(
    (a, b) => b.priority - a.priority || a.order_index - b.order_index || a.id.localeCompare(b.id)
  )[0];
  return byPriority ? { topic: byPriority, reason: "Highest priority topic in the current study scope." } : null;
}

// ---------------------------------------------------------------------------
// 3a. Anti-repetition — stopword-filtered term-set Jaccard similarity.
//     Deterministic, no model call, and cheap enough to run on every batch.
//     Filtering stopwords first matters: two questions about the same
//     subject share mostly function words ("what", "the", "on", "a"), so
//     raw word overlap alone would call almost anything a duplicate. What
//     should decide it is whether the *content* words match.
// ---------------------------------------------------------------------------

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "am", "be", "been", "being",
  "on", "in", "at", "to", "of", "and", "or", "but", "that", "this", "these",
  "those", "it", "its", "for", "with", "from", "as", "by", "do", "does", "did",
  "what", "why", "how", "who", "which", "when", "where", "whom", "will",
  "would", "should", "can", "could", "may", "might", "must", "shall", "have",
  "has", "had", "so", "if", "than", "then", "no", "not", "nor", "you", "your"
]);

function contentWordSet(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word));
  return new Set(words);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * True when two question prompts are close enough to count as the same
 * question. Strictly greater than the threshold (not >=) so that changing
 * one meaningful word in an otherwise short, mostly-shared sentence — e.g.
 * "balanced" to "unbalanced" — lands just under the line instead of on it.
 */
export function isNearDuplicateText(a: string, b: string, threshold = DUPLICATE_SIMILARITY_THRESHOLD): boolean {
  return jaccardSimilarity(contentWordSet(a), contentWordSet(b)) > threshold;
}

/**
 * Drops any candidate that is a near-duplicate of a prior prompt (from
 * earlier in this conversation) or of another candidate already kept from
 * this same batch. Order is preserved among the survivors.
 */
export function dedupeQuestions<T extends { prompt: string }>(
  candidates: T[],
  priorPrompts: string[] = [],
  threshold = DUPLICATE_SIMILARITY_THRESHOLD
): T[] {
  const priorWordSets = priorPrompts.map((prompt) => contentWordSet(prompt));
  const kept: T[] = [];
  const keptWordSets: Set<string>[] = [];

  for (const candidate of candidates) {
    const candidateWords = contentWordSet(candidate.prompt);
    const duplicatesPrior = priorWordSets.some((words) => jaccardSimilarity(candidateWords, words) > threshold);
    const duplicatesKept = keptWordSets.some((words) => jaccardSimilarity(candidateWords, words) > threshold);
    if (!duplicatesPrior && !duplicatesKept) {
      kept.push(candidate);
      keptWordSets.push(candidateWords);
    }
  }

  return kept;
}

/**
 * Pulls prior question prompts back out of this engine's own numbered-list
 * output so a later "give me 10 more" in the same conversation cannot repeat
 * them. Only assistant turns are scanned.
 */
export function extractPriorPromptsFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): string[] {
  const NUMBERED_LINE = /^\s*\d{1,2}\.\s+(.+?)\s*(?:\[\d{1,2}\])?\s*$/;
  const prompts: string[] = [];
  for (const message of history) {
    if (message.role !== "assistant") continue;
    for (const line of message.content.split("\n")) {
      const match = line.match(NUMBERED_LINE);
      if (match) prompts.push(match[1].trim());
    }
  }
  return prompts;
}

// ---------------------------------------------------------------------------
// 3b. Grounded generation with bounded top-up retries.
// ---------------------------------------------------------------------------

export type GenerateQuizQuestionsFn = typeof generateQuizQuestions;

const MAX_GENERATION_ATTEMPTS = 3;

export async function buildPracticeQuestionSet(args: {
  chunks: RetrievedChunk[];
  topicTitle?: string;
  objective?: string;
  count: number;
  priorPrompts?: string[];
  /** Injection point for tests; defaults to the real RAG + LLM call. */
  generate?: GenerateQuizQuestionsFn;
}): Promise<GeneratedQuestion[]> {
  if (!args.chunks.length || args.count <= 0) return [];

  const generate = args.generate ?? generateQuizQuestions;
  const prior = [...(args.priorPrompts ?? [])];
  const result: GeneratedQuestion[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && result.length < args.count; attempt += 1) {
    const remaining = args.count - result.length;
    // Ask for headroom so filtering duplicates still leaves enough to reach
    // the requested count; grow the ask on each retry as material runs thin.
    const requestCount = Math.min(MAX_PRACTICE_COUNT * 2, remaining + remaining * attempt + 2);

    // eslint-disable-next-line no-await-in-loop -- each attempt depends on how many unique items the previous one produced
    const batch = await generate({
      chunks: args.chunks,
      topicTitle: args.topicTitle,
      objective: args.objective,
      count: requestCount
    });

    const unique = dedupeQuestions(batch, [...prior, ...result.map((question) => question.prompt)]);
    for (const question of unique) {
      if (result.length >= args.count) break;
      result.push(question);
    }
  }

  return result.slice(0, args.count);
}

// ---------------------------------------------------------------------------
// 4. Presentation — turns generated questions into the coach's chat reply.
//    Never self-narrates the pedagogy directives; only ever states content.
// ---------------------------------------------------------------------------

export function formatQuestionsForChat(args: {
  questions: GeneratedQuestion[];
  topicTitle: string;
  sourceLabel: string;
}): string {
  if (!args.questions.length) {
    return `I don't have enough of the material on ${args.topicTitle.toLowerCase()} yet to write new practice questions without repeating one you've already seen. Add more of the study guide for this topic and ask again.`;
  }

  const lines = args.questions.map((question, index) => {
    const marker = question.sourceMarkers[0] ? ` [${question.sourceMarkers[0]}]` : "";
    if (question.kind === "multiple_choice") {
      const choices = question.choices
        .map((choice, choiceIndex) => `   ${String.fromCharCode(97 + choiceIndex)}) ${choice}`)
        .join("\n");
      return `${index + 1}. ${question.prompt}${marker}\n${choices}`;
    }
    if (question.kind === "true_false") {
      return `${index + 1}. (True or False) ${question.prompt}${marker}`;
    }
    return `${index + 1}. ${question.prompt}${marker}`;
  });

  const count = args.questions.length;
  return [
    `Here ${count === 1 ? "is" : "are"} ${count} practice question${count === 1 ? "" : "s"} grounded in ${args.sourceLabel}, focused on ${args.topicTitle.toLowerCase()}:`,
    "",
    lines.join("\n\n"),
    "",
    "Answer any of these and I'll check your reasoning against the material."
  ].join("\n");
}

/** Citations limited to the excerpts the returned questions actually used. */
export function citationsForQuestions(questions: GeneratedQuestion[], available: Citation[]): Citation[] {
  const used = new Set<number>();
  for (const question of questions) {
    for (const marker of question.sourceMarkers) used.add(marker);
  }
  return available.filter((citation) => used.has(citation.marker));
}
