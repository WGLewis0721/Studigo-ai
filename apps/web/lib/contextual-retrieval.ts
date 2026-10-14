import type { RetrievedChunk } from "@studigo/ai";
import { LEARN_HELP_PROMPT } from "./coach-route-selection";

/** Server-validated lesson fields. Never taken from assistant text. */
export type LessonTopic = {
  id: string;
  title: string;
  objective: string | null;
  keyTerms: string[];
};

export type SearchTurn = { role: "user" | "assistant"; content: string };

export type SearchPlan =
  | { kind: "clarify"; message: string }
  | {
      kind: "search";
      query: string;
      topic: LessonTopic | null;
      /** The learner question whose words must be supported. Never assistant text. */
      substantive: string;
      termList: boolean;
    };

const QUERY_LIMIT = 480;
const HISTORY_USER_TURNS = 6;

const FOLLOW_UP = /^(help|please help|i need help|what|why|how|explain|explain this|explain that|more|go on|continue|and that|what about that|can you explain|can you explain that|what does that mean)\??$/i;

const QUESTION_WORDS = new Set([
  "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
  "does", "did", "define", "explain", "mean", "means", "help", "please", "this", "that"
]);

export function isShortFollowUp(question: string) {
  const trimmed = question.trim().toLowerCase();
  if (trimmed === LEARN_HELP_PROMPT.toLowerCase()) return true;
  return FOLLOW_UP.test(trimmed);
}

export function isTermListRequest(question: string) {
  return /\b(key terms|vocabulary|vocab words)\b/i.test(question);
}

function words(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3);
}

function mentionsTopic(text: string, topic: LessonTopic) {
  const haystack = text.toLowerCase();
  if (topic.title && haystack.includes(topic.title.toLowerCase())) return true;
  return topic.keyTerms.some((term) => term.trim().length > 2 && haystack.includes(term.toLowerCase()));
}

function namedTopics(topics: LessonTopic[], text: string) {
  return topics.filter((topic) => topic.title && text.toLowerCase().includes(topic.title.toLowerCase()));
}

function priorUserQuestions(history: SearchTurn[]) {
  return history.filter((turn) => turn.role === "user" && turn.content.trim()).slice(-HISTORY_USER_TURNS);
}

/** Latest learner question that is not itself a short follow-up. Assistant turns are ignored. */
export function latestSubstantiveUserQuestion(history: SearchTurn[]) {
  const users = priorUserQuestions(history);
  for (let index = users.length - 1; index >= 0; index -= 1) {
    const content = users[index].content.trim();
    if (!isShortFollowUp(content)) return content;
  }
  return null;
}

function resolveTopic(topics: LessonTopic[], question: string, history: SearchTurn[]) {
  const named = namedTopics(topics, question);
  if (named.length === 1) return named[0];
  if (topics.length === 1) return topics[0];
  const prior = latestSubstantiveUserQuestion(history);
  if (prior) {
    const fromPrior = namedTopics(topics, prior);
    if (fromPrior.length === 1) return fromPrior[0];
  }
  return null;
}

export function planContextualSearch(input: {
  topics: LessonTopic[];
  question: string;
  history?: SearchTurn[];
}): SearchPlan {
  const question = input.question.trim();
  const history = input.history ?? [];
  const followUp = isShortFollowUp(question);
  const topic = resolveTopic(input.topics, question, history);
  if (followUp && !topic) {
    return {
      kind: "clarify",
      message: "Which topic should I use? Choose one topic, then ask again."
    };
  }

  const prior = followUp ? latestSubstantiveUserQuestion(history) : null;
  const priorOnTopic = Boolean(prior && topic && mentionsTopic(prior, topic) && !namesOtherTopic(prior, topic, input.topics));
  const substantive = priorOnTopic && prior ? prior : question;
  const parts = [
    topic?.title,
    topic?.objective,
    topic ? topic.keyTerms.slice(0, 12).join(", ") : "",
    question,
    priorOnTopic ? prior : ""
  ].filter((part): part is string => Boolean(part && part.trim()));
  return {
    kind: "search",
    query: parts.join(". ").slice(0, QUERY_LIMIT),
    topic,
    substantive,
    termList: isTermListRequest(question)
  };
}

function namesOtherTopic(text: string, topic: LessonTopic, topics: LessonTopic[]) {
  return namedTopics(topics, text).some((named) => named.id !== topic.id);
}

function contentWords(text: string) {
  return words(text).filter((word) => !QUESTION_WORDS.has(word));
}

function termInChunk(term: string, chunk: string) {
  return chunk.toLowerCase().includes(term.toLowerCase());
}

function sentenceWith(chunk: string, term: string) {
  const sentences = chunk.split(/(?<=[.!?])\s+/);
  return sentences.find((sentence) => sentence.toLowerCase().includes(term.toLowerCase()))?.trim() || chunk.trim();
}

export type SupportedPassage = { chunk: RetrievedChunk; excerpt: string; term: string | null };

/**
 * Keep passages that actually contain the asked term or claim words.
 * Extra claim words that never appear in a passage abstain the question.
 */
export function passagesForLesson(input: {
  topic: LessonTopic | null;
  substantive: string;
  chunks: RetrievedChunk[];
  termList?: boolean;
}): SupportedPassage[] {
  if (input.termList && input.topic) {
    return input.topic.keyTerms.flatMap((term) => {
      const chunk = input.chunks.find((candidate) => termInChunk(term, candidate.content));
      return chunk ? [{ chunk, excerpt: sentenceWith(chunk.content, term), term }] : [];
    });
  }

  const topicWords = new Set(input.topic ? contentWords([input.topic.title, input.topic.objective ?? "", ...input.topic.keyTerms].join(" ")) : []);
  const claimWords = contentWords(input.substantive);
  const extra = claimWords.filter((word) => !topicWords.has(word));
  const namedTerm = input.topic?.keyTerms.find((term) => input.substantive.toLowerCase().includes(term.toLowerCase()))
    ?? input.topic?.keyTerms.find((term) => contentWords(term).every((word) => claimWords.includes(word)));

  const asking = /^(what|when|where|which|who|why|how|explain|define)\b/i.test(input.substantive.trim())
    || input.substantive.trim().endsWith("?");
  return input.chunks.flatMap((chunk) => {
    if (namedTerm && !termInChunk(namedTerm, chunk.content)) return [];
    if (!asking && extra.length && !extra.every((word) => words(chunk.content).includes(word))) return [];
    if (!namedTerm && extra.length === 0 && input.topic && !mentionsTopic(chunk.content, input.topic)) return [];
    if (!namedTerm && extra.length === 0 && !input.topic) return [{ chunk, excerpt: chunk.content.trim(), term: null }];
    return [{ chunk, excerpt: namedTerm ? sentenceWith(chunk.content, namedTerm) : chunk.content.trim(), term: namedTerm ?? null }];
  });
}
