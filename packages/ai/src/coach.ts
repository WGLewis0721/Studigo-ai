import { UNTRUSTED_MATERIAL_RULE, asUntrustedMaterial } from "./client";
import { structured } from "./study";
import { buildContextBlock, type RetrievedChunk } from "./grounding";

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

export type CoachState =
  | { version: 1; kind: "idle" }
  | {
      version: 1;
      kind: "awaiting_answer";
      question: string;
      topicId: string | null;
      expectedConcepts: ExpectedConcept[];
      sourceChunkIds: string[];
      askedAt: string;
    }
  | {
      version: 1;
      kind: "awaiting_control";
      action: CoachControlAction;
      topicId: string | null;
      sourceChunkIds: string[];
    };

export const IDLE_COACH_STATE: CoachState = { version: 1, kind: "idle" };

/** Defensive parse: any shape that does not match a known variant collapses to idle. */
export function parseCoachState(raw: unknown): CoachState {
  if (!raw || typeof raw !== "object") return IDLE_COACH_STATE;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return IDLE_COACH_STATE;

  if (
    value.kind === "awaiting_answer" &&
    typeof value.question === "string" &&
    Array.isArray(value.expectedConcepts) &&
    Array.isArray(value.sourceChunkIds) &&
    typeof value.askedAt === "string"
  ) {
    return {
      version: 1,
      kind: "awaiting_answer",
      question: value.question,
      topicId: typeof value.topicId === "string" ? value.topicId : null,
      expectedConcepts: (value.expectedConcepts as unknown[]).filter(isExpectedConcept),
      sourceChunkIds: (value.sourceChunkIds as unknown[]).filter((id): id is string => typeof id === "string"),
      askedAt: value.askedAt
    };
  }

  if (
    value.kind === "awaiting_control" &&
    typeof value.action === "string" &&
    (COACH_CONTROL_ACTIONS as readonly string[]).includes(value.action) &&
    Array.isArray(value.sourceChunkIds)
  ) {
    return {
      version: 1,
      kind: "awaiting_control",
      action: value.action as CoachControlAction,
      topicId: typeof value.topicId === "string" ? value.topicId : null,
      sourceChunkIds: (value.sourceChunkIds as unknown[]).filter((id): id is string => typeof id === "string")
    };
  }

  return IDLE_COACH_STATE;
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

export type TurnIntent = "answer" | "irrelevant" | "help_request" | "show_answer" | "conversation_control";

const AFFIRM_PATTERN = /^(yes|yeah|yep|yup|sure|ok|okay|please|go\s*ahead|sounds\s+good|let'?s\s+go)[.!]?$/i;
const DECLINE_PATTERN = /^(no|nope|nah|not\s+now|no\s+thanks)[.!]?$/i;
const NEXT_PATTERN = /^(next|another|another\s+one|more|keep\s+going|continue)[.!]?$/i;
// "Exit" words always mean the learner wants out of whatever is pending,
// unlike a plain "no" which may legitimately be answering a yes/no question.
const EXIT_PATTERN = /^(stop|that'?s\s+all|i'?m\s+done)[.!]?$/i;
const HELP_PATTERN = /\b(i\s+(?:do\s*n't|dont)\s+know|idk|not\s+sure|i'?m\s+stuck|stuck|hint|help|nudge)\b/i;
const SHOW_ANSWER_PATTERN =
  /\b(show\s+(?:me\s+)?(?:the\s+)?answer|tell\s+me\s+the\s+answer|what'?s\s+the\s+answer|give\s+me\s+the\s+answer)\b/i;

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
    .map((concept) => ({
      id: String(concept.id ?? "").trim() || `concept_${Math.random().toString(36).slice(2, 8)}`,
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

/**
 * Asks one Socratic-style question and, unlike the older `askSocraticQuestion`,
 * also returns the underlying concepts that constitute a correct answer.
 * These concepts — not a single model sentence — are what grading is scored
 * against, which is what lets a correct paraphrase or example pass.
 */
export async function generateCoachQuestion(args: {
  topicTitle: string;
  objective: string | null;
  chunks: RetrievedChunk[];
  /** Sanitized [NAME] instruction lines from the learner's chosen teaching
   *  style/tradition (see engine.ts EngineDirective). These may only steer
   *  *phrasing* — tone, framing, question style — never the concepts,
   *  weights, criticality, or source markers, which stay fully determined
   *  by the material itself. */
  pedagogyDirectives?: string[];
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
    system: [
      "You are Studigo's Coach, asking one Socratic question drawn from the learner's own course materials.",
      "Ask exactly one open question that requires explaining, applying, or exemplifying the idea — never a question answerable with yes, no, or a single memorized term.",
      "List 2-4 underlying concepts that together constitute a correct answer. Each concept needs a short id, a plain description of what demonstrating it looks like, a positive weight, and whether it is critical (a critical concept that the learner directly contradicts means the answer cannot be marked correct, no matter the other concepts).",
      "Weights must be positive numbers whose sum is 1 across all concepts for this question.",
      "The question and every concept must be answerable and verifiable from the supplied excerpts alone.",
      ...(args.pedagogyDirectives?.length
        ? [
            "The learner has chosen a teaching style/tradition below. Apply it only to how you phrase the question — never to which concepts you list, their weights, or criticality:",
            ...args.pedagogyDirectives
          ]
        : []),
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
    user: [
      asUntrustedMaterial({ topicTitle: args.topicTitle, objective: args.objective }),
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
    intent: { type: "string", enum: ["answer", "irrelevant", "help_request", "show_answer", "conversation_control"] },
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
      "Classify the reply's intent: answer (any attempt to respond to the question, including partial, example-based, or informal replies), irrelevant (off-topic or nonsensical), help_request (asking for a hint or admitting they do not know), show_answer (explicitly asking to be told the answer), or conversation_control (a short discourse move like yes/no/next that carries no content).",
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
  if (args.intent === "help_request" || args.intent === "show_answer") return "help";
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
}): Promise<string> {
  const statusById = new Map(args.evaluated.map((concept) => [concept.id, concept.status]));
  const conceptSummary = args.expectedConcepts.map((concept) => ({
    description: concept.description,
    status: statusById.get(concept.id) ?? "absent"
  }));

  const outcomeInstruction: Record<CoachOutcome, string> = {
    correct: "The learner's reply is correct. Affirm it briefly, in one or two sentences, and note any terminology difference from the source only if relevant.",
    partial: "The learner's reply is partially correct. Preserve the correct portion explicitly, then ask only for the specific missing concept — do not restate what they already got right as a question.",
    incorrect: "The learner's reply is incorrect or contradicts a critical concept. Name the specific misconception plainly and correct it using the excerpts, without being harsh.",
    irrelevant: "The learner's reply does not respond to the question. Do not treat this as a content mistake. Briefly redirect to what the question is asking, restate it more simply, and give one concrete hint from the excerpts. Never say the material is insufficient — the material is fine, the reply just didn't engage with it.",
    help: "The learner is asking for help or the answer. Scaffold: give one concrete hint grounded in the excerpts first. Only give the full model answer if they explicitly asked to be shown the answer.",
    control: "Acknowledge briefly and move on."
  };

  const result = await structured<{ feedback: string }>({
    system: [
      "You are Studigo's Coach, phrasing feedback for a learner's reply to a pending question. The grading decision has already been made by the application; you only phrase it naturally and pedagogically.",
      outcomeInstruction[args.outcome],
      "At most three sentences, addressed directly to the learner. Cite with [n] only when stating a fact the numbered excerpts actually support.",
      "If you give an example, use one drawn from the excerpts whenever possible. If you must give an example that is not in the excerpts, say plainly that it is a general example and not from the uploaded material — never attach a source citation to an example the excerpts do not contain.",
      "Never say the material is insufficient because of how the learner replied; that framing is reserved for cases where the room genuinely has no relevant material, which is not this case.",
      ...(args.pedagogyDirectives?.length
        ? [
            "The learner has chosen a teaching style/tradition below. Apply it only to tone and phrasing — it can never change the outcome above (correct/partial/incorrect/etc.) or invent new concept judgments:",
            ...args.pedagogyDirectives
          ]
        : []),
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
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
