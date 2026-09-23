import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IDLE_COACH_STATE,
  decideOutcome,
  detectTurnIntent,
  evaluateCoachAnswer,
  generateCoachFeedback,
  generateCoachQuestion,
  parseCoachState,
  scoreConcepts,
  type CoachControlAction,
  type CoachOutcome,
  type CoachState,
  type RetrievedChunk,
  type GroundedStreamEvent
} from "@studigo/ai";
import { fetchChunksByIds, retrieveForRoom } from "@/lib/retrieval";
import type { Topic } from "@/lib/rooms";

const CONTROL_ACTION_PROMPTS: Record<CoachControlAction, string> = {
  more_practice: "Give me another practice question on this.",
  next_question: "Move on to the next question.",
  explain_again: "Explain that again."
};

/** Local mirror of engine.ts's EngineDirective — deliberately not imported
 *  from @/lib/engine to avoid a circular import (engine.ts imports this
 *  module). Same shape: a named teaching-style/tradition choice from the UI,
 *  sanitized before it ever reaches a system prompt. */
type PedagogyDirective = { name: string; instruction: string };

/** Formats directives exactly like engine.ts does for Ask mode, so Coach and
 *  Ask read identically to the model. Phrasing-only — see coach.ts. */
function formatPedagogyDirectives(directives: PedagogyDirective[] | undefined): string[] {
  return (directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`);
}

/**
 * The model/retrieval calls `runCoachTurn` makes, gathered into one
 * injectable surface. Defaults are the real `@studigo/ai` and
 * `@/lib/retrieval` implementations; tests override individual entries
 * (e.g. a fake `evaluateCoachAnswer`, or a `retrieveForRoom` spy) so the
 * deterministic state-machine behavior can be verified without calling
 * out to a model, and so tests can assert *which* calls happened — e.g.
 * that answering a pending question never re-retrieves using the raw
 * learner reply.
 */
type CoachRouterDeps = {
  retrieveForRoom: typeof retrieveForRoom;
  fetchChunksByIds: typeof fetchChunksByIds;
  evaluateCoachAnswer: typeof evaluateCoachAnswer;
  generateCoachQuestion: typeof generateCoachQuestion;
  generateCoachFeedback: typeof generateCoachFeedback;
};

const defaultDeps: CoachRouterDeps = {
  retrieveForRoom,
  fetchChunksByIds,
  evaluateCoachAnswer,
  generateCoachQuestion,
  generateCoachFeedback
};

/** Debug/telemetry shape for one Coach turn. Not persisted — logged only. */
export type CoachTurnLog = {
  stateBefore: CoachState["kind"];
  turnIntent: string;
  semanticScore: number | null;
  outcome: CoachOutcome | "new_question";
  stateAfter: CoachState["kind"];
};

/**
 * A Supabase read/write failure here means the Coach protocol can no longer
 * trust what "state" the conversation is in — silently falling back to
 * `IDLE_COACH_STATE` would let the model grade an answer against the wrong
 * question, or lose a pending question without the learner ever knowing
 * why. Throwing surfaces the failure as a controlled "error" SSE event
 * (via the try/catch in the chat route) instead of a silent state reset.
 */
async function loadCoachState(supabase: SupabaseClient, conversationId: string): Promise<CoachState> {
  const { data, error } = await supabase
    .from("conversations")
    .select("coach_state")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load Coach state for conversation ${conversationId}: ${error.message}`);
  }
  return parseCoachState((data as { coach_state?: unknown } | null)?.coach_state);
}

async function saveCoachState(supabase: SupabaseClient, conversationId: string, state: CoachState): Promise<void> {
  const { error } = await supabase.from("conversations").update({ coach_state: state }).eq("id", conversationId);
  if (error) {
    throw new Error(`Could not save Coach state for conversation ${conversationId}: ${error.message}`);
  }
}

function pickTopic(topics: Topic[], question: string): Topic | undefined {
  const lower = question.toLowerCase();
  return (
    topics.find((topic) => topic.title && lower.includes(topic.title.toLowerCase())) ??
    [...topics].sort((a, b) => b.priority - a.priority || a.order_index - b.order_index)[0]
  );
}

