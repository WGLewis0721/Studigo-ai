import {
  INSUFFICIENT_EVIDENCE_TEXT,
  streamGroundedAnswer,
  toCitations,
  type GroundedStreamEvent,
  type RetrievedChunk
} from "@studigo/ai";
import {
  buildPracticeQuestionSet,
  citationsForQuestions,
  classifyIntent,
  extractPriorPromptsFromHistory,
  formatQuestionsForChat,
  resolvePracticeTopic
} from "@/lib/recommendation-engine";
import { MATERIAL_NOTES } from "@/lib/fixture-materials";
import type { PracticeEvidence } from "@/lib/study-planning";
import type { Topic } from "@/lib/rooms";

/**
 * The local dev-only fixture room (`/dev/study`) has no Supabase-backed
 * documents, so there is nothing for pgvector retrieval to search. This
 * adapter builds real RetrievedChunk objects from the fixture's synthetic
 * study-guide notes and then hands off to the exact same recommendation
 * engine and @studigo/ai calls production uses — the only thing that
 * differs between fixture and production is where the chunks come from.
 * OPENAI_API_KEY is available in this environment, so fixture answers are
 * real, grounded model output, not canned strings.
 */
export type FixtureEngineRequest = {
  question: string;
  topics: Topic[];
  evidence?: PracticeEvidence[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  directives?: Array<{ name: string; instruction: string }>;
};

const FIXTURE_DOCUMENT_NAME = "2022–2023 Fifth Grade Science study guide.pdf";

function chunkForTopic(topic: Topic, index: number): RetrievedChunk | null {
  const note = MATERIAL_NOTES[topic.title];
  if (!note) return null;
  return {
    id: `fixture-${topic.id}`,
    documentId: "source",
    documentName: FIXTURE_DOCUMENT_NAME,
    content: `${topic.title}. ${note.summary} Example: ${note.example}`,
    similarity: 0.9,
    sourceType: "study_guide",
    pageNumber: index + 1,
    pageLabel: "Page",
    priority: topic.priority
  };
}

function chunksForTopics(topics: Topic[]): RetrievedChunk[] {
  return topics
    .map((topic, index) => chunkForTopic(topic, index))
    .filter((chunk): chunk is RetrievedChunk => chunk !== null);
}

export async function* runFixtureEngine(args: FixtureEngineRequest): AsyncGenerator<GroundedStreamEvent> {
  const intent = classifyIntent(args.question);
  const allChunks = chunksForTopics(args.topics);

  if (intent.type === "practice_questions") {
    yield* runFixturePracticeFlow(args, intent.count, allChunks);
    return;
  }

  const instructions = (args.directives ?? [])
    .map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`)
    .join("\n\n");

  yield* streamGroundedAnswer({
    question: args.question,
    instructions: instructions || undefined,
    chunks: allChunks,
    history: args.history
  });
}

async function* runFixturePracticeFlow(
  args: FixtureEngineRequest,
  count: number,
  allChunks: RetrievedChunk[]
): AsyncGenerator<GroundedStreamEvent> {
  const resolved = resolvePracticeTopic({
    message: args.question,
    topics: args.topics,
    evidence: args.evidence ?? []
  });

  const topicChunk = resolved ? chunkForTopic(resolved.topic, 0) : null;
  const chunks = topicChunk
    ? [topicChunk, ...allChunks.filter((chunk) => chunk.id !== topicChunk.id)].slice(0, 6)
    : allChunks;

  if (!resolved || !chunks.length) {
    yield { type: "delta", text: INSUFFICIENT_EVIDENCE_TEXT };
    yield { type: "done", answer: { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false } };
    return;
  }

  const priorPrompts = extractPriorPromptsFromHistory(args.history);
  const questions = await buildPracticeQuestionSet({
    chunks,
    topicTitle: resolved.topic.title,
    objective: resolved.topic.objective ?? undefined,
    count,
    priorPrompts
  });

  const available = toCitations(chunks);
  const citations = citationsForQuestions(questions, available);
  const text = formatQuestionsForChat({
    questions,
    topicTitle: resolved.topic.title,
    sourceLabel: FIXTURE_DOCUMENT_NAME
  });

  yield { type: "delta", text };
  yield { type: "done", answer: { text, citations, grounded: citations.length > 0 } };
}
