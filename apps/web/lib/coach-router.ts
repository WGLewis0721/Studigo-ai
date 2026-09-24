import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IDLE_COACH_STATE,
  SHOW_ANSWER_INSTRUCTIONS,
  answerFromRetrievedContext,
  assessLanguageFloor,
  enforceLanguageFloor,
  rewriteCoachQuestion,
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
  type IssuedChallenge,
  type LanguageFloorEnforcement,
  type LanguageFloorReport,
  type CoachControlAction,
  type CoachOutcome,
  type CoachState,
  type RetrievedChunk,
  type GroundedStreamEvent
} from "@studigo/ai";
import { fetchChunksByIds, retrieveForRoom } from "@/lib/retrieval";
import type { Topic } from "@/lib/rooms";
import { randomUUID } from "node:crypto";
import { learningControlPlaneDirector, type CoachDirector } from "@/lib/coach-director";
import { parseIssuedSpec, renderChallengeGuidance, renderRouteGuidance } from "@/lib/coach-render";
import type { ChallengeRequest, ChallengeSpec, LearningEvent, LearningRoute } from "@/lib/learning";
import { learningEventStore, type CoachEvidenceStore } from "@/lib/coach-evidence-store";
import {
  buildCoachEvent,
  coachEventId,
  coachEventScope,
  type CoachEventPart,
  type CoachEventScope,
  type CoachInteraction
} from "@/lib/coach-learning-events";

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
  /** The single constrained rewrite `enforceLanguageFloor` may request. */
  rewriteCoachQuestion: typeof rewriteCoachQuestion;
  /** The learning-control plane. The Coach asks it for the next
   *  ChallengeSpec and renders it; it never decides progression. */
  director: CoachDirector;
  /** Where learning evidence is recorded (service role, after scope checks). */
  evidence: CoachEvidenceStore;
};

const defaultDeps: CoachRouterDeps = {
  retrieveForRoom,
  fetchChunksByIds,
  evaluateCoachAnswer,
  generateCoachQuestion,
  generateCoachFeedback,
  answerFromRetrievedContext,
  renderCoachSupport,
  rewriteCoachQuestion,
  director: learningControlPlaneDirector,
  evidence: learningEventStore
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
  /** What enforcement did: passed as generated, rewritten once, or kept. */
  languageFloorEnforcement?: LanguageFloorEnforcement;
};

/**
 * Help actually given on an encounter, on the SCAFFOLD_LADDER scale, keyed by
 * what the Coach DID this turn (from the effective, resolved intent/outcome,
 * never only the regex's first read). Only ever raised, never lowered, so a
 * later correct answer on the same encounter can never look independent.
 *  - simplify: reworded question (gentle prompt)
 *  - hint / clarification / irrelevant redirect: feedback that carries a clue
 *  - example: a concrete example
 *  - reveal / incorrect correction: the right idea was stated to the learner
 */
const SUPPORT_GIVEN = {
  simplify: 1,
  hint: 2,
  clarification: 2,
  irrelevant_redirect: 2,
  example: 3,
  correction: 5,
  reveal: 5
} as const;

/** Support implied by graded feedback; 0 when the feedback gives no help. */
function feedbackSupport(outcome: CoachOutcome): number {
  if (outcome === "help") return SUPPORT_GIVEN.hint;
  if (outcome === "irrelevant") return SUPPORT_GIVEN.irrelevant_redirect;
  if (outcome === "incorrect") return SUPPORT_GIVEN.correction;
  return 0;
}

/** Does this spec's task demand reasoning (vs. a short recognized/recalled fact)? */
function requiresReasoning(spec: ChallengeSpec | undefined): boolean {
  return !spec || (spec.challengeKind !== "recognize" && spec.challengeKind !== "recall");
}

