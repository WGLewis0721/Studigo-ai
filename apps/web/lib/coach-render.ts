import {
  SCAFFOLD_LADDER,
  REASONING_LADDER,
  LEARNING_ROUTES,
  ACTIVITIES,
  type ChallengeKind,
  type ChallengeSpec,
  type LearningRoute,
  type ScaffoldLevel
} from "@/lib/learning";
import routePolicies from "@/lib/generated/route-policies.json";
import type { RoutePolicyProjection } from "@/lib/route-policy-projection";

// ---------------------------------------------------------------------------
// ChallengeSpec -> learner-facing Coach instructions.
//
// The learning-control plane (apps/web/lib/learning) is authoritative for the
// reasoning target, scaffold level, concept target and progression intent.
// This module only RENDERS a spec into phrasing instructions for the model:
// it never changes a field, never picks a harder or easier kind, and never
// reads grades. Language burden is held low separately (packages/ai
// coach-language.ts), so a harder spec changes the task, not the English.
// ---------------------------------------------------------------------------

/** What each rung asks the learner to do, with a plain-language shape
 *  (register illustrations, not templates). */
const CHALLENGE_KIND_GUIDANCE: Record<ChallengeKind, string> = {
  recognize: "Reasoning task: recognize. Ask the learner to pick out or name the idea in a simple case. A short answer is fine.",
  recall: "Reasoning task: recall. Ask what the learner remembers about one thing. A short answer is fine. Shape: 'What happens when ice melts?'",
  explain: "Reasoning task: explain. Ask what happens or why it happens, in one familiar case. Shape: 'What happens when ice melts?' then, next turn, 'Why does it do that?'",
  compare: "Reasoning task: compare. Ask how exactly two things are alike or different. Shape: 'How is melting different from freezing?'",
  predict: "Reasoning task: predict. Describe one simple situation and ask what will happen and why. Shape: 'You leave a cup of water in the freezer overnight. What will you find? Why?'",
  apply: "Reasoning task: apply. Give one concrete situation and ask the learner to use the idea on it.",
  transfer: "Reasoning task: transfer. Put the same idea in a new, familiar situation that the material does not describe, and ask whether and why the idea applies. Shape: 'Candle wax turns liquid when it gets hot. Is that like melting ice? Why?'",
  novel_problem: "Reasoning task: solve a new problem. Give a small problem in everyday words that can only be solved with the idea.",
  defend: "Reasoning task: defend reasoning. State one claim plainly (it may be a common mistake) and ask whether the learner agrees and why.",
  teach_back: "Reasoning task: teach back. Ask the learner to explain the idea in their own words, as if to a friend who missed the lesson."
};

/** How much support the question itself may carry. Labels follow SCAFFOLD_LADDER. */
const SCAFFOLD_GUIDANCE: Record<ScaffoldLevel, string> = {
  0: "give no clue inside the question.",
  1: "you may add one short nudge about what to think about, without hinting at the answer.",
  2: "you may include one clue that narrows the search but does not state the answer.",
  3: "anchor the question in one concrete example from the excerpts.",
  4: "offer two or three short answer choices, then ask why.",
  5: "show one short worked example from the excerpts, then ask a similar question."
};

const ROUTE_POLICIES = routePolicies as Record<string, RoutePolicyProjection>;

/**
 * The spec's route as phrasing guidance, read from the canonical KB record the
 * control plane named (`spec.routeRecord`) via its generated projection.
 * KB rules about when to change support or advance are superseded by the
 * spec, which has already made that decision.
 */
export function renderRouteGuidance(spec: Pick<ChallengeSpec, "routeRecord">): string[] {
  const policy = ROUTE_POLICIES[spec.routeRecord];
  const invariant =
    "The route changes how you teach, never what is correct: keep the same facts, the same concepts, and the same standard for a correct answer.";
  if (!policy) return [invariant];
  return [
    `Teaching route: ${policy.label}.`,
    ...(policy.sequence.length
      ? [`Its shape across turns: ${policy.sequence.join(" -> ")} Play only the current step of that shape in this turn.`]
      : []),
    ...policy.rules,
    "Support level and progression are already decided by the application; follow the support level given above rather than any route rule about changing it.",
    invariant
  ];
}

/** Renders the whole spec for question generation. Deterministic and pure. */
export function renderChallengeGuidance(spec: ChallengeSpec): string[] {
  const shortAnswerOk = spec.challengeKind === "recognize" || spec.challengeKind === "recall";
  return [
    CHALLENGE_KIND_GUIDANCE[spec.challengeKind],
    `Support level ${spec.scaffoldLevel} (${SCAFFOLD_LADDER[spec.scaffoldLevel].replace(/_/g, " ")}): ${SCAFFOLD_GUIDANCE[spec.scaffoldLevel]}`,
    shortAnswerOk
      ? "A short factual answer is acceptable for this task."
      : "Do not ask a question that can be answered with only yes or no, unless you also ask why.",
    "Focus this question on a single concept.",
    ...(spec.taskSize === "single_step" ? ["Ask for only the next single step, not the whole task."] : []),
    ...(spec.constraints.requireNewContext
      ? ["Set the question in a situation the excerpts do not describe, so the learner has to carry the idea somewhere new."]
      : []),
    ...renderRouteGuidance(spec)
  ];
}

/**
 * Runtime guard for a spec read back from `coach_state` (JSON, so untrusted
 * shape). Checks it against the control plane's own constants; anything
 * malformed is dropped, never repaired or guessed.
 */
export function parseIssuedSpec(raw: unknown): ChallengeSpec | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const spec = raw as Partial<ChallengeSpec>;
  const concept = spec.concept as Partial<ChallengeSpec["concept"]> | undefined;
  const ok =
    spec.policyVersion === 1 &&
    typeof concept?.topicId === "string" &&
    typeof concept.roomId === "string" &&
    typeof concept.userId === "string" &&
    typeof concept.objective === "string" &&
    REASONING_LADDER.includes(spec.challengeKind as ChallengeKind) &&
    REASONING_LADDER[spec.reasoningLevel as number] === spec.challengeKind &&
    Number.isInteger(spec.scaffoldLevel) &&
    (spec.scaffoldLevel as number) >= 0 &&
    (spec.scaffoldLevel as number) <= 5 &&
    LEARNING_ROUTES.includes(spec.route as LearningRoute) &&
    ACTIVITIES.includes(spec.activity as ChallengeSpec["activity"]) &&
    (spec.taskSize === "whole" || spec.taskSize === "single_step") &&
    typeof spec.routeRecord === "string" &&
    typeof spec.constraints === "object" &&
    spec.constraints !== null;
  return ok ? (spec as ChallengeSpec) : undefined;
}
