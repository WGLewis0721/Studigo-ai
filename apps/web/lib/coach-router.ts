import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IDLE_COACH_STATE,
  SHOW_ANSWER_INSTRUCTIONS,
  answerFromRetrievedContext,
  assessLanguageFloor,
  citationsUsedIn,
  decideOutcome,
  detectTurnIntent,
  evaluateCoachAnswer,
  generateCoachFeedback,
  generateCoachQuestion,
  parseCoachState,
  renderCoachSupport,
  scoreConcepts,
  toCitations,
  type Citation,
  type CoachChallenge,
  type LanguageFloorReport,
  type LearningRoute,
  type CoachControlAction,
  type CoachOutcome,
  type CoachState,
  type RetrievedChunk,
  type GroundedStreamEvent
} from "@studigo/ai";
import { fetchChunksByIds, retrieveForRoom } from "@/lib/retrieval";
import type { Topic } from "@/lib/rooms";
import { temporaryCoachDirector, type CoachDirector } from "@/lib/coach-challenge-adapter";

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
 * Resolves the [n] markers actually present in Coach prose (a question or a
 * feedback message) to real Citation[] for the chunks it was generated
 * from. This reuses the same conversion Ask mode uses (`toCitations` +
 * `citationsUsedIn` from @studigo/ai/grounding) instead of inventing a
 * second citation representation for Coach: `toCitations(chunks)` assigns
 * marker `index + 1` to each chunk in the order it was presented to the
 * model — the exact order `buildContextBlock` used to build that prompt —
 * so a `[1]` in the text always resolves to chunk 0, in that same source
 * order, regardless of which subset the model actually cited.
 */
function citationsIn(text: string, chunks: RetrievedChunk[]): Citation[] {
  return citationsUsedIn(text, toCitations(chunks));
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
  /** Grounded RAG used to answer a learner's mid-answer clarification
   *  ("What does inherited mean?") from the room's own material, reusing the
   *  same cited-answer path Ask mode uses rather than a second grounding
   *  implementation. */
  answerFromRetrievedContext: typeof answerFromRetrievedContext;
  /** Renders "make it simpler" / "show me an example" support text. */
  renderCoachSupport: typeof renderCoachSupport;
  /** The learning-control plane. The Coach asks it for challenge specs and
   *  never decides progression itself. Temporary adapter until the real
   *  control plane lands (see coach-challenge-adapter.ts). */
  director: CoachDirector;
};

const defaultDeps: CoachRouterDeps = {
  retrieveForRoom,
  fetchChunksByIds,
  evaluateCoachAnswer,
  generateCoachQuestion,
  generateCoachFeedback,
  answerFromRetrievedContext,
  renderCoachSupport,
  director: temporaryCoachDirector
};

/** Debug/telemetry shape for one Coach turn. Not persisted — logged only. */
export type CoachTurnLog = {
  stateBefore: CoachState["kind"];
  turnIntent: string;
  semanticScore: number | null;
  outcome: CoachOutcome | "new_question" | "clarification" | "show_answer" | "simplified" | "example";
  stateAfter: CoachState["kind"];
  /** Deterministic language-floor metrics for the question Coach asked this turn. */
  languageFloor?: LanguageFloorReport;
};

/** The route is the learner's delivery preference, not progression, so the
 *  currently selected route always wins over the one stored with a spec. */
