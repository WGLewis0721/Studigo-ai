import { INSUFFICIENT_EVIDENCE_TEXT, streamGroundedAnswer, toCitations, type GroundedStreamEvent } from "@studigo/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveForRoom } from "@/lib/retrieval";
import { runCoachTurn } from "@/lib/coach-router";
import type { LearningRoute } from "@/lib/learning";
import type { CoachInteraction } from "@/lib/coach-learning-events";
import { rankWeakAreas, summarizeCalibration, type PracticeEvidence } from "@/lib/study-planning";
import { TOPIC_COLUMNS, type Topic } from "@/lib/rooms";
import {
  buildPracticeQuestionSet,
  citationsForQuestions,
  classifyIntent,
  buildPracticeTutorDirective,
  extractLatestPracticeSetFromHistory,
  extractPriorPromptsFromHistory,
  formatQuestionsForChat,
  isPracticeAnswerRequest,
  isPracticeHelpRequest,
  isPracticeReply,
  resolvePracticeQuestion,
  resolvePracticeTopic,
  type PracticeResolution,
  type PracticeSet
} from "@/lib/recommendation-engine";

import { formatDirectives, type EngineDirective } from "./directive-format";
export type { EngineDirective };

export type EngineRequest = {
  supabase: SupabaseClient;
  /** Server-only writer for trusted Coach state/message mutations. */
  serviceSupabase?: SupabaseClient;
  roomId: string;
  /** The learner's raw question. Never mixed with directives — this is the
   *  only text that gets embedded for retrieval, so pedagogy choices can never
   *  dilute the search that finds the source material. */
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** How to teach: coaching style, learning tradition, practice protocol.
   *  Chosen in the UI, applied only to the system prompt. */
  directives?: EngineDirective[];
  /** Selected learning route (Coach only). Shapes delivery, never grading. */
  route?: LearningRoute;
  /** "coach" routes the turn through the Coach state machine
   *  (packages/ai/src/coach.ts + lib/coach-router.ts) instead of free-form
   *  grounded Q&A. Requires `conversationId` — Coach state is persisted per
   *  conversation, not inferred from the message list each turn. */
  mode?: "ask" | "coach";
  conversationId?: string;
  /** Authenticated learner. Coach needs it to ask the learning-control plane
   *  for the next ChallengeSpec (the read itself stays RLS-scoped). */
  userId?: string;
  /** The persisted user message for a Coach turn (ID + server time). */
  interaction?: CoachInteraction;
  /** Learner-selected active-topic scope. The server intersects it with this room's active topics. */
  selectedTopicIds?: string[];
};

const EVIDENCE_WINDOW = 300;

/**
 * One entry point that fuses the two halves of Studigo into a single request:
 *
 *  1. Deterministic layer (classical CS, no model calls): recency-weighted
 *     mastery, weak-area ranking, and confidence calibration over the
 *     learner's actual attempt history. This is the "brain" that knows what
 *     the learner does and does not know.
 *  2. RAG layer (packages/ai): vector retrieval scoped to this room, then a
 *     grounded, cited generation constrained to only what was retrieved.
 *
 * The deterministic layer's output becomes one more coaching directive for
 * the generation step — it never touches the retrieval query and never
 * fabricates content on its own. Route handlers and UI call this instead of
 * composing retrieval + generation + analytics themselves.
 */
