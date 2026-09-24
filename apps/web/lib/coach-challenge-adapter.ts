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

export interface CoachDirector {
  initial(topic: Topic, route: LearningRoute): CoachChallenge;
  request(current: CoachChallenge, request: ChallengeRequest): CoachChallenge;
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
