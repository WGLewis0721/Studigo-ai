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

/** Debug/telemetry shape for one Coach turn. Not persisted — logged only. */
export type CoachTurnLog = {
  stateBefore: CoachState["kind"];
  turnIntent: string;
  semanticScore: number | null;
  outcome: CoachOutcome | "new_question";
  stateAfter: CoachState["kind"];
};

async function loadCoachState(supabase: SupabaseClient, conversationId: string): Promise<CoachState> {
  const { data } = await supabase.from("conversations").select("coach_state").eq("id", conversationId).maybeSingle();
  return parseCoachState((data as { coach_state?: unknown } | null)?.coach_state);
}

async function saveCoachState(supabase: SupabaseClient, conversationId: string, state: CoachState): Promise<void> {
  await supabase.from("conversations").update({ coach_state: state }).eq("id", conversationId);
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
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  const { supabase, roomId, conversationId, question, topics } = args;
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
      const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic });
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
    const chunks = await fetchChunksByIds(supabase, roomId, state.sourceChunkIds);
    if (!chunks.length) {
      await saveCoachState(supabase, conversationId, IDLE_COACH_STATE);
      const text =
        "The material behind that question isn't available anymore, so I can't grade it fairly. Let's pick a fresh topic.";
      yield { type: "delta", text };
      yield { type: "done", answer: { text, citations: [], grounded: false } };
      return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
    }

    const evaluation = await evaluateCoachAnswer({
      question: state.question,
      expectedConcepts: state.expectedConcepts,
      learnerResponse: question,
      chunks
    });

    // The model's own intent read can override the deterministic pass for
    // things regex can't catch (off-topic content like "pizza").
    const effectiveIntent = intent === "answer" ? evaluation.intent : intent;
    const score = scoreConcepts(state.expectedConcepts, evaluation.concepts);
    const outcome = decideOutcome({
      intent: effectiveIntent,
      expectedConcepts: state.expectedConcepts,
      evaluated: evaluation.concepts,
      score
    });

    const feedback = await generateCoachFeedback({
      question: state.question,
      expectedConcepts: state.expectedConcepts,
      evaluated: evaluation.concepts,
      learnerResponse: question,
      outcome,
      chunks
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
  const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic });
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
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  if (!args.topic) {
    const text = "Add a study guide topic first — I need at least one active topic in this room before I can coach it.";
    yield { type: "delta", text };
    yield { type: "done", answer: { text, citations: [], grounded: false } };
    return { stateBefore: "idle", turnIntent: "answer", semanticScore: null, outcome: "irrelevant", stateAfter: "idle" };
  }

  const query = [args.topic.title, args.topic.objective, args.topic.key_terms.join(", ")].filter(Boolean).join(". ");
  const chunks: RetrievedChunk[] = await retrieveForRoom({
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

  const coachQuestion = await generateCoachQuestion({
    topicTitle: args.topic.title,
    objective: args.topic.objective,
    chunks
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
