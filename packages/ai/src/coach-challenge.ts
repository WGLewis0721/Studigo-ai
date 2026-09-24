// ---------------------------------------------------------------------------
// What the Coach consumes from the learning-control plane.
//
// The control plane (Astra's `feature/adaptive-learning-core`, see
// docs/ADAPTIVE_LEARNING_ENGINE.md §8) owns progression: which concept, which
// reasoning demand, how much scaffolding, whether to advance. This file only
// declares the *shape* of that decision as the Coach needs to render it, using
// the same vocabulary as the engine doc so the director's `ChallengeSpec`
// satisfies `CoachChallenge` structurally. Nothing here decides anything.
// When the control-plane package exports its own types, replace these
// declarations with re-exports.
// ---------------------------------------------------------------------------

/** The reasoning ladder (ADAPTIVE_LEARNING_ENGINE.md §6), lowest demand first. */
export const CHALLENGE_KINDS = [
  "recognize",
  "recall",
  "explain",
  "compare",
  "predict",
  "apply",
  "transfer",
  "novel_problem",
  "defend",
  "teach_back"
] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];

/** The scaffold ladder (§7). Independent of reasoning demand. */
export const SCAFFOLD_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type ScaffoldLevel = (typeof SCAFFOLD_LEVELS)[number];

/** Learning routes (§12): how support is delivered, never what mastery means. */
export const LEARNING_ROUTES = [
  "studigo_default",
  "direct_instruction",
  "socratic",
  "deliberate_practice",
  "concrete_to_abstract",
  "japanese_inspired",
  "montessori_inspired",
  "swedish_inspired",
  "singapore_math_inspired"
] as const;
export type LearningRoute = (typeof LEARNING_ROUTES)[number];

export type CoachChallenge = {
  topicId: string | null;
  challengeKind: ChallengeKind;
  scaffoldLevel: ScaffoldLevel;
  route: LearningRoute;
  objective: string | null;
  constraints: { oneConceptAtATime: boolean };
};

export function isLearningRoute(value: unknown): value is LearningRoute {
  return typeof value === "string" && (LEARNING_ROUTES as readonly string[]).includes(value);
}

/** Defensive parse for a persisted challenge: anything malformed is dropped, never guessed. */
export function parseCoachChallenge(raw: unknown): CoachChallenge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const constraints = value.constraints as Record<string, unknown> | undefined;
  if (
    typeof value.challengeKind !== "string" ||
    !(CHALLENGE_KINDS as readonly string[]).includes(value.challengeKind) ||
    !(SCAFFOLD_LEVELS as readonly unknown[]).includes(value.scaffoldLevel) ||
    !isLearningRoute(value.route)
  ) {
    return undefined;
  }
  return {
    topicId: typeof value.topicId === "string" ? value.topicId : null,
    challengeKind: value.challengeKind as ChallengeKind,
    scaffoldLevel: value.scaffoldLevel as ScaffoldLevel,
    route: value.route,
    objective: typeof value.objective === "string" ? value.objective : null,
    constraints: { oneConceptAtATime: constraints?.oneConceptAtATime !== false }
  };
}