function withRoute(challenge: CoachChallenge, route: LearningRoute): CoachChallenge {
  return challenge.route === route ? challenge : { ...challenge, route };
}

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
  /** Selected learning route. Changes teaching, never correctness. */
  route?: LearningRoute;
  deps?: Partial<CoachRouterDeps>;
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  const { supabase, roomId, conversationId, question, topics } = args;
  const deps: CoachRouterDeps = { ...defaultDeps, ...args.deps };
  const pedagogyDirectives = formatPedagogyDirectives(args.directives);
  const state = await loadCoachState(supabase, conversationId);
  const intent = detectTurnIntent(question, state);
  const route: LearningRoute = args.route ?? "studigo_default";
  const specFor = async (topic: Topic, stored: CoachChallenge | undefined) =>
    withRoute(stored && stored.topicId === topic.id ? stored : await deps.director.initial(topic, route), route);

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
        // Pure conversational acknowledgement — no course fact is stated, so
        // this is never "grounded" no matter how it reads.
        yield { type: "done", answer: { text, citations: [], grounded: false } };
        return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
      }
      // affirm/next: replay the pending action as the effective question.
      const effectiveQuestion = CONTROL_ACTION_PROMPTS[state.action];
      const topic = topics.find((t) => t.id === state.topicId) ?? pickTopic(topics, effectiveQuestion);
      // "Another one" reuses the stored spec as-is: the Coach never
      // auto-advances. Only the control plane may change the target.
      const challenge = topic ? await specFor(topic, state.challenge) : undefined;
      const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic, deps, pedagogyDirectives, challenge });
      return { ...log, stateBefore: state.kind, turnIntent: intent };
    }
    // A genuinely new message while a control action is pending — most
    // likely the learner asking something else entirely. Fall through to
    // treat it as a fresh question rather than forcing the stale control
    // action on unrelated input.
  }

  // "Challenge me": an explicit learner request routed through the control
  // plane. The director decides the harder spec; the Coach only renders it.
  if (intent === "challenge" && state.kind !== "idle") {
    const topic = topics.find((t) => t.id === state.topicId) ?? pickTopic(topics, question);
    if (topic) {
      const challenge = withRoute(await deps.director.request(await specFor(topic, state.challenge), "harder"), route);
      const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic, deps, pedagogyDirectives, challenge });
      return { ...log, stateBefore: state.kind, turnIntent: intent };
    }
  }

  // 2. A pending question is being answered (or the learner is asking for
  //    help, the answer, or trying to move on).
  if (state.kind === "awaiting_answer") {
    if (intent === "conversation_control") {
      // "next" / "stop" while a question is pending: the learner wants out.
      await saveCoachState(supabase, conversationId, IDLE_COACH_STATE);
      const text = "Sure — let's move on. What would you like to work on?";
      yield { type: "delta", text };
      // Pure conversational acknowledgement — no course fact is stated.
      yield { type: "done", answer: { text, citations: [], grounded: false } };
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

    // The learner explicitly asked to be shown the answer ("show me the
    // answer"). This is deterministically classified by detectTurnIntent, so
    // it needs no semantic evaluation. Unlike a hint-only help_request — which
    // scaffolds a single nudge through generateCoachFeedback and deliberately
    // withholds the full answer — this returns a complete, source-grounded
    // model answer to the *pending* question, built from that question's own
    // source chunks (the ones just re-fetched by id above) rather than a fresh
    // retrieval keyed on the raw reply. The pending question is preserved and
    // re-persisted so the learner can still attempt it afterward.
    if (intent === "show_answer") {
      const grounded = await deps.answerFromRetrievedContext({
        question: state.question,
        chunks,
        instructions: [SHOW_ANSWER_INSTRUCTIONS, ...pedagogyDirectives].join("\n")
      });
      await saveCoachState(supabase, conversationId, state);
      yield { type: "delta", text: grounded.text };
      yield {
        type: "done",
        answer: { text: grounded.text, citations: grounded.citations, grounded: grounded.grounded }
      };
      return {
        stateBefore: state.kind,
        turnIntent: intent,
        semanticScore: null,
        outcome: "show_answer",
        stateAfter: "awaiting_answer"
      };
    }

    const pendingChallenge = state.challenge ? withRoute(state.challenge, route) : undefined;

    // "Make it simpler": same concepts, same sources, same reasoning task —
    // only the wording changes. Never graded.
    if (intent === "simplify") {
      const rendered = await deps.generateCoachQuestion({
        topicTitle: topics.find((t) => t.id === state.topicId)?.title ?? "",
        objective: pendingChallenge?.objective ?? null,
        chunks,
        pedagogyDirectives,
        challenge: pendingChallenge,
        simplifyFrom: { question: state.question, expectedConcepts: state.expectedConcepts }
      });
      const simpler = rendered.question || state.question;
      const nextState: CoachState = { ...state, question: simpler };
      await saveCoachState(supabase, conversationId, nextState);
      const citations = citationsIn(simpler, chunks);
      yield { type: "delta", text: simpler };
      yield { type: "done", answer: { text: simpler, citations, grounded: citations.length > 0 } };
      return {
        stateBefore: state.kind,
        turnIntent: intent,
        semanticScore: null,
        outcome: "simplified",
        stateAfter: "awaiting_answer",
        languageFloor: assessLanguageFloor(simpler)
      };
    }

    // "Show me an example": support text, then the same pending question.
    if (intent === "example") {
      const support = await deps.renderCoachSupport({
        support: "example",
        question: state.question,
        expectedConcepts: state.expectedConcepts,
        chunks,
        challenge: pendingChallenge,
        pedagogyDirectives
      });
      await saveCoachState(supabase, conversationId, state);
      const returnPrompt = `\n\nYour turn: ${state.question}`;
      const text = support + returnPrompt;
      const citations = citationsIn(text, chunks);
      yield { type: "delta", text: support };
      yield { type: "delta", text: returnPrompt };
      yield { type: "done", answer: { text, citations, grounded: citations.length > 0 } };
      return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "example", stateAfter: "awaiting_answer" };
    }

    // A deterministic help request ("I don't know", "hint") is not an answer
    // attempt, so it is not evaluated at all — it goes straight to one hint.
    const evaluation = intent === "help_request"
      ? { intent: "help_request" as const, concepts: [] }
      : await deps.evaluateCoachAnswer({
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

    // The learner asked their own genuine question instead of answering
    // ("What does inherited mean?"). Only the semantic evaluator can spot
    // this — the deterministic regex layer reads it as an answer attempt,
    // and we deliberately do not decide it from lexical overlap with the
    // question. It must not be graded as a wrong answer. Answer it from the
    // room's own material with a fresh retrieval, then explicitly hand the
    // pending question back so the learner is never quietly bumped off it.
    if (effectiveIntent === "clarification") {
      const clarificationChunks = await deps.retrieveForRoom({
        supabase,
        roomId,
        query: question,
        matchCount: 8
      });
      const grounded = await deps.answerFromRetrievedContext({
        question,
        chunks: clarificationChunks,
        instructions: pedagogyDirectives.length ? pedagogyDirectives.join("\n") : undefined
      });

      // The pending question is preserved unchanged and re-persisted, so the
      // next turn is still routed as an answer to it rather than reset.
      await saveCoachState(supabase, conversationId, state);

      const returnPrompt = `\n\nNow, back to the question: ${state.question}`;
      yield { type: "delta", text: grounded.text };
      yield { type: "delta", text: returnPrompt };
      const text = grounded.text + returnPrompt;
      yield {
        type: "done",
        answer: { text, citations: grounded.citations, grounded: grounded.grounded }
      };
      return {
        stateBefore: state.kind,
        turnIntent: effectiveIntent,
        semanticScore: null,
        outcome: "clarification",
        stateAfter: "awaiting_answer"
      };
    }

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
      pedagogyDirectives,
      challenge: pendingChallenge
    });

    yield { type: "delta", text: feedback };

    // Real citations: a [n] marker in the feedback prose resolves to the
    // citation for source chunk n (chunks are in the same order they were
    // presented to the model, so marker order == chunk order). Grounded is
    // never true unless the feedback actually cited a source chunk — this
    // is what stops "grounded: true" with zero citations for feedback that
    // is really just conversational (e.g. a bare "Nice, that's it!").
    const feedbackCitations = citationsIn(feedback, chunks);

    if (outcome === "correct") {
      const nextAction: CoachControlAction = "more_practice";
      const nextState: CoachState = {
        version: 1,
        kind: "awaiting_control",
        action: nextAction,
        topicId: state.topicId,
        sourceChunkIds: state.sourceChunkIds,
        ...(state.challenge ? { challenge: state.challenge } : {})
      };
      await saveCoachState(supabase, conversationId, nextState);
      const prompt = " Want another one on this?";
      yield { type: "delta", text: prompt };
      const text = feedback + prompt;
      yield {
        type: "done",
        answer: { text, citations: feedbackCitations, grounded: feedbackCitations.length > 0 }
      };
      return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_control" };
    }

    if (outcome === "incorrect" || outcome === "irrelevant" || outcome === "help") {
      // Stay on the same pending question — the learner gets another try
      // once they have the hint/correction, instead of silently moving on.
      yield {
        type: "done",
        answer: { text: feedback, citations: feedbackCitations, grounded: feedbackCitations.length > 0 }
      };
      return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_answer" };
    }

    // partial: keep the same pending question — the follow-up question
    // is already embedded in the feedback, pointed at the missing concept.
    yield {
      type: "done",
      answer: { text: feedback, citations: feedbackCitations, grounded: feedbackCitations.length > 0 }
    };
    return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_answer" };
  }

  // 3. Idle: open a new question on the topic the learner named (or the
  //    highest-priority one).
  const topic = pickTopic(topics, question);
  const challenge = topic ? await specFor(topic, undefined) : undefined;
  const log = yield* openCoachQuestion({ supabase, roomId, conversationId, topics, topic, deps, pedagogyDirectives, challenge });
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
  challenge?: CoachChallenge;
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
    pedagogyDirectives: args.pedagogyDirectives,
    challenge: args.challenge
  });

  const nextState: CoachState = {
    version: 1,
    kind: "awaiting_answer",
    question: coachQuestion.question,
    topicId: args.topic.id,
    expectedConcepts: coachQuestion.expectedConcepts,
    sourceChunkIds: coachQuestion.sourceChunkIds,
    askedAt: new Date().toISOString(),
    ...(args.challenge ? { challenge: args.challenge } : {})
  };
  await saveCoachState(args.supabase, args.conversationId, nextState);

  // Real citations: a [n] marker in the generated question resolves to the
  // chunk it actually references, in source order. A Socratic question that
  // is purely a prompt to explain ("Explain how X varies") legitimately
  // carries no citation — it is grounded in the topic's material without
  // stating a citable fact — so grounded correctly reads false in that case.
  const questionCitations = citationsIn(coachQuestion.question, chunks);

  yield { type: "delta", text: coachQuestion.question };
  yield {
    type: "done",
    answer: { text: coachQuestion.question, citations: questionCitations, grounded: questionCitations.length > 0 }
  };
  return {
    stateBefore: "idle",
    turnIntent: "answer",
    semanticScore: null,
    outcome: "new_question",
    stateAfter: "awaiting_answer",
    languageFloor: assessLanguageFloor(coachQuestion.question)
  };
}
