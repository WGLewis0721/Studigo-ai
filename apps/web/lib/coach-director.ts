import type { SupabaseClient } from "@supabase/supabase-js";
import { nextChallenge, type ChallengeSpec, type LearningRoute } from "@/lib/learning";
import { loadConceptLearningState } from "@/lib/learning/persistence";
import type { Topic } from "@/lib/rooms";

/**
 * The Coach's only doorway to the learning-control plane. It asks for the
 * next ChallengeSpec and renders whatever comes back; it never builds,
 * edits, or steps a spec itself. Injectable so router tests need no database.
 */
export type CoachDirector = {
  challengeFor(args: {
    supabase: SupabaseClient;
    userId: string;
    roomId: string;
    topic: Topic;
    route: LearningRoute;
  }): Promise<ChallengeSpec>;
};

export const learningControlPlaneDirector: CoachDirector = {
  async challengeFor({ supabase, userId, roomId, topic, route }) {
    const key = { userId, roomId, topicId: topic.id };
    const { state, events } = await loadConceptLearningState(supabase, key);
    const recentEvents = [...events]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
      .slice(0, 12);
    return nextChallenge({
      concept: { ...key, objective: topic.objective || topic.title },
      learnerState: state,
      recentEvents,
      activity: "coach",
      route,
      now: new Date().toISOString()
    });
  }
};