export async function* runStudigoEngine(args: EngineRequest): AsyncGenerator<GroundedStreamEvent> {
  const [roomTopics, evidence] = await Promise.all([
    fetchActiveTopics(args.supabase, args.roomId),
    fetchRecentEvidence(args.supabase, args.roomId)
  ]);
  const selected = new Set(args.selectedTopicIds ?? []);
  const topics = selected.size ? roomTopics.filter((topic) => selected.has(topic.id)) : roomTopics;
  if (selected.size && !topics.length) throw new Error("Your selected topics are no longer available. Pick a topic and try again.");

  // Coach mode is a stateful protocol (idle / awaiting_answer /
  // awaiting_control), not free-form Q&A, so it is routed to its own state
  // machine instead of the intent classifier below. It requires a
  // conversation to persist that state against.
  if (args.mode === "coach" && args.conversationId) {
    yield* runCoachTurn({
      supabase: args.supabase,
      stateSupabase: args.serviceSupabase,
      roomId: args.roomId,
      conversationId: args.conversationId,
      question: args.question,
      topics,
      directives: args.directives,
      route: args.route,
      userId: args.userId,
      interaction: args.interaction
    });
    return;
  }

  // A batch practice-question request ("give me 10 questions") is a
  // structurally different job than free-form Q&A: it needs a topic
  // decision, a fixed-count grounded generation call, and dedup against
  // whatever this learner has already been asked in this conversation.
  // Routing it through the recommendation engine instead of the generic
  // chat completion is what stops the model from self-narrating the
  // coaching directives or re-asking the same question.
  const intent = classifyIntent(args.question);
  if (intent.type === "practice_questions" && topics.length) {
    yield* runPracticeQuestionFlow({ ...args, topics, evidence, count: intent.count });
    return;
  }

  // If the Coach recently wrote a practice set, a short learner reply is most likely an answer to
  // it, not a new retrieval query. The reply does not have to name a question, use a number or
  // spell everything right: resolvePracticeQuestion decides which question it answers when it can,
  // and otherwise the model is shown the whole set. Grounding follows the questions, so an
  // unrelated answer like "pizza" cannot send retrieval off-topic.
  const practiceSet = extractLatestPracticeSetFromHistory(args.history);
  if (practiceSet && isPracticeReply(args.question)) {
    yield* runPracticeFollowup({
      ...args,
      practiceSet,
      resolution: resolvePracticeQuestion(args.question, practiceSet)
    });
    return;
  }

  const learnerStateDirective = buildLearnerStateDirective(topics, evidence);

  const instructions = formatDirectives(args.directives, [learnerStateDirective]);

  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query: args.question
  });

  yield* streamGroundedAnswer({
    question: args.question,
    instructions: instructions || undefined,
    format: "outline",
    chunks,
    history: args.history
  });
}

async function* runPracticeQuestionFlow(
  args: EngineRequest & { topics: Topic[]; evidence: PracticeEvidence[]; count: number }
): AsyncGenerator<GroundedStreamEvent> {
  const resolved = resolvePracticeTopic({ message: args.question, topics: args.topics, evidence: args.evidence });
  if (!resolved) {
    const text = "Add a study guide topic first. I need at least one active topic in this room before I can write practice questions.";
    yield { type: "delta", text };
    yield { type: "done", answer: { text, citations: [], grounded: false } };
    return;
  }

  const lowerMessage = args.question.toLowerCase();
  const namedTopic = args.topics.find(
    (topic) => topic.title && lowerMessage.includes(topic.title.toLowerCase())
  );

  // A generic "give me 10 questions" request should use enough of the room to
  // actually produce 10 useful questions. Previously it silently narrowed the
  // entire set to one weak topic, then dedup/validation often collapsed the
  // batch below the requested count.
  const ranked = rankWeakAreas(args.topics, args.evidence).map((area) => area.topic);
  const fallback = [...args.topics].sort(
    (a, b) => b.priority - a.priority || a.order_index - b.order_index || a.id.localeCompare(b.id)
  );
  const selectedTopics = namedTopic
    ? [namedTopic]
    : [...new Map([...ranked, ...fallback].map((topic) => [topic.id, topic])).values()].slice(
        0,
        Math.min(Math.max(3, Math.ceil(args.count / 2)), 6)
      );

  const query = selectedTopics
    .map((topic) => [topic.title, topic.objective, topic.key_terms.join(", ")].filter(Boolean).join(". "))
    .join("\n");

  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query,
    matchCount: Math.min(24, Math.max(12, args.count * 2))
  });

  if (!chunks.length) {
    yield { type: "delta", text: INSUFFICIENT_EVIDENCE_TEXT };
    yield { type: "done", answer: { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false } };
    return;
  }

  const priorPrompts = extractPriorPromptsFromHistory(args.history);
  const focusLabel = namedTopic
    ? namedTopic.title
    : selectedTopics.length > 1
      ? "your highest-priority study topics"
      : resolved.topic.title;
  const objective = namedTopic
    ? namedTopic.objective ?? undefined
    : selectedTopics
        .map((topic) => topic.objective)
        .filter((value): value is string => Boolean(value))
        .join(" ");

  const questions = await buildPracticeQuestionSet({
    chunks,
    topicTitle: namedTopic?.title,
    objective,
    count: args.count,
    priorPrompts
  });

  const available = toCitations(chunks);
  const citations = citationsForQuestions(questions, available);
  const text = formatQuestionsForChat({
    questions,
    topicTitle: focusLabel,
    sourceLabel: namedTopic ? chunks[0]?.documentName ?? "your materials" : "your Study Room materials"
  });

  yield { type: "delta", text };
  yield { type: "done", answer: { text, citations, grounded: citations.length > 0 } };
}

