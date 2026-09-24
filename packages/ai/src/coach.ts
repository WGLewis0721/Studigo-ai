import { UNTRUSTED_MATERIAL_RULE, asUntrustedMaterial } from "./client";
import { structured } from "./study";
import { buildContextBlock, type RetrievedChunk } from "./grounding";
import { LANGUAGE_FLOOR_RULES } from "./coach-language";

// ---------------------------------------------------------------------------
// Coach finite-state machine
//
// Coach is a stateful protocol, not free-form chat. `coach_state` is the
// machine-readable record of what Coach is waiting for. It is persisted on
// the conversation row (see supabase/migrations/*_coach_state.sql) so a
// learner's next message is interpreted against the pending question or
// pending control action instead of being re-scraped from prose.
// ---------------------------------------------------------------------------

export type ExpectedConcept = {
  id: string;
  description: string;
  /** Normalized so that the weights of one question's concepts sum to 1. */
  weight: number;
  /** A contradicted critical concept can never be marked correct. */
  critical: boolean;
};

export const COACH_CONTROL_ACTIONS = ["more_practice", "next_question", "explain_again"] as const;
export type CoachControlAction = (typeof COACH_CONTROL_ACTIONS)[number];

/** `lastInteractionId`: the learner submission whose processing produced this
 *  state. A transport retry of that same submission is then recognized as
 *  already complete instead of being graded twice. */
export type CoachState =
  | { version: 1; kind: "idle"; lastInteractionId?: string }
  | {
      version: 1;
      kind: "awaiting_answer";
      question: string;
      topicId: string | null;
      expectedConcepts: ExpectedConcept[];
      sourceChunkIds: string[];
      askedAt: string;
      /** Optional: rows written before this field existed stay valid. */
      issuedChallenge?: IssuedChallenge;
      lastInteractionId?: string;
    }
  | {
      version: 1;
      kind: "awaiting_control";
      action: CoachControlAction;
      topicId: string | null;
      sourceChunkIds: string[];
      issuedChallenge?: IssuedChallenge;
      lastInteractionId?: string;
    };

/**
 * The control-plane challenge a pending question was issued for. The spec is
 * opaque to this package: it is the learning-control plane's ChallengeSpec
 * (apps/web/lib/learning), validated and interpreted only in apps/web.
 * `encounterId` is stable across hints and reveals of the SAME question;
 * `scaffoldUsed` is the most support the learner actually received on it.
 */
export type IssuedChallenge = {
  spec: Record<string, unknown>;
  encounterId: string;
  scaffoldUsed: number | null;
  /** Stable context identity, set when the spec required a new context. */
  contextId: string | null;
};

export const IDLE_COACH_STATE: CoachState = { version: 1, kind: "idle" };

/** Defensive parse: any shape that does not match a known variant collapses to idle. */
export function parseCoachState(raw: unknown): CoachState {
  if (!raw || typeof raw !== "object") return IDLE_COACH_STATE;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return IDLE_COACH_STATE;
  const lastInteractionId = typeof value.lastInteractionId === "string" && value.lastInteractionId ? value.lastInteractionId : undefined;
  const stamp = lastInteractionId ? { lastInteractionId } : {};

  if (
    value.kind === "awaiting_answer" &&
    typeof value.question === "string" &&
    Array.isArray(value.expectedConcepts) &&
    Array.isArray(value.sourceChunkIds) &&
    typeof value.askedAt === "string"
  ) {
    const issuedChallenge = parseIssuedChallenge(value.issuedChallenge);
    return {
      version: 1,
      kind: "awaiting_answer",
      question: value.question,
      topicId: typeof value.topicId === "string" ? value.topicId : null,
      expectedConcepts: (value.expectedConcepts as unknown[]).filter(isExpectedConcept),
      sourceChunkIds: (value.sourceChunkIds as unknown[]).filter((id): id is string => typeof id === "string"),
      askedAt: value.askedAt,
      ...(issuedChallenge ? { issuedChallenge } : {}),
      ...stamp
    };
  }

  if (
    value.kind === "awaiting_control" &&
    typeof value.action === "string" &&
    (COACH_CONTROL_ACTIONS as readonly string[]).includes(value.action) &&
    Array.isArray(value.sourceChunkIds)
  ) {
    const issuedChallenge = parseIssuedChallenge(value.issuedChallenge);
    return {
      version: 1,
      kind: "awaiting_control",
      action: value.action as CoachControlAction,
      topicId: typeof value.topicId === "string" ? value.topicId : null,
      sourceChunkIds: (value.sourceChunkIds as unknown[]).filter((id): id is string => typeof id === "string"),
      ...(issuedChallenge ? { issuedChallenge } : {}),
      ...stamp
    };
  }

  if (value.kind === "idle" && lastInteractionId) return { version: 1, kind: "idle", lastInteractionId };
  return IDLE_COACH_STATE;
}

