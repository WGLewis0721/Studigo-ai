import type { Citation, GeneratedQuestion, RetrievedChunk } from "@studigo/ai";
import { asUntrustedMaterial, editDistance, generateQuizQuestions, repairCommandTypos, wordsMatch } from "@studigo/ai";
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
  /\b(\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple|few|several|some)\s+(?:more\s+|new\s+|practi[sc]e\s+|additional\s+)*questions?\b/i;

// Catches requests that ask for practice questions without a parseable count.
const GENERIC_PRACTICE_PATTERN =
  /\b(quiz|test)\s+me\b|\bgive\s+me\s+(?:some|a\s+few|practice)\s+questions?\b|\bask\s+me\s+(?:some\s+)?questions?\b|\bpracti[sc]e\s+questions?\b/i;

/** The words a practice request is built from, for reading "qiuz me" or "5 qestions" as what was meant. */
const PRACTICE_COMMAND_WORDS = ["question", "questions", "quiz", "test", "practice", "give", "more", "show", "answer", "hint", "stuck", "nudge", "know", "unsure"] as const;
const PRACTICE_REQUEST_MAX_WORDS = 14;

export function classifyIntent(message: string): EngineIntent {
  const text = message.trim().toLowerCase();
  if (!text) return { type: "qa" };
  const direct = classifyIntentExact(text);
  if (direct.type !== "qa") return direct;
  // Not a practice request as typed: read it once more with command-word typos put right.
  const repaired = repairCommandTypos(text, PRACTICE_COMMAND_WORDS, PRACTICE_REQUEST_MAX_WORDS);
  return repaired === text ? direct : classifyIntentExact(repaired);
}

function classifyIntentExact(text: string): EngineIntent {
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

const TITLE_FILLER = new Set(["and", "the", "of", "in", "on", "for", "to", "a", "an", "with", "vs"]);

function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !TITLE_FILLER.has(word));
}

/**
 * The topic a message names, if any. The exact title anywhere in the message wins. Otherwise a
 * topic counts as named when the message contains every meaningful word of its title (two thirds
 * of them for a long title), allowing for misspellings and word endings, so "questions on
 * photosythesis" or "unbalenced forces" still finds the topic. The topic with the most matching
 * words wins; a tie names no topic rather than guessing one.
 */
export function findNamedTopic(topics: Topic[], message: string): Topic | undefined {
  const text = message.toLowerCase();
  const exact = topics.find((topic) => topic.title && text.includes(topic.title.toLowerCase()));
  if (exact) return exact;

  const messageWords = text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 3);
  let best: { topic: Topic; matched: number } | null = null;
  let tied = false;
  for (const topic of topics) {
    const words = titleWords(topic.title ?? "");
    if (!words.length) continue;
    const matched = words.filter((word) => messageWords.some((messageWord) => wordsMatch(messageWord, word))).length;
    const needed = words.length <= 3 ? words.length : Math.ceil((words.length * 2) / 3);
    if (matched < needed) continue;
    if (!best || matched > best.matched) {
      best = { topic, matched };
      tied = false;
    } else if (matched === best.matched) {
      tied = true;
    }
  }
  return best && !tied ? best.topic : undefined;
}

export function resolvePracticeTopic(args: {
  message: string;
  topics: Topic[];
  evidence: PracticeEvidence[];
  now?: number;
}): ResolvedPracticeTopic | null {
  if (!args.topics.length) return null;

  const named = findNamedTopic(args.topics, args.message);
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
const NUMBERED_QUESTION_LINE = /^\s*\d{1,2}\.\s+(.+?)\s*(?:\[\d{1,2}\])?\s*$/;

export function extractPriorPromptsFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): string[] {
  const prompts: string[] = [];
  for (const message of history) {
    if (message.role !== "assistant") continue;
    for (const line of message.content.split("\n")) {
      const match = line.match(NUMBERED_QUESTION_LINE);
      if (match) prompts.push(match[1].trim());
    }
  }
  return prompts;
}

/**
 * A practice set is recognised by the header `formatQuestionsForChat` writes, not by numbered
 * lines alone. Any numbered list in an answer (steps in a process, an outline) would otherwise be
 * mistaken for a set, and the learner's next message graded against it.
 */