async function* runPracticeFollowup(
  args: EngineRequest & { practiceSet: PracticeSet; resolution: PracticeResolution }
): AsyncGenerator<GroundedStreamEvent> {
  const { practiceSet, resolution } = args;
  const decided = resolution.by === "number" || resolution.by === "only";
  const decidedPrompt = resolution.index !== null ? practiceSet.prompts[resolution.index] : null;

  // Ground on the question the learner named. When it is a guess or unknown, ground on every
  // question in the set (a guess first), so whichever one the model settles on has its source.
  const query = decided && decidedPrompt
    ? decidedPrompt
    : [decidedPrompt, ...practiceSet.prompts.filter((prompt) => prompt !== decidedPrompt)]
        .filter((prompt): prompt is string => Boolean(prompt))
        .join("\n")
        .slice(0, 1500);

  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query,
    matchCount: decided ? 10 : 12
  });

  if (!chunks.length) {
    yield { type: "delta", text: INSUFFICIENT_EVIDENCE_TEXT };
    yield { type: "done", answer: { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false } };
    return;
  }

  const tutorDirective = buildPracticeTutorDirective({
    set: practiceSet,
    resolution,
    wantsHelp: isPracticeHelpRequest(args.question),
    wantsAnswer: isPracticeAnswerRequest(args.question)
  });

  const instructions = [
    ...(args.directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`),
    tutorDirective
  ].join("\n\n");

  yield* streamGroundedAnswer({
    question:
      decided && decidedPrompt
        ? `Practice question: ${decidedPrompt}\nLearner response: ${args.question}`
        : `Learner response to one of the practice questions: ${args.question}`,
    instructions,
    chunks,
    // The conversation is only needed to tell which question an unnamed reply is about.
    history: decided ? undefined : args.history
  });
}

async function fetchActiveTopics(supabase: SupabaseClient, roomId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(TOPIC_COLUMNS)
    .eq("room_id", roomId)
    .eq("active", true)
    .order("order_index", { ascending: true });

  if (error) throw new Error('Could not load the current study scope. Please retry.');
  return (data ?? []) as Topic[];
}

async function fetchRecentEvidence(supabase: SupabaseClient, roomId: string): Promise<PracticeEvidence[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("topic_id, source, score, is_correct, created_at, confidence")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(EVIDENCE_WINDOW);

  if (error) return [];
  return (data ?? []) as PracticeEvidence[];
}

/**
 * Turns the deterministic mastery/weak-area/calibration signal into a short,
 * factual directive for the model. It names topics and priorities the
 * learner's own attempt history already earned — the model is told to use
 * this as a coaching priority, never to present it as a source fact.
 */
function buildLearnerStateDirective(topics: Topic[], evidence: PracticeEvidence[]): string | null {
  if (!topics.length) return null;

  const weakAreas = rankWeakAreas(topics, evidence).slice(0, 3);
  const calibration = summarizeCalibration(evidence);

  const lines: string[] = [];
  if (weakAreas.length) {
    lines.push(
      `Learner priority (from this learner's actual practice history, not a fact to cite): ${weakAreas
        .map((area) => `${area.topic.title} (${area.label.toLowerCase()}${area.reasons[0] ? ` — ${area.reasons[0]}` : ""})`)
        .join("; ")}.`
    );
  }
  if (calibration.label !== "Not enough data") {
    lines.push(`Confidence calibration: ${calibration.label.toLowerCase()}. ${calibration.summary}`);
  }
  if (!lines.length) return null;

  return `[LEARNER STATE] ${lines.join(" ")} Use this only to decide what to practice next and how much to scaffold — never state it as course content.`;
}
