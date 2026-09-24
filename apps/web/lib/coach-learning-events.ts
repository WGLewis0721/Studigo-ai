import type { IssuedChallenge } from "@studigo/ai";
import { parseIssuedSpec } from "@/lib/coach-render";
import type { ChallengeSpec, LearningEvent, ScaffoldLevel } from "@/lib/learning";

// ---------------------------------------------------------------------------
// Coach -> LearningEvent mapping.
//
// Every field comes from trusted server state: the persisted issued
// ChallengeSpec (challenge kind, concept identity, new-context requirement),
// the persisted encounter record (encounter ID, support used, context ID),
// the authenticated user, and the persisted user message (interaction ID,
// server `created_at`). Nothing is read from learner prose or browser fields.
// Pure and deterministic: a transport retry rebuilds byte-identical events.
// ---------------------------------------------------------------------------

/** One persisted learner submission: the user-message row's ID and server time. */
export type CoachInteraction = { id: string; createdAt: string };

/** Observations one interaction can produce. Distinct parts give distinct, stable IDs. */
export type CoachEventPart = "attempt" | "support" | "skip";

export type CoachEventScope = {
  spec: ChallengeSpec;
  encounterId: string;
  contextId: string | null;
  newContext: boolean;
};

export class CoachEvidenceScopeError extends Error {}

/**
 * Verifies the issued challenge still belongs to exactly this learner, room
 * and pending topic before anything is written with the service role. Any
 * mismatch fails closed.
 */
export function coachEventScope(args: {
  issued: IssuedChallenge;
  userId: string;
  roomId: string;
  pendingTopicId: string | null;
}): CoachEventScope {
  const spec = parseIssuedSpec(args.issued.spec);
  if (!spec) throw new CoachEvidenceScopeError("Issued challenge is not a valid ChallengeSpec");
  if (
    spec.activity !== "coach" ||
    spec.concept.userId !== args.userId ||
    spec.concept.roomId !== args.roomId ||
    !args.pendingTopicId ||
    spec.concept.topicId !== args.pendingTopicId
  ) {
    throw new CoachEvidenceScopeError("Issued challenge does not match this learner, room and topic");
  }
  const newContext = spec.constraints.requireNewContext === true;
  if (newContext && !args.issued.contextId) {
    throw new CoachEvidenceScopeError("Issued challenge required a new context but has no context ID");
  }
  return { spec, encounterId: args.issued.encounterId, contextId: args.issued.contextId, newContext };
}

/** Deterministic observation ID for one part of one interaction. */
export function coachEventId(interactionId: string, part: CoachEventPart): string {
  return `coach:${interactionId}:${part}`;
}

/**
 * Deterministic time: the persisted message's server time, plus a fixed
 * offset so support given in reply to an attempt sorts strictly AFTER it
 * (the reducer processes support before success on equal timestamps).
 */
export function coachEventTime(interaction: CoachInteraction, offsetMs: number): string {
  const base = Date.parse(interaction.createdAt);
  if (!Number.isFinite(base)) throw new CoachEvidenceScopeError("Interaction has no valid server timestamp");
  return new Date(base + offsetMs).toISOString();
}

export function buildCoachEvent(args: {
  scope: CoachEventScope;
  interaction: CoachInteraction;
  part: CoachEventPart;
  result: LearningEvent["result"];
  scaffoldUsed: number | null;
  offsetMs: number;
}): LearningEvent {
  const { spec } = args.scope;
  return {
    id: coachEventId(args.interaction.id, args.part),
    userId: spec.concept.userId,
    roomId: spec.concept.roomId,
    topicId: spec.concept.topicId,
    encounterId: args.scope.encounterId,
    activity: "coach",
    challengeKind: spec.challengeKind,
    result: args.result,
    scaffoldUsed: args.scaffoldUsed === null ? null : (Math.min(5, Math.max(0, args.scaffoldUsed)) as ScaffoldLevel),
    // Server-observed and server-graded, never self-reported.
    evidence: "assessed",
    contextId: args.scope.contextId,
    newContext: args.scope.newContext,
    // Expected-concept IDs are generated per question and are not stable
    // across questions, so they are not a durable misconception identity.
    misconceptionId: null,
    createdAt: coachEventTime(args.interaction, args.offsetMs)
  };
}