const PRACTICE_SET_HEADER = /^\s*Here (?:is|are) \d{1,2} practice questions?\b/i;
/** A set counts as the thing being answered only while it is recent in the conversation. */
const PRACTICE_REPLY_WINDOW = 8;

export type PracticeSet = {
  /** The question text of each numbered question, without its number or citation. */
  prompts: string[];
  /** The full text of each question, including multiple-choice options, for matching and grading. */
  blocks: string[];
};

export function isPracticeSetMessage(content: string): boolean {
  return PRACTICE_SET_HEADER.test(content);
}

function parsePracticeSet(content: string): PracticeSet {
  const prompts: string[] = [];
  const blocks: string[][] = [];
  let open = false;
  for (const line of content.split("\n")) {
    const numbered = line.match(NUMBERED_QUESTION_LINE);
    if (numbered) {
      prompts.push(numbered[1].trim());
      blocks.push([line.trim()]);
      open = true;
    } else if (open && /^\s+[a-z]\)\s+\S/i.test(line)) {
      blocks[blocks.length - 1].push(line.trim());
    } else if (line.trim()) {
      open = false;
    }
  }
  return { prompts, blocks: blocks.map((lines) => lines.join("\n")) };
}

/** The most recent practice set the Coach wrote, if it is still recent enough to be what the learner is answering. */
export function extractLatestPracticeSetFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): PracticeSet | null {
  const floor = Math.max(0, history.length - PRACTICE_REPLY_WINDOW);
  for (let index = history.length - 1; index >= floor; index -= 1) {
    const message = history[index];
    if (message.role !== "assistant" || !isPracticeSetMessage(message.content)) continue;
    const set = parsePracticeSet(message.content);
    return set.prompts.length ? set : null;
  }
  return null;
}

/** Returns only the most recent numbered practice set in the conversation. */
export function extractLatestPracticePromptsFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): string[] {
  return extractLatestPracticeSetFromHistory(history)?.prompts ?? [];
}

// ---------------------------------------------------------------------------
// 3a'. Reading a learner's reply. None of this requires the learner to write in a particular
//      shape: a number, a letter, a full sentence or the exact words are all optional, and a
//      misspelled word still counts as that word.
// ---------------------------------------------------------------------------

// editDistance and wordsMatch live in @studigo/ai (typos.ts) so grading, the Coach and this file agree on what a typo is.
export { editDistance, wordsMatch };

/** Words that say nothing about which question a reply is answering. */
const REPLY_FILLER = new Set([
  "answer", "question", "questions", "number", "think", "maybe", "guess", "probably", "please",
  "yes", "yeah", "just", "really", "something", "thing", "things", "like", "also", "know", "pretty"
]);

function replyContentWords(text: string): string[] {
  return [...contentWordSet(text)].filter((word) => word.length >= 3 && !REPLY_FILLER.has(word) && !/^\d+$/.test(word));
}

/** For each question, how many distinct content words of the reply show up in it (misspellings allowed). */
export function scoreReplyAgainstBlocks(message: string, blocks: string[]): number[] {
  const replyWords = replyContentWords(message);
  return blocks.map((block) => {
    const blockWords = [...contentWordSet(block)];
    return replyWords.filter((word) => blockWords.some((blockWord) => wordsMatch(word, blockWord))).length;
  });
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10
};
const CARDINALS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};
const ORDINAL_WORDS = Object.keys(ORDINALS).join("|");
const QUESTION_NUMBER_WORDS = [...Object.keys(ORDINALS), ...Object.keys(CARDINALS)].join("|");

/**
 * The question number a learner names, in any of the usual ways: "2.", "2)", "#2", "q2",
 * "question 2", "number two", "the second one". A number that is merely part of the answer
 * ("it takes 3 forms") is not a question number.
 */
