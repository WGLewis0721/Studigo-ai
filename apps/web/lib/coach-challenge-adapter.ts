import { CHALLENGE_KINDS, type CoachChallenge, type LearningRoute } from "@studigo/ai";
import type { Topic } from "@/lib/rooms";

// ---------------------------------------------------------------------------
// TEMPORARY control-plane adapter.
//
// The learning-control plane (Astra's `feature/adaptive-learning-core`, see
// docs/ADAPTIVE_LEARNING_ENGINE.md §8) owns advancement, mastery, next level,
// and scaffold persistence. That contract has not landed yet, so this adapter
// is the smallest stand-in that lets the Coach render a ChallengeSpec:
//
//   - `initial` returns a fixed starting spec (explain, independent).
//   - `request(spec, "harder")` honors an explicit learner "Challenge me" by
//     stepping one rung up the reasoning ladder. It never looks at grades,
//     never advances on its own, and stores nothing.
//
// The Coach only ever talks to the `CoachDirector` interface, so replacing
// this file with the real director is a one-line change in coach-router.ts.
// Delete this file when the control plane lands.
// ---------------------------------------------------------------------------

export type ChallengeRequest = "harder";

/** Sync or async, so the real director (which loads persisted learner
 *  state) can be dropped in without changing the router. */
export interface CoachDirector {
  initial(topic: Topic, route: LearningRoute): CoachChallenge | Promise<CoachChallenge>;
  request(current: CoachChallenge, request: ChallengeRequest): CoachChallenge | Promise<CoachChallenge>;
}

/**
 * The subset of the control plane's `ChallengeSpec`
 * (feature/adaptive-learning-core, apps/web/lib/learning/types.ts) that the
 * Coach renders. Declared structurally so this branch does not depend on
 * that unmerged one; once it lands, import `ChallengeSpec` instead.
 */
export type ControlPlaneChallengeSpec = {
  concept: { topicId: string; objective: string };
  route: LearningRoute;
  challengeKind: CoachChallenge["challengeKind"];
  scaffoldLevel: CoachChallenge["scaffoldLevel"];
  constraints: { oneConceptAtATime: true };
};

/** Maps the control plane's decision onto what the Coach renders. Pure; decides nothing. */
export function fromChallengeSpec(spec: ControlPlaneChallengeSpec): CoachChallenge {
  return {
    topicId: spec.concept.topicId,
    challengeKind: spec.challengeKind,
    scaffoldLevel: spec.scaffoldLevel,
    route: spec.route,
    objective: spec.concept.objective,
    constraints: { oneConceptAtATime: spec.constraints.oneConceptAtATime }
  };
}

export const temporaryCoachDirector: CoachDirector = {
  initial(topic, route) {
    return {
      topicId: topic.id,
      challengeKind: "explain",
      scaffoldLevel: 0,
      route,
      objective: topic.objective,
      constraints: { oneConceptAtATime: true }
    };
  },
  request(current, request) {
    if (request !== "harder") return current;
    const index = CHALLENGE_KINDS.indexOf(current.challengeKind);
    const next = CHALLENGE_KINDS[Math.min(index + 1, CHALLENGE_KINDS.length - 1)];
    return { ...current, challengeKind: next, scaffoldLevel: 0 };
  }
};
