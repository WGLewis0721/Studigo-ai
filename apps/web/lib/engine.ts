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
  extractLatestPracticePromptsFromHistory,
  extractPriorPromptsFromHistory,
  formatQuestionsForChat,
  isPracticeHelpRequest,
  practicePromptForFollowup,
  resolvePracticeTopic
} from "@/lib/recommendation-engine";

export type EngineDirective = { name: string; instruction: string };

export type EngineRequest = {
  supabase: SupabaseClient;
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
  const [topics, evidence] = await Promise.all([
    fetchActiveTopics(args.supabase, args.roomId),
    fetchRecentEvidence(args.supabase, args.roomId)
  ]);

  // Coach mode is a stateful protocol (idle / awaiting_answer /
  // awaiting_control), not free-form Q&A, so it is routed to its own state
  // machine instead of the intent classifier below. It requires a
  // conversation to persist that state against.
  if (args.mode === "coach" && args.conversationId) {
    yield* runCoachTurn({
      supabase: args.supabase,
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

  // If the Coach's last substantive reply was a numbered practice set, a
  // short learner reply is most likely an answer to that practice, not a new
  // retrieval query. Ground the follow-up on the original question so an
  // irrelevant answer like "pizza" cannot send retrieval off-topic.
  const latestPracticePrompts = extractLatestPracticePromptsFromHistory(args.history);
  const conversationalOnly = /^(thanks|thank you|ok|okay|cool|got it|nevermind|never mind)[.!]?$/i.test(args.question.trim());
  const looksLikePracticeReply =
    latestPracticePrompts.length > 0 &&
    !conversationalOnly &&
    args.question.trim().length > 0 &&
    args.question.length <= 1000 &&
    !/[?]$/.test(args.question.trim());

  if (looksLikePracticeReply) {
    const practicePrompt = practicePromptForFollowup(args.question, latestPracticePrompts);
    if (practicePrompt) {
      yield* runPracticeFollowup({ ...args, practicePrompt });
      return;
    }
  }

  const learnerStateDirective = buildLearnerStateDirective(topics, evidence);

  const instructions = [...(args.directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`), learnerStateDirective]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query: args.question
  });

  yield* streamGroundedAnswer({
    question: args.question,
    instructions: instructions || undefined,
    chunks,
    history: args.history
  });
}

async function* runPracticeQuestionFlow(
  args: EngineRequest & { topics: Topic[]; evidence: PracticeEvidence[]; count: number }
): AsyncGenerator<GroundedStreamEvent> {
  const resolved = resolvePracticeTopic({ message: args.question, topics: args.topics, evidence: args.evidence });
  if (!resolved) {
    const text = "Add a study guide topic first — I need at least one active topic in this room before I can write practice questions.";
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
  args: EngineRequest & { practicePrompt: string }
): AsyncGenerator<GroundedStreamEvent> {
  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query: args.practicePrompt,
    matchCount: 10
  });

  if (!chunks.length) {
    yield { type: "delta", text: INSUFFICIENT_EVIDENCE_TEXT };
    yield { type: "done", answer: { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false } };
    return;
  }

  const wantsHelp = isPracticeHelpRequest(args.question);
  const wantsAnswer = /\b(show|tell|give)\s+(?:me\s+)?(?:the\s+)?answer\b/i.test(args.question);

  const tutorDirective = [
    `The learner is responding to this practice question: "${args.practicePrompt}"`,
    "Evaluate semantic understanding, not verbatim overlap with the study guide or a model answer. Equivalent wording and valid examples count.",
    "Distinguish four states: correct, partially correct, non-responsive/off-topic, and explicitly asking for help.",
    wantsAnswer
      ? "The learner explicitly asked for the answer. Give a concise source-grounded model answer, then one sentence explaining it."
      : wantsHelp
        ? "The learner is stuck. Do not mark them wrong. Rephrase the question more simply and give one concrete source-grounded hint. Do not reveal the full answer unless they ask for it."
        : "If correct, affirm it briefly and explain any terminology difference. If partially correct, name what is right and give one targeted nudge for what is missing. If non-responsive or off-topic, do not score it as ordinary content failure: redirect to the question, rephrase it more simply, and give one concrete hint. Do not reveal the full answer on the first off-topic response.",
    "Examples of the policy: for a question asking for three forms/states of water, an unrelated response such as 'pizza' gets a redirect plus a hint; a response that shows the right concept but incomplete or less precise terminology gets partial-credit coaching; semantically correct examples such as ice/liquid water/water vapor count even if the source phrases them differently.",
    "Keep the response short and teacher-like. Cite the source when stating course content."
  ].join(" ");

  const instructions = [
    ...(args.directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`),
    tutorDirective
  ].join("\n\n");

  yield* streamGroundedAnswer({
    question: `Practice question: ${args.practicePrompt}\nLearner response: ${args.question}`,
    instructions,
    chunks
  });
}

async function fetchActiveTopics(supabase: SupabaseClient, roomId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(TOPIC_COLUMNS)
    .eq("room_id", roomId)
    .eq("active", true)
    .order("order_index", { ascending: true });

  if (error) return [];
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