/**
 * Runs one turn of the Coach protocol. This is the state machine described
 * in the Coach spec: deterministic conversation-control detection first,
 * then — depending on `coach_state` — either grade the pending question,
 * execute a pending control action, or open a new question. It always
 * ends by persisting the resulting `coach_state`, so the next turn is
 * routed against a durable record rather than re-inferred from prose.
 */
export async function* runCoachTurn(args: {
  supabase: SupabaseClient;
  roomId: string;
  conversationId: string;
  question: string;
  topics: Topic[];
  /** Sanitized teaching-style/tradition directives from the UI, same as
   *  Ask mode's EngineDirective[]. Only affects how Coach phrases questions
   *  and feedback — never the deterministic score, outcome, or source
   *  truth (see coach.ts generateCoachQuestion/generateCoachFeedback). */
  directives?: PedagogyDirective[];
  deps?: Partial<CoachRouterDeps>;
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  const { supabase, roomId, conversationId, question, topics } = args;
  const deps: CoachRouterDeps = { ...defaultDeps, ...args.deps };
  const pedagogyDirectives = formatPedagogyDirectives(args.directives);
  const state = await loadCoachState(supabase, conversationId);
  const intent = detectTurnIntent(question, state);

  // 1. A pending control action ("Want another one?" -> "yes") is executed
  //    directly. It never goes through retrieval or grading — the learner's
  //    reply here is a discourse move, not content.
  if (state.kind === "awaiting_control") {
    if (intent === "conversation_control") {
      const control = classifyAffirmOrDecline(question);
      if (control === "decline") {
        await saveCoachState(supabase, conversationId, IDLE_COACH_STATE);
        const text = "No problem — say the word whenever you want to pick this back up.";
        yield { type: "delta", text };
        yield { type: "done", answer: { text, citations: [], grounded: true } };
        return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
      }
      // affirm/next: replay the pending action as the effective question.
      const effectiveQuestion = CONTROL_ACTION_PROMPTS[state.action];
      const topic = topics.find((t) => t.id === state.topicId) ?? pickTopic(topics, effectiveQuestion);
      const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic, deps, pedagogyDirectives });
      return { ...log, stateBefore: state.kind, turnIntent: intent };
    }
    // A genuinely new message while a control action is pending — most
    // likely the learner asking something else entirely. Fall through to
    // treat it as a fresh question rather than forcing the stale control
    // action on unrelated input.
  }

  // 2. A pending question is being answered (or the learner is asking for
  //    help, the answer, or trying to move on).
  if (state.kind === "awaiting_answer") {
    if (intent === "conversation_control") {
      // "next" / "stop" while a question is pending: the learner wants out.
      await saveCoachState(supabase, conversationId, IDLE_COACH_STATE);
      const text = "Sure — let's move on. What would you like to work on?";
      yield { type: "delta", text };
      yield { type: "done", answer: { text, citations: [], grounded: true } };
      return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
    }

    // Re-fetch the question's source chunks under this request's RLS
    // boundary rather than trusting the cached copy from when it was asked.
    // A partial result (some chunk ids no longer resolve) is treated the
    // same as a total loss: grading against a subset of the original
    // material isn't fair to the learner, since the question may reference
    // a concept that lived in exactly the chunk that's now missing.
    const chunks = await deps.fetchChunksByIds(supabase, roomId, state.sourceChunkIds);
    if (chunks.length < state.sourceChunkIds.length) {
      await saveCoachState(supabase, conversationId, IDLE_COACH_STATE);
      const text =
        "The material behind that question isn't available anymore, so I can't grade it fairly. Let's pick a fresh topic.";
      yield { type: "delta", text };
      yield { type: "done", answer: { text, citations: [], grounded: false } };
      return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
    }

    const evaluation = await deps.evaluateCoachAnswer({
      question: state.question,
      expectedConcepts: state.expectedConcepts,
      learnerResponse: question,
      chunks
    });

    // The model's own intent read can refine a deterministic "answer" into
    // irrelevant/help_request/show_answer for things regex can't catch (e.g.
    // off-topic content like "pizza"). It must never promote a reply into
    // "conversation_control" itself — only the deterministic state router
    // (detectTurnIntent, above) is authorized to trigger a control
    // transition. Without this guard, the model could invent a "yes"/"next"
    // reading of ordinary answer prose and silently skip grading.
    const effectiveIntent =
      intent === "answer" && evaluation.intent !== "conversation_control" ? evaluation.intent : intent;
    const score = scoreConcepts(state.expectedConcepts, evaluation.concepts);
    const outcome = decideOutcome({
      intent: effectiveIntent,
      expectedConcepts: state.expectedConcepts,
      evaluated: evaluation.concepts,
      score
    });

    const feedback = await deps.generateCoachFeedback({
      question: state.question,
      expectedConcepts: state.expectedConcepts,
      evaluated: evaluation.concepts,
      learnerResponse: question,
      outcome,
      chunks,
      pedagogyDirectives
    });

    yield { type: "delta", text: feedback };

    if (outcome === "correct") {
      const nextAction: CoachControlAction = "more_practice";
      const nextState: CoachState = {
        version: 1,
        kind: "awaiting_control",
        action: nextAction,
        topicId: state.topicId,
        sourceChunkIds: state.sourceChunkIds
      };
      await saveCoachState(supabase, conversationId, nextState);
      const prompt = " Want another one on this?";
      yield { type: "delta", text: prompt };
      const text = feedback + prompt;
      yield { type: "done", answer: { text, citations: [], grounded: true } };
      return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_control" };
    }

    if (outcome === "incorrect" || outcome === "irrelevant" || outcome === "help") {
      // Stay on the same pending question — the learner gets another try
      // once they have the hint/correction, instead of silently moving on.
      yield { type: "done", answer: { text: feedback, citations: [], grounded: true } };
      return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_answer" };
    }

    // partial: keep the same pending question — the follow-up question
    // is already embedded in the feedback, pointed at the missing concept.
    yield { type: "done", answer: { text: feedback, citations: [], grounded: true } };
    return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_answer" };
  }

  // 3. Idle: open a new question on the topic the learner named (or the
  //    highest-priority one).
  const topic = pickTopic(topics, question);
  const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic, deps, pedagogyDirectives });
  return { ...log, stateBefore: state.kind, turnIntent: intent };
}