function parseIssuedChallenge(raw: unknown): IssuedChallenge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const scaffold = value.scaffoldUsed;
  if (
    !value.spec ||
    typeof value.spec !== "object" ||
    Array.isArray(value.spec) ||
    typeof value.encounterId !== "string" ||
    !value.encounterId ||
    !(scaffold === null || (Number.isInteger(scaffold) && (scaffold as number) >= 0 && (scaffold as number) <= 5)) ||
    !(value.contextId === undefined || value.contextId === null || (typeof value.contextId === "string" && value.contextId))
  ) {
    return undefined;
  }
  return {
    spec: value.spec as Record<string, unknown>,
    encounterId: value.encounterId,
    scaffoldUsed: scaffold as number | null,
    contextId: typeof value.contextId === "string" ? value.contextId : null
  };
}

function isExpectedConcept(value: unknown): value is ExpectedConcept {
  if (!value || typeof value !== "object") return false;
  const concept = value as Record<string, unknown>;
  return typeof concept.id === "string" && typeof concept.description === "string" && typeof concept.weight === "number";
}

// ---------------------------------------------------------------------------
// Deterministic conversation-control detection — runs before any retrieval
// or model call. No global regex reinterprets every short sentence: these
// patterns match only the small, closed set of discourse moves the machine
// actually needs to route (invariant from the spec, section 7).
// ---------------------------------------------------------------------------

export type TurnIntent =
  | "answer"
  | "irrelevant"
  | "help_request"
  | "show_answer"
  | "conversation_control"
  // The learner asked their own genuine question while a Coach question was
  // pending ("What does inherited mean?"). This is neither an answer attempt
  // nor a discourse move — it must be answered from the material and then the
  // pending question restored, never graded as a wrong answer. Only the
  // semantic evaluator can recognize it; the deterministic regex layer
  // (detectTurnIntent) cannot, and lexical similarity to the question is
  // deliberately not used as the signal.
  | "clarification"
  // Learner-facing Coach controls. Deterministic, never graded as answers.
  | "simplify"
  | "example"
  | "challenge";