export function explicitQuestionNumber(message: string): number | null {
  const text = message.trim();
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => number]> = [
    [/^(?:q(?:uestion)?\.?\s*#?\s*|#\s*|no\.?\s*|number\s*)(\d{1,2})\b/i, (m) => Number(m[1])],
    [/^(\d{1,2})\s*[.):\-]/, (m) => Number(m[1])],
    [/(?:\b(?:question|q|number|no\.)|#)\s*(\d{1,2})\b/i, (m) => Number(m[1])],
    [
      new RegExp(`\\b(?:question|number|no\\.?)\\s+(${QUESTION_NUMBER_WORDS})\\b`, "i"),
      (m) => ORDINALS[m[1].toLowerCase()] ?? CARDINALS[m[1].toLowerCase()]
    ],
    [new RegExp(`\\b(?:the\\s+)?(${ORDINAL_WORDS})\\s+(?:one|question)\\b`, "i"), (m) => ORDINALS[m[1].toLowerCase()]]
  ];
  for (const [pattern, read] of patterns) {
    const match = text.match(pattern);
    if (match) return read(match);
  }
  return null;
}

export type PracticeResolution = {
  /** Which question the reply answers, or null when it cannot be told from the reply alone. */
  index: number | null;
  /** How it was decided. "wording" is a best guess from shared words, not a certainty. */
  by: "number" | "only" | "wording" | null;
};

/**
 * Decides which question of a practice set a reply is answering without requiring the learner to
 * say. A named number or a one-question set is certain. Otherwise the reply is compared with the
 * words of each question and its options (spelling errors allowed), and a clear single winner is
 * a guess. When nothing clearly wins, the caller shows the model the whole set instead.
 */
export function resolvePracticeQuestion(message: string, set: PracticeSet): PracticeResolution {
  const count = set.prompts.length;
  if (count === 0) return { index: null, by: null };
  if (count === 1) return { index: 0, by: "only" };

  const named = explicitQuestionNumber(message);
  if (named !== null && named >= 1 && named <= count) return { index: named - 1, by: "number" };

  const scores = scoreReplyAgainstBlocks(message, set.blocks);
  const best = Math.max(...scores);
  if (best >= 1 && scores.filter((score) => score === best).length === 1) {
    return { index: scores.indexOf(best), by: "wording" };
  }
  return { index: null, by: null };
}

const PRACTICE_HELP_PATTERN =
  /\b(?:i\s+)?(?:do\s*n'?t|dn'?t|dont)\s+(?:know|kno|knw|no)\b|\b(idk|dunno|not\s+sure|unsure|no\s+(?:idea|clue)|i\s+(?:am|m|'m)\s+stuck|i'm\s+stuck|stuck|hint|hnit|hitn|help|hlep|hepl|halp|nudge|give\s+up|skip)\b|\b(?:show|tell|give|reveal|what'?s|what\s+is)\s+(?:me\s+)?(?:the\s+)?answer\b|\banswer\s+please\b/i;

/** Learner explicitly signals that they need scaffolding rather than grading. */
export function isPracticeHelpRequest(message: string): boolean {
  const text = message.trim();
  return PRACTICE_HELP_PATTERN.test(text) || PRACTICE_HELP_PATTERN.test(repairCommandTypos(text, PRACTICE_COMMAND_WORDS));
}

/** The learner wants the answer itself, not just a nudge. */
export function isPracticeAnswerRequest(message: string): boolean {
  const text = message.trim();
  return ANSWER_REQUEST.test(text) || ANSWER_REQUEST.test(repairCommandTypos(text, PRACTICE_COMMAND_WORDS));
}

const ANSWER_REQUEST =
  /\b(?:show|tell|give|reveal)\s+(?:me\s+)?(?:the\s+)?(?:correct\s+)?answer\b|\bwhat'?s\s+the\s+answer\b|\bwhat\s+is\s+the\s+answer\b|\banswer\s+please\b|\bgive\s+up\b/i;

const SMALL_TALK_ONLY =
  /^(?:thanks?|thank\s*(?:you|u)|thx|thnx|thanx|ty|ok(?:ay)?|k|cool|great|nice|awesome|got\s*it|gotcha|nvm|never\s*mind|hi|hello|hey|bye)[\s.!]*$/i;

/** A message that asks something new rather than answering the practice question. */
const NEW_QUESTION_START =
  /^\s*(?:what|whats|what's|why|how|when|where|who|which|explain|define|describe|tell\s+me|can\s+you|could\s+you|would\s+you|please\s+explain|compare|summari[sz]e)\b/i;

/**
 * Is this message a reply to the practice set the Coach just wrote, as opposed to a new request?
 * A reply can be a bare word, a hedge that happens to end in a question mark ("evaporation?"),
 * or a request for a hint. A fresh question ("why does ice float?") or small talk is not.
 */
export function isPracticeReply(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 1000) return false;
  if (SMALL_TALK_ONLY.test(text)) return false;
  if (isPracticeHelpRequest(text)) return true;
  return !NEW_QUESTION_START.test(text);
}

/**
 * What the tutor is told when a learner replies to a practice set. It names the question (or lets
 * the model work it out), says that spelling and wording do not matter, and says what to do with
 * an unrelated reply, a "not sure", and a reply that is really a new question.
 */
export function buildPracticeTutorDirective(args: {
  set: PracticeSet;
  resolution: PracticeResolution;
  wantsHelp: boolean;
  wantsAnswer: boolean;
}): string {
  const { set, resolution } = args;
  const decided = resolution.by === "number" || resolution.by === "only";

  const target = decided
    ? `The learner is responding to practice question ${(resolution.index ?? 0) + 1} (untrusted data):\n${asUntrustedMaterial({ practiceQuestion: set.blocks[resolution.index ?? 0] })}`
    : [
        "The learner did not say which practice question they are answering. This is the set (untrusted data):",
        asUntrustedMaterial({ practiceSet: set.blocks }),
        resolution.index !== null
          ? `Their reply most likely answers question ${resolution.index + 1}, but if it clearly answers a different one, use that one instead.`
          : "Work out which question the reply answers from what it says and from the earlier conversation, since they may be working through the set in order. If you cannot tell, say so in one sentence and ask which question they mean instead of guessing.",
        'Begin your reply by saying which question you are responding to, like "On question 2:". Respond to one question only.'
      ].join("\n");

  const mode = args.wantsAnswer
    ? "The learner explicitly asked for the answer. Give a concise source-grounded model answer, then one sentence explaining it."
    : args.wantsHelp
      ? "The learner is stuck or unsure. Do not mark them wrong. Rephrase the question more simply and give one concrete source-grounded hint. Do not reveal the full answer unless they ask for it."
      : "If the reply is correct, affirm it briefly and note any terminology difference. If it is partly correct, name what is right and give one targeted nudge for what is missing. If it is unrelated to the question, follow the rule for unrelated replies. Do not reveal the full answer on the first unrelated or wrong reply.";

  return [
    target,
    "Judge the idea, not the wording or the spelling. Read through typos, shorthand, a missing capital, a wrong plural, or a one-word answer: a misspelled correct answer is a correct answer. Equivalent wording and valid examples count even when the study guide phrases it differently.",
    "For a multiple-choice question, a letter or the text of an option is an answer. For a true or false question, true, false, t, f, yes and no are answers.",
    "Rule for unrelated replies: if the reply has nothing to do with the question (a random word, a joke, food, a greeting, another subject), say so in one friendly sentence, do not grade it as a content mistake, do not praise it, restate the question in simpler words, and give one concrete hint from the excerpts. Never answer an unrelated reply by saying the materials do not cover it.",
    "If the learner is really asking you a question about the course instead of answering, answer it briefly from the excerpts and then return to the practice question.",
    mode,
    "Keep the response short and teacher-like: at most four short sentences. Cite the source with [n] when stating course content."
  ].join("\n\n");
}

/** Selects a numbered question when the learner names one; otherwise starts at #1. */
export function practicePromptForFollowup(message: string, prompts: string[]): string | null {
  if (!prompts.length) return null;
  const named = explicitQuestionNumber(message);
  if (named !== null && named >= 1 && named <= prompts.length) return prompts[named - 1];
  return prompts[0];
}

// ---------------------------------------------------------------------------
// 3b. Grounded generation with bounded top-up retries.
// ---------------------------------------------------------------------------

export type GenerateQuizQuestionsFn = typeof generateQuizQuestions;

const MAX_GENERATION_ATTEMPTS = 5;

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
      count: requestCount,
      avoidPrompts: [...prior, ...result.map((question) => question.prompt)].slice(-40)
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
    "Answer any of these and I'll check the idea, not whether your wording matches the study guide.",
    "If you're stuck, say “hint” or “I don't know.” I'll nudge you first, then show a model answer if you need it."
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