function withSupport<T extends CoachState>(state: T, level: number): T {
  if (state.kind === "idle" || !state.issuedChallenge) return state;
  const used = state.issuedChallenge.scaffoldUsed;
  return { ...state, issuedChallenge: { ...state.issuedChallenge, scaffoldUsed: used === null ? null : Math.max(used, level) } };
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
  /** Authenticated learner; without it no ChallengeSpec can be requested. */
  userId?: string;
  /** The persisted user message for this submission (ID + server time).
   *  Required for learning evidence; without it nothing is recorded. */
  interaction?: CoachInteraction;
  deps?: Partial<CoachRouterDeps>;
}): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
  const { supabase, roomId, conversationId, question, topics, interaction } = args;
  const deps: CoachRouterDeps = { ...defaultDeps, ...args.deps };
  const pedagogyDirectives = formatPedagogyDirectives(args.directives);
  const state = await loadCoachState(supabase, conversationId);
  const intent = detectTurnIntent(question, state);
  const route: LearningRoute = args.route ?? "studigo_default";

  // A transport retry of a submission that was already fully processed:
  // nothing is re-graded or re-recorded.
  if (interaction && state.lastInteractionId === interaction.id) {
    const text = "I already have that one. Carry on whenever you're ready.";
    yield { type: "delta", text };
    yield { type: "done", answer: { text, citations: [], grounded: false } };
    return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: state.kind };
  }

  /** Every state write carries this submission's ID, and is retried once. A
   *  second failure surfaces as a retryable error; the learner's retry reuses
   *  the same interaction ID, so already-recorded evidence is idempotent. */
  const commit = async (next: CoachState): Promise<void> => {
    const stamped: CoachState = interaction ? { ...next, lastInteractionId: interaction.id } : next;
    try {
      await saveCoachState(supabase, conversationId, stamped);
    } catch {
      await saveCoachState(supabase, conversationId, stamped);
    }
  };

  /** Evidence scope for a pending encounter, verified against the
   *  authenticated learner, this room and the pending topic. Null when there
   *  is no issued challenge or no persisted interaction to record against. */
  const scopeOf = (s: CoachState): CoachEventScope | null => {
    if (s.kind === "idle" || !s.issuedChallenge || !args.userId || !interaction) return null;
    return coachEventScope({ issued: s.issuedChallenge, userId: args.userId, roomId, pendingTopicId: s.topicId });
  };
  const record = async (events: LearningEvent[]): Promise<void> => {
    for (const event of events) await deps.evidence.record(event);
  };
  const event = (
    scope: CoachEventScope,
    part: CoachEventPart,
    result: LearningEvent["result"],
    scaffoldUsed: number | null,
    offsetMs: number
  ) => buildCoachEvent({ scope, interaction: interaction!, part, result, scaffoldUsed, offsetMs });

  // Every new question asks the control plane for its ChallengeSpec. If that
  // read fails, the question is rendered without a target and nothing about
  // progression is claimed; the failure is never turned into an empty state.
  const issueFor = async (topic: Topic, challengeRequest: ChallengeRequest): Promise<IssuedChallenge | undefined> => {
    if (!args.userId) return undefined;
    try {
      const spec = await deps.director.challengeFor({ supabase, userId: args.userId, roomId, topic, route, challengeRequest });
      return {
        spec: spec as unknown as Record<string, unknown>,
        encounterId: randomUUID(),
        scaffoldUsed: spec.scaffoldLevel,
        contextId: spec.constraints.requireNewContext ? `coach-context:${randomUUID()}` : null
      };
    } catch (error) {
      console.warn("[coach] ChallengeSpec unavailable; rendering without a control-plane target", error);
      return undefined;
    }
  };

  /** An issued question left unanswered is recorded as skipped, never as
   *  success or failure. */
  const recordSkip = async (s: CoachState): Promise<void> => {
    const scope = scopeOf(s);
    if (scope && s.kind === "awaiting_answer") {
      await record([event(scope, "skip", "skipped", s.issuedChallenge?.scaffoldUsed ?? null, 0)]);
    }
  };

  // 1. A pending control action ("Want another one?" -> "yes") is executed
  //    directly. It never goes through retrieval or grading — the learner's
  //    reply here is a discourse move, not content.
  if (state.kind === "awaiting_control") {
    if (intent === "conversation_control") {
      const control = classifyAffirmOrDecline(question);
      if (control === "decline") {
        await commit(IDLE_COACH_STATE);
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
      // "Another one" asks the control plane again, at normal demand. The
      // director reloads persisted evidence, so it sees the answer just recorded.
      const issued = topic ? await issueFor(topic, "normal") : undefined;
      const log = yield* openCoachQuestion({ supabase, roomId, commit, topics, topic, deps, pedagogyDirectives, issued });
      return { ...log, stateBefore: state.kind, turnIntent: intent };
    }
    // A genuinely new message while a control action is pending — most
    // likely the learner asking something else entirely. Fall through to
    // treat it as a fresh question rather than forcing the stale control
    // action on unrelated input.
  }

  // "Challenge me": the ONLY request for a stretch. The director decides the
  // spec (a due rematch still wins); the Coach renders it unchanged and has no
  // difficulty ladder of its own. An unanswered pending question is recorded
  // as skipped first.
  if (intent === "challenge") {
    const topic = (state.kind !== "idle" ? topics.find((t) => t.id === state.topicId) : undefined) ?? pickTopic(topics, question);
    await recordSkip(state);
    const issued = topic ? await issueFor(topic, "stretch") : undefined;
    const log = yield* openCoachQuestion({ supabase, roomId, commit, topics, topic, deps, pedagogyDirectives, issued });
    return { ...log, stateBefore: state.kind, turnIntent: intent };
  }

  // 2. A pending question is being answered (or the learner is asking for
  //    help, the answer, or trying to move on).
  if (state.kind === "awaiting_answer") {
    // Verified before anything is generated or written; a mismatch fails closed.
    const scope = scopeOf(state);
    const scaffoldBefore = state.issuedChallenge?.scaffoldUsed ?? null;
    /** A support observation on this encounter, carrying the accumulated
     *  support after this turn's help (monotonic, same encounter). */
    const supportEvents = (result: "help" | "revealed", level: number, offsetMs: number): LearningEvent[] =>
      scope ? [event(scope, "support", result, withSupport(state, level).issuedChallenge?.scaffoldUsed ?? null, offsetMs)] : [];

    if (intent === "conversation_control") {
      // "next" / "stop" while a question is pending: the learner skipped it.
      await recordSkip(state);
      await commit(IDLE_COACH_STATE);
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
      await commit(IDLE_COACH_STATE);
      const text =
        "The material behind that question isn't available anymore, so I can't grade it fairly. Let's pick a fresh topic.";
      yield { type: "delta", text };
      yield { type: "done", answer: { text, citations: [], grounded: false } };
      return { stateBefore: state.kind, turnIntent: intent, semanticScore: null, outcome: "control", stateAfter: "idle" };
    }

    // "Show me the answer": a complete, source-grounded answer to the
    // *pending* question from its own re-fetched chunks, never a fresh
    // retrieval keyed on the raw reply. Reached from the deterministic intent
    // OR from the evaluator's resolved intent, and either way recorded as a
    // reveal on the same encounter BEFORE it is shown.
    const reveal = async function* (resolvedIntent: string): AsyncGenerator<GroundedStreamEvent, CoachTurnLog> {
      const grounded = await deps.answerFromRetrievedContext({
        question: state.question,
        chunks,
        instructions: [SHOW_ANSWER_INSTRUCTIONS, ...pedagogyDirectives].join("\n")
      });
      await record(supportEvents("revealed", SUPPORT_GIVEN.reveal, 0));
      await commit(withSupport(state, SUPPORT_GIVEN.reveal));
      yield { type: "delta", text: grounded.text };
      yield {
        type: "done",
        answer: { text: grounded.text, citations: grounded.citations, grounded: grounded.grounded }
      };
      return { stateBefore: state.kind, turnIntent: resolvedIntent, semanticScore: null, outcome: "show_answer", stateAfter: "awaiting_answer" };
    };
    if (intent === "show_answer") return yield* reveal(intent);

    // The pending question is always rendered against the spec it was issued for.
    const pendingSpec = parseIssuedSpec(state.issuedChallenge?.spec);
    const routeGuidance = pendingSpec ? renderRouteGuidance(pendingSpec) : undefined;

    // "Make it simpler": same concepts, same sources, same reasoning task —
    // only the wording changes. Never graded; recorded as help.
    if (intent === "simplify") {
      const rendered = await deps.generateCoachQuestion({
        topicTitle: topics.find((t) => t.id === state.topicId)?.title ?? "",
        objective: pendingSpec?.concept.objective ?? null,
        chunks,
        pedagogyDirectives,
        challengeGuidance: pendingSpec ? renderChallengeGuidance(pendingSpec) : undefined,
        simplifyFrom: { question: state.question, expectedConcepts: state.expectedConcepts }
      });
      const floor = await enforceLanguageFloor({
        question: rendered.question || state.question,
        requiresReasoning: requiresReasoning(pendingSpec),
        rewrite: (violations) =>
          deps.rewriteCoachQuestion({
            question: rendered.question || state.question,
            violations,
            expectedConcepts: state.expectedConcepts,
            chunks,
            challengeGuidance: pendingSpec ? renderChallengeGuidance(pendingSpec) : undefined
          })
      });
      const simpler = floor.question;
      await record(supportEvents("help", SUPPORT_GIVEN.simplify, 0));
      await commit(withSupport({ ...state, question: simpler }, SUPPORT_GIVEN.simplify));
      const citations = citationsIn(simpler, chunks);
      yield { type: "delta", text: simpler };
      yield { type: "done", answer: { text: simpler, citations, grounded: citations.length > 0 } };
      return {
        stateBefore: state.kind,
        turnIntent: intent,
        semanticScore: null,
        outcome: "simplified",
        stateAfter: "awaiting_answer",
        languageFloor: assessLanguageFloor(simpler),
        languageFloorEnforcement: floor.enforcement
      };
    }

    // "Show me an example": support text, then the same pending question.
    if (intent === "example") {
      const support = await deps.renderCoachSupport({
        support: "example",
        question: state.question,
        expectedConcepts: state.expectedConcepts,
        chunks,
        routeGuidance,
        pedagogyDirectives
      });
      await record(supportEvents("help", SUPPORT_GIVEN.example, 0));
      await commit(withSupport(state, SUPPORT_GIVEN.example));
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

    // A transport retry of an assessed answer keeps the result committed the
    // first time; re-grading could otherwise produce a conflicting event.
    const recorded = scope && intent !== "help_request"
      ? await deps.evidence.recordedResult(supabase, coachEventId(interaction!.id, "attempt"))
      : null;
    const recordedOutcome: CoachOutcome | null =
      recorded === "correct" || recorded === "partial" || recorded === "incorrect" ? recorded : null;

    // The model's own intent read can refine a deterministic "answer" into
    // irrelevant/help_request/show_answer for things regex can't catch (e.g.
    // off-topic content like "pizza"). It must never promote a reply into
    // "conversation_control" itself — only the deterministic state router
    // (detectTurnIntent, above) is authorized to trigger a control
    // transition. Without this guard, the model could invent a "yes"/"next"
    // reading of ordinary answer prose and silently skip grading.
    const effectiveIntent = recordedOutcome
      ? "answer"
      : intent === "answer" && evaluation.intent !== "conversation_control" ? evaluation.intent : intent;

    // The evaluator resolved an apparent answer into "show me the answer":
    // take the same reveal path so what is recorded matches what was given.
    if (effectiveIntent === "show_answer") return yield* reveal(effectiveIntent);

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

      // The pending question is preserved and re-persisted, so the next turn
      // is still routed as an answer to it. The answer to the learner's own
      // question is assistance on this encounter.
      await record(supportEvents("help", SUPPORT_GIVEN.clarification, 0));
      await commit(withSupport(state, SUPPORT_GIVEN.clarification));

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
    const outcome =
      recordedOutcome ??
      decideOutcome({
        intent: effectiveIntent,
        expectedConcepts: state.expectedConcepts,
        evaluated: evaluation.concepts,
        score
      });

    // Commit order for an assessed answer: the attempt is recorded with the
    // support that existed BEFORE this reply, and before any feedback exists.
    const assessed = outcome === "correct" || outcome === "partial" || outcome === "incorrect";
    if (scope && assessed) await record([event(scope, "attempt", outcome, scaffoldBefore, 0)]);

    const feedback = await deps.generateCoachFeedback({
      question: state.question,
      expectedConcepts: state.expectedConcepts,
      evaluated: evaluation.concepts,
      learnerResponse: question,
      outcome,
      chunks,
      pedagogyDirectives,
      routeGuidance
    });

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
        ...(state.issuedChallenge ? { issuedChallenge: state.issuedChallenge } : {})
      };
      await commit(nextState);
      const prompt = " Want another one on this?";
      yield { type: "delta", text: feedback };
      yield { type: "delta", text: prompt };
      const text = feedback + prompt;
      yield {
        type: "done",
        answer: { text, citations: feedbackCitations, grounded: feedbackCitations.length > 0 }
      };
      return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_control" };
    }

    // Help carried by the feedback (a clue, a redirect clue, or a stated
    // correction) is recorded on the SAME encounter, from the resolved
    // outcome, strictly after any attempt (base + 1 ms) and before it is shown.
    // An irrelevant reply is never an attempt: only its redirect clue is recorded.
    const support = feedbackSupport(outcome);
    if (support > 0) {
      await record(supportEvents(outcome === "incorrect" ? "revealed" : "help", support, assessed ? 1 : 0));
      await commit(withSupport(state, support));
    } else if (interaction) {
      await commit(state);
    }

    // Stay on the same pending question — the learner gets another try with
    // the hint/correction (or, for partial, the follow-up already embedded in
    // the feedback), instead of silently moving on.
    yield { type: "delta", text: feedback };
    yield {
      type: "done",
      answer: { text: feedback, citations: feedbackCitations, grounded: feedbackCitations.length > 0 }
    };
    return { stateBefore: state.kind, turnIntent: effectiveIntent, semanticScore: score, outcome, stateAfter: "awaiting_answer" };
  }

  // 3. Idle: open a new question on the topic the learner named (or the
  //    highest-priority one).
  const topic = pickTopic(topics, question);
  const issued = topic ? await issueFor(topic, "normal") : undefined;
  const log = yield* openCoachQuestion({ supabase, roomId, commit, topics, topic, deps, pedagogyDirectives, issued });
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
  commit: (state: CoachState) => Promise<void>;
  topics: Topic[];
  topic: Topic | undefined;
  deps: CoachRouterDeps;
  pedagogyDirectives?: string[];
  issued?: IssuedChallenge;
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

  const spec = parseIssuedSpec(args.issued?.spec);
  const coachQuestion = await args.deps.generateCoachQuestion({
    topicTitle: args.topic.title,
    objective: args.topic.objective,
    chunks,
    pedagogyDirectives: args.pedagogyDirectives,
    challengeGuidance: spec ? renderChallengeGuidance(spec) : undefined
  });

  // Enforce the language floor: at most one constrained rewrite. Concepts,
  // sources and the issued spec come from the original generation and are
  // never outputs of the rewrite.
  const floor = await enforceLanguageFloor({
    question: coachQuestion.question,
    requiresReasoning: requiresReasoning(spec),
    rewrite: (violations) =>
      args.deps.rewriteCoachQuestion({
        question: coachQuestion.question,
        violations,
        expectedConcepts: coachQuestion.expectedConcepts,
        chunks,
        challengeGuidance: spec ? renderChallengeGuidance(spec) : undefined
      })
  });
  const questionText = floor.question;

  const nextState: CoachState = {
    version: 1,
    kind: "awaiting_answer",
    question: questionText,
    topicId: args.topic.id,
    expectedConcepts: coachQuestion.expectedConcepts,
    sourceChunkIds: coachQuestion.sourceChunkIds,
    askedAt: new Date().toISOString(),
    ...(args.issued ? { issuedChallenge: args.issued } : {})
  };
  await args.commit(nextState);

  // Real citations: a [n] marker in the generated question resolves to the
  // chunk it actually references, in source order. A Socratic question that
  // is purely a prompt to explain ("Explain how X varies") legitimately
  // carries no citation — it is grounded in the topic's material without
  // stating a citable fact — so grounded correctly reads false in that case.
  const questionCitations = citationsIn(questionText, chunks);

  yield { type: "delta", text: questionText };
  yield {
    type: "done",
    answer: { text: questionText, citations: questionCitations, grounded: questionCitations.length > 0 }
  };
  return {
    stateBefore: "idle",
    turnIntent: "answer",
    semanticScore: null,
    outcome: "new_question",
    stateAfter: "awaiting_answer",
    languageFloor: assessLanguageFloor(questionText),
    languageFloorEnforcement: floor.enforcement
  };
}