function classifyAffirmOrDecline(text: string): "affirm" | "decline" {
  return /^(no|nope|nah|not\s+now|stop|that'?s\s+all|i'?m\s+done|no\s+thanks)[.!]?$/i.test(text.trim())
    ? "decline"
    : "affirm";
}

async function* openCoachQuestion(args: {
  supabase: SupabaseClient;
  roomId: string;
  conversationId: string;
  topics: Topic[];
  topic: Topic | undefined;
  deps: CoachRouterDeps;
  pedagogyDirectives?: string[];
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  if (!args.topic) {
    const text = "Add a study guide topic first — I need at least one active topic in this room before I can coach it.";
    yield { type: "delta", text };
    yield { type: "done", answer: { text, citations: [], grounded: false } };
    return { stateBefore: "idle", turnIntent: "answer", semanticScore: null, outcome: "irrelevant", stateAfter: "idle" };
  }

  const query = [args.topic.title, args.topic.objective, args.topic.key_terms.join(", ")].filter(Boolean).join(". ");
  const chunks: RetrievedChunk[] = await args.deps.retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query,
    matchCount: 10
  });

  if (!chunks.length) {
    const text = `There isn't enough processed material on "${args.topic.title}" yet. Add the source that covers it and ask me again.`;
    yield { type: "delta", text };
    yield { type: "done", answer: { text, citations: [], grounded: false } };
    return { stateBefore: "idle", turnIntent: "answer", semanticScore: null, outcome: "irrelevant", stateAfter: "idle" };
  }

  const coachQuestion = await args.deps.generateCoachQuestion({
    topicTitle: args.topic.title,
    objective: args.topic.objective,
    chunks,
    pedagogyDirectives: args.pedagogyDirectives
  });

  const nextState: CoachState = {
    version: 1,
    kind: "awaiting_answer",
    question: coachQuestion.question,
    topicId: args.topic.id,
    expectedConcepts: coachQuestion.expectedConcepts,
    sourceChunkIds: coachQuestion.sourceChunkIds,
    askedAt: new Date().toISOString()
  };
  await saveCoachState(args.supabase, args.conversationId, nextState);

  yield { type: "delta", text: coachQuestion.question };
  yield { type: "done", answer: { text: coachQuestion.question, citations: [], grounded: true } };
  return { stateBefore: "idle", turnIntent: "answer", semanticScore: null, outcome: "new_question", stateAfter: "awaiting_answer" };
}