const AFFIRM_PATTERN = /^(yes|yeah|yep|yup|sure|ok|okay|please|go\s*ahead|sounds\s+good|let'?s\s+go)[.!]?$/i;
const DECLINE_PATTERN = /^(no|nope|nah|not\s+now|no\s+thanks)[.!]?$/i;
const NEXT_PATTERN = /^(next|another|another\s+one|more|keep\s+going|continue)[.!]?$/i;
// "Exit" words always mean the learner wants out of whatever is pending,
// unlike a plain "no" which may legitimately be answering a yes/no question.
const EXIT_PATTERN = /^(stop|that'?s\s+all|i'?m\s+done)[.!]?$/i;
const HELP_PATTERN = /\b(i\s+(?:do\s*n't|dont)\s+know|idk|not\s+sure|i'?m\s+stuck|stuck|hint|help|nudge)\b/i;
const SHOW_ANSWER_PATTERN =
  /\b(show\s+(?:me\s+)?(?:the\s+)?answer|tell\s+me\s+the\s+answer|what'?s\s+the\s+answer|give\s+me\s+the\s+answer)\b/i;
const SIMPLIFY_PATTERN =
  /\b(make\s+it\s+simpler|simpler(?:\s+please)?|simplify(?:\s+it)?|(?:in\s+)?simpler\s+words|say\s+(?:it|that)\s+(?:more\s+)?simply|easier\s+words|i\s+(?:do\s*n't|dont)\s+understand\s+the\s+question)\b/i;
const EXAMPLE_PATTERN =
  /\b(show\s+me\s+an?\s+example|give\s+me\s+an?\s+example|(?:an?\s+)?example\s+please|can\s+i\s+(?:see|have|get)\s+an?\s+example)\b/i;
const CHALLENGE_PATTERN =
  /\b(challenge\s+me|make\s+it\s+harder|(?:a\s+)?harder\s+(?:one|question)|something\s+harder)\b/i;
/** The Coach controls are commands, not content: a long reply that merely
 *  mentions "an example" or "simpler" is still an answer attempt. */
const MAX_COMMAND_WORDS = 8;

function isShortCommand(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length <= MAX_COMMAND_WORDS;
}

/** The bare discourse-move classification, independent of pending state. */
export function classifyControlWord(text: string): "affirm" | "decline" | "next" | "exit" | null {
  const trimmed = text.trim();
  if (AFFIRM_PATTERN.test(trimmed)) return "affirm";
  if (NEXT_PATTERN.test(trimmed)) return "next";
  if (EXIT_PATTERN.test(trimmed)) return "exit";
  if (DECLINE_PATTERN.test(trimmed)) return "decline";
  return null;
}

/**
 * Interprets a learner turn against the pending Coach state. This is the
 * routing invariant: in AWAITING_ANSWER, a plain "yes"/"no" is left as an
 * ordinary answer attempt (it may legitimately answer a yes/no question),
 * but "next"/"stop" signal the learner wants out of the pending question
 * rather than trying to answer it. In AWAITING_CONTROL, yes/no/next are
 * always commands.
 */
export function detectTurnIntent(text: string, state: CoachState): TurnIntent {
  const trimmed = text.trim();
  if (!trimmed) return "irrelevant";
  if (SHOW_ANSWER_PATTERN.test(trimmed)) return "show_answer";
  if (isShortCommand(trimmed)) {
    if (SIMPLIFY_PATTERN.test(trimmed)) return "simplify";
    if (EXAMPLE_PATTERN.test(trimmed)) return "example";
    if (CHALLENGE_PATTERN.test(trimmed)) return "challenge";
  }
  if (HELP_PATTERN.test(trimmed)) return "help_request";

  const control = classifyControlWord(trimmed);

  if (state.kind === "awaiting_control" && control) return "conversation_control";
  if (state.kind === "awaiting_answer" && (control === "next" || control === "exit")) return "conversation_control";

  return "answer";
}

// ---------------------------------------------------------------------------
// Structured Coach-question generation — every question Coach asks carries
// a semantic rubric (expected concepts) instead of one magic answer string.
// ---------------------------------------------------------------------------

export type CoachQuestion = {
  question: string;
  expectedConcepts: ExpectedConcept[];
  sourceChunkIds: string[];
  sourceMarkers: number[];
};

const COACH_QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "expected_concepts", "source_markers"],
  properties: {
    question: { type: "string" },
    expected_concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "description", "weight", "critical"],
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          weight: { type: "number" },
          critical: { type: "boolean" }
        }
      }
    },
    source_markers: { type: "array", items: { type: "integer" } }
  }
};

/** Weights are normalized so every question's concepts sum to 1. */
export function normalizeExpectedConcepts(
  raw: Array<{ id: string; description: string; weight: number; critical: boolean }> | undefined
): ExpectedConcept[] {
  const cleaned = (raw ?? [])
    .map((concept, index) => ({
      // A missing/blank model-provided id becomes a stable positional id
      // (concept_1, concept_2, ...) based on the concept's position in the
      // raw list. Deterministic and repeatable across calls with the same
      // input — never a random suffix, which would make grading state
      // (persisted per-question) non-reproducible for tests and debugging.
      id: String(concept.id ?? "").trim() || `concept_${index + 1}`,
      description: String(concept.description ?? "").trim(),
      weight: Number(concept.weight) > 0 ? Number(concept.weight) : 0,
      critical: Boolean(concept.critical)
    }))
    .filter((concept) => concept.description.length > 0);

  if (!cleaned.length) return [];

  const total = cleaned.reduce((sum, concept) => sum + concept.weight, 0);
  if (total <= 0) {
    const even = 1 / cleaned.length;
    return cleaned.map((concept) => ({ ...concept, weight: even }));
  }
  return cleaned.map((concept) => ({ ...concept, weight: concept.weight / total }));
}

function directiveLines(directives: string[] | undefined, scope: string): string[] {
  return directives?.length
    ? [`The learner has chosen a teaching style/tradition below. Apply it only to ${scope}:`, ...directives]
    : [];
}

/**
 * Pure prompt builder for Coach questions. `challengeGuidance` is the
 * control plane's ChallengeSpec already rendered into instructions (reasoning
 * task, support level, route) by apps/web/lib/coach-render.ts; the language
 * rules hold the English plain regardless of how hard that task is.
 */
export function buildCoachQuestionSystem(args: {
  challengeGuidance?: string[];
  pedagogyDirectives?: string[];
}): string {
  return [
    "You are Studigo's Coach, asking one question drawn from the learner's own course materials.",
    ...LANGUAGE_FLOOR_RULES,
    ...(args.challengeGuidance?.length
      ? args.challengeGuidance
      : [
          "Reasoning task: explain. Ask what happens or why it happens, in one familiar case.",
          "Do not ask a question that can be answered with only yes or no, unless you also ask why."
        ]),
    "If the question states a specific fact, figure, or example from the excerpts, cite it inline with the bracketed excerpt number, like [2]. Only cite numbers that appear in the supplied excerpts. A question that only asks the learner to explain an idea needs no citation.",
    "List 1-3 underlying concepts that together make a correct answer to THIS question only - not everything in the excerpts. Each concept needs a short id, a plain description of what showing it looks like, a positive weight, and whether it is critical (a critical concept the learner directly contradicts means the answer cannot be marked correct).",
    "Weights must be positive numbers whose sum is 1 across all concepts for this question.",
    "The question and every concept must be answerable and verifiable from the supplied excerpts alone. A familiar everyday case may frame the question, but the idea being tested must come from the excerpts.",
    ...directiveLines(args.pedagogyDirectives, "how you phrase the question - never to which concepts you list, their weights, or criticality"),
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");
}

/**
 * Asks one question and returns the underlying concepts that constitute a
 * correct answer. These concepts - not a single model sentence - are what
 * grading is scored against, which is what lets a correct paraphrase pass.
 */
export async function generateCoachQuestion(args: {
  topicTitle: string;
  objective: string | null;
  chunks: RetrievedChunk[];
  /** Sanitized [NAME] instruction lines (engine.ts EngineDirective). Phrasing only. */
  pedagogyDirectives?: string[];
  /** The ChallengeSpec rendered as instructions (apps/web/lib/coach-render.ts). */
  challengeGuidance?: string[];
  /** Re-render an existing question in plainer words, same concept. */
  simplifyFrom?: { question: string; expectedConcepts: ExpectedConcept[] };
}): Promise<CoachQuestion> {
  if (!args.chunks.length) {
    return {
      question: "There is nothing in this room's materials covering that topic yet.",
      expectedConcepts: [],
      sourceChunkIds: [],
      sourceMarkers: []
    };
  }

  const result = await structured<{
    question: string;
    expected_concepts: Array<{ id: string; description: string; weight: number; critical: boolean }>;
    source_markers: number[];
  }>({
    system: buildCoachQuestionSystem({ challengeGuidance: args.challengeGuidance, pedagogyDirectives: args.pedagogyDirectives }),
    user: [
      asUntrustedMaterial({
        topicTitle: args.topicTitle,
        objective: args.objective,
        ...(args.simplifyFrom ? { rephraseMorePlainly: args.simplifyFrom.question } : {})
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_coach_question",
    schema: COACH_QUESTION_SCHEMA
  });

  const expectedConcepts = normalizeExpectedConcepts(result.expected_concepts);
  const sourceMarkers = (result.source_markers ?? []).filter(
    (marker) => Number.isInteger(marker) && marker >= 1 && marker <= args.chunks.length
  );
  const sourceChunkIds = sourceMarkers.length
    ? sourceMarkers.map((marker) => args.chunks[marker - 1].id)
    : args.chunks.map((chunk) => chunk.id);

  return { question: result.question.trim(), expectedConcepts, sourceChunkIds, sourceMarkers };
}

/**
 * The single constrained rewrite used by `enforceLanguageFloor`. It returns
 * only new wording: the expected concepts, sources and control-plane spec
 * of the question are not outputs of this call, so they cannot change.
 */
export async function rewriteCoachQuestion(args: {
  question: string;
  violations: string[];
  expectedConcepts: ExpectedConcept[];
  chunks: RetrievedChunk[];
  challengeGuidance?: string[];
}): Promise<string> {
  const result = await structured<{ question: string }>({
    system: [
      "You rewrite one Coach question so its English is easier. You change wording only.",
      "Keep exactly the same reasoning task and difficulty: if it asks why, how, to predict, compare, apply, or defend, the rewrite must ask the same. Never turn it into a recall or yes/no question to make it easier.",
      "Keep the same idea being checked and the same facts. Keep any [n] citation that the original has, and add none.",
      "Fix these problems:",
      ...args.violations.map((violation) => `- The question ${violation}.`),
      ...LANGUAGE_FLOOR_RULES,
      ...(args.challengeGuidance?.length ? ["The question was written for this task:", ...args.challengeGuidance] : []),
      "Return only the rewritten question.",
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
    user: [
      asUntrustedMaterial({
        question: args.question,
        conceptsBeingChecked: args.expectedConcepts.map((concept) => concept.description)
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_coach_question_rewrite",
    schema: { type: "object", additionalProperties: false, required: ["question"], properties: { question: { type: "string" } } }
  });
  return result.question.trim();
}

// ---------------------------------------------------------------------------
// Learner support controls ("make it simpler", "show me an example").
// These render support around the SAME pending question and concepts; they
// never change what counts as correct and are never graded.
// ---------------------------------------------------------------------------

export type CoachSupportKind = "simplify" | "example";

export function buildCoachSupportSystem(args: {
  support: CoachSupportKind;
  /** The spec's teaching route rendered as instructions. Phrasing only. */
  routeGuidance?: string[];
  pedagogyDirectives?: string[];
}): string {
  const task =
    args.support === "simplify"
      ? "Rewrite the pending question in plainer words. Keep the same idea and the same reasoning task; only make the English easier. Return only the rewritten question, as one main question."
      : "Give one short, concrete example that makes the pending question easier to think about, without answering it. Prefer an example from the excerpts and cite it with [n]. If the example is not in the excerpts, say it is a general example and do not cite it. At most three short sentences, and do not ask a question.";
  return [
    "You are Studigo's Coach, supporting a learner on a question they have not answered yet.",
    task,
    ...LANGUAGE_FLOOR_RULES,
    ...(args.routeGuidance ?? []),
    ...directiveLines(args.pedagogyDirectives, "tone and phrasing"),
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");
}

export async function renderCoachSupport(args: {
  support: CoachSupportKind;
  question: string;
  expectedConcepts: ExpectedConcept[];
  chunks: RetrievedChunk[];
  routeGuidance?: string[];
  pedagogyDirectives?: string[];
}): Promise<string> {
  const result = await structured<{ text: string }>({
    system: buildCoachSupportSystem(args),
    user: [
      asUntrustedMaterial({
        pendingQuestion: args.question,
        conceptsBeingChecked: args.expectedConcepts.map((concept) => concept.description)
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_coach_support",
    schema: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } }
  });
  return result.text.trim();
}

/** Instructions for "show me the answer": concise, plain, and cited. */
export const SHOW_ANSWER_INSTRUCTIONS = [
  "The learner asked to be shown the answer to a Coach question.",
  "Give the answer in two to four short sentences using familiar words; define any technical word right away.",
  "Cite every fact with [n] from the numbered excerpts. Do not add facts the excerpts do not support.",
  "Do not ask a new question."
].join(" ");

// ---------------------------------------------------------------------------
// Structured semantic evaluator — extracts evidence; never routes.
// ---------------------------------------------------------------------------

export const CONCEPT_STATUSES = ["demonstrated", "partial", "absent", "contradicted"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export type ConceptEvaluation = { id: string; status: ConceptStatus };

export type CoachEvaluation = {
  intent: TurnIntent;
  concepts: ConceptEvaluation[];
};

const EVAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "concepts"],
  properties: {
    intent: {
      type: "string",
      enum: ["answer", "irrelevant", "help_request", "show_answer", "conversation_control", "clarification"]
    },
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status"],
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: [...CONCEPT_STATUSES] }
        }
      }
    }
  }
};

/**
 * The model extracts semantic evidence only: for each expected concept, does
 * the learner's reply demonstrate it, partially show it, leave it absent, or
 * contradict it? Ordinary TypeScript (see `decideOutcome` below) makes the
 * routing decision from this evidence — the model never decides pass/fail.
 */
export async function evaluateCoachAnswer(args: {
  question: string;
  expectedConcepts: ExpectedConcept[];
  learnerResponse: string;
  chunks: RetrievedChunk[];
}): Promise<CoachEvaluation> {
  if (!args.expectedConcepts.length) {
    return { intent: args.learnerResponse.trim() ? "answer" : "irrelevant", concepts: [] };
  }

  const result = await structured<{
    intent: TurnIntent;
    concepts: Array<{ id: string; status: ConceptStatus }>;
  }>({
    system: [
      "You extract semantic evidence from a learner's reply to a Coach question. You do not decide what happens next — you only report what the reply shows.",
      "Classify the reply's intent: answer (any attempt to respond to the question, including partial, example-based, or informal replies), irrelevant (off-topic or nonsensical), help_request (asking for a hint or admitting they do not know), show_answer (explicitly asking to be told the answer), conversation_control (a short discourse move like yes/no/next that carries no content), or clarification (the learner is asking their own genuine question instead of answering — e.g. asking what a word or concept in the question means, or asking a related question they want answered first).",
      "Distinguish clarification from answer carefully: a reply that tries to explain, apply, or exemplify the idea is an answer even if it is wrong or incomplete; a reply that instead poses a question back to you (asking for a definition or explanation) is a clarification. When it is genuinely a question the learner wants answered before they can respond, choose clarification. Do not base this on how many words the reply shares with the question.",
      "For every expected concept, decide: demonstrated (clearly shown, in any wording, including examples or everyday vocabulary), partial (gestured at or incomplete), absent (not addressed at all), or contradicted (the reply states something incompatible with it).",
      "Judge meaning, not wording. A correct idea in different vocabulary, a valid example instead of a definition, and a typo-heavy but recognizable answer must never be marked absent just because it does not repeat the source's phrasing.",
      "Never require verbatim overlap with the source excerpts.",
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
    user: [
      asUntrustedMaterial({
        question: args.question,
        expectedConcepts: args.expectedConcepts.map((concept) => ({ id: concept.id, description: concept.description })),
        learnerResponse: args.learnerResponse.slice(0, 4000)
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_coach_evaluation",
    schema: EVAL_SCHEMA
  });

  const knownIds = new Set(args.expectedConcepts.map((concept) => concept.id));
  const concepts = (result.concepts ?? []).filter((concept) => knownIds.has(concept.id));
  return { intent: result.intent, concepts };
}

// ---------------------------------------------------------------------------
// Mathematically explicit grading — no vector/cosine similarity. Retrieval
// uses embeddings to find material; grading a learner's understanding never
// does.
// ---------------------------------------------------------------------------

export const CONCEPT_VALUES: Record<ConceptStatus, number> = {
  demonstrated: 1,
  partial: 0.5,
  absent: 0,
  contradicted: -1
};

/** semantic_score >= CORRECT: correct. Between PARTIAL and CORRECT: partial credit. Below PARTIAL: incorrect. */
export const CORRECT_THRESHOLD = 0.85;
export const PARTIAL_THRESHOLD = 0.45;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** semantic_score = clamp(Σ(weight_i × concept_value_i), 0, 1). */
export function scoreConcepts(expected: ExpectedConcept[], evaluated: ConceptEvaluation[]): number {
  if (!expected.length) return 0;
  const statusById = new Map(evaluated.map((concept) => [concept.id, concept.status]));
  let total = 0;
  for (const concept of expected) {
    const status = statusById.get(concept.id) ?? "absent";
    total += concept.weight * CONCEPT_VALUES[status];
  }
  return clamp01(total);
}

export type CoachOutcome = "correct" | "partial" | "incorrect" | "irrelevant" | "help" | "control";

/**
 * The deterministic action planner. Recognition (the evaluator, above) and
 * pedagogy (this function) are kept separate on purpose: this is ordinary
 * TypeScript with named, tested thresholds, not a decision buried in a
 * prompt.
 */
export function decideOutcome(args: {
  intent: TurnIntent;
  expectedConcepts: ExpectedConcept[];
  evaluated: ConceptEvaluation[];
  score: number;
}): CoachOutcome {
  if (args.intent === "conversation_control") return "control";
  if (
    args.intent === "help_request" ||
    args.intent === "show_answer" ||
    args.intent === "simplify" ||
    args.intent === "example" ||
    args.intent === "challenge"
  ) {
    return "help";
  }
  if (args.intent === "irrelevant") return "irrelevant";

  const statusById = new Map(args.evaluated.map((concept) => [concept.id, concept.status]));
  const criticalContradicted = args.expectedConcepts.some(
    (concept) => concept.critical && statusById.get(concept.id) === "contradicted"
  );
  if (criticalContradicted) return "incorrect";

  if (args.score >= CORRECT_THRESHOLD) return "correct";
  if (args.score >= PARTIAL_THRESHOLD) return "partial";
  return "incorrect";
}

// ---------------------------------------------------------------------------
// Feedback phrasing — pedagogy has already been decided; the model only
// phrases it naturally, grounded in the excerpts and the concept evidence.
// ---------------------------------------------------------------------------

const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["feedback"],
  properties: { feedback: { type: "string" } }
};

const OUTCOME_INSTRUCTIONS: Record<CoachOutcome, string> = {
  correct: "The learner's reply is correct. Affirm it briefly, in one or two short sentences, and note a terminology difference from the source only if relevant.",
  partial: "The learner's reply is partly correct. Say plainly what they got right, then ask only for the one missing piece.",
  incorrect: "The learner's reply is incorrect or contradicts a critical concept. Name the specific mistake plainly and correct it using the excerpts, without being harsh.",
  irrelevant: "The learner's reply does not respond to the question. Do not treat this as a content mistake. Briefly say what the question is asking, in simpler words, and give one concrete clue from the excerpts. Never say the material is insufficient.",
  help: "The learner is stuck. Give exactly one short clue grounded in the excerpts, in at most two short sentences. Do not give the answer. Then invite them to try again.",
  control: "Acknowledge briefly and move on."
};

/** Pure prompt builder for feedback: the outcome is already decided. */
export function buildCoachFeedbackSystem(args: {
  outcome: CoachOutcome;
  routeGuidance?: string[];
  pedagogyDirectives?: string[];
}): string {
  return [
    "You are Studigo's Coach, phrasing feedback for a learner's reply to a pending question. The grading decision has already been made by the application; you only phrase it.",
    OUTCOME_INSTRUCTIONS[args.outcome],
    "At most three short sentences, addressed directly to the learner, with one main question at most. Use familiar words and define any technical word right away. Cite with [n] only when stating a fact the numbered excerpts actually support.",
    "If you give an example, use one from the excerpts whenever possible. If it is not in the excerpts, say it is a general example and never attach a citation to it.",
    "Never say the material is insufficient because of how the learner replied.",
    ...(args.routeGuidance ?? []),
    ...directiveLines(args.pedagogyDirectives, "tone and phrasing - it can never change the outcome above or invent new concept judgments"),
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");
}

export async function generateCoachFeedback(args: {
  question: string;
  expectedConcepts: ExpectedConcept[];
  evaluated: ConceptEvaluation[];
  learnerResponse: string;
  outcome: CoachOutcome;
  chunks: RetrievedChunk[];
  /** Same sanitized [NAME] instruction lines as generateCoachQuestion —
   *  phrasing/tone only. The outcome (and therefore what pedagogically
   *  must happen next) is passed in already decided and is never
   *  influenced by these directives. */
  pedagogyDirectives?: string[];
  routeGuidance?: string[];
}): Promise<string> {
  const statusById = new Map(args.evaluated.map((concept) => [concept.id, concept.status]));
  const conceptSummary = args.expectedConcepts.map((concept) => ({
    description: concept.description,
    status: statusById.get(concept.id) ?? "absent"
  }));

  const result = await structured<{ feedback: string }>({
    system: buildCoachFeedbackSystem({
      outcome: args.outcome,
      routeGuidance: args.routeGuidance,
      pedagogyDirectives: args.pedagogyDirectives
    }),
    user: [
      asUntrustedMaterial({
        question: args.question,
        learnerResponse: args.learnerResponse.slice(0, 4000),
        conceptEvidence: conceptSummary
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_coach_feedback",
    schema: FEEDBACK_SCHEMA
  });

  return result.feedback.trim();
}
