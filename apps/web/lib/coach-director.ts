import type { SupabaseClient } from "@supabase/supabase-js";
import { nextChallenge, replayLearningEvents, type ChallengeRequest, type ChallengeSpec, type LearningRoute, type LearningEvent } from "@/lib/learning";
import { loadConceptLearningState,fromObservationRow,toObservationRow } from "@/lib/learning/persistence";
import { projectConcept } from '@studigo/learning';
import { loadSessionRecommendation } from './learning/session-service';
import type { Topic } from "@/lib/rooms";

/**
 * The Coach's only doorway to the learning-control plane. It asks for the
 * next ChallengeSpec and renders whatever comes back; it never builds,
 * edits, or steps a spec itself. Injectable so router tests need no database.
 */
export type CoachDirector = {
  contextUnused?(args:{supabase:SupabaseClient;userId:string;roomId:string;topicId:string;contextId:string}):Promise<boolean>;
  recommendTopic?(args:{supabase:SupabaseClient;userId:string;roomId:string;topics:Topic[];now:string;selectedTopicId?:string|null}):Promise<string|null>;
  challengeFor(args: {
    supabase: SupabaseClient;
    userId: string;
    roomId: string;
    topic: Topic;
    route: LearningRoute;
    /** Forwarded verbatim. The one-shot "Try a harder question" control asks for "stretch". */
    challengeRequest: ChallengeRequest;
    now?:string;
    /** Trusted observations that will share this atomic issuance transaction. */
    pendingEvents?:readonly LearningEvent[];
  }): Promise<ChallengeSpec>;
};

export const learningControlPlaneDirector: CoachDirector = {
  async contextUnused({supabase,userId,roomId,topicId,contextId}) {
    const {events}=await loadConceptLearningState(supabase,{userId,roomId,topicId});return !events.some(e=>e.contextId===contextId);
  },
  async recommendTopic(args) {
    const plan=await loadSessionRecommendation(args);return plan.topicId;
  },
  async challengeFor({ supabase, userId, roomId, topic, route, challengeRequest, now:serverTime,pendingEvents=[] }) {
    const key = { userId, roomId, topicId: topic.id };
    const history = await loadConceptLearningState(supabase, key);
    const events=[...history.events,...pendingEvents.filter(e=>e.topicId===topic.id).map(e=>fromObservationRow(toObservationRow(e)))];
    const state=replayLearningEvents(key,events);
    const recentEvents = [...events]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
      .slice(0, 12);
    const now=serverTime??new Date().toISOString();
    const projection=projectConcept(key,events);
    return nextChallenge({
      concept: { ...key, objective: topic.objective || topic.title },
      learnerState: state,
      recentEvents,
      activity: "coach",
      route,
      challengeRequest,
      reviewDueAt: process.env.STUDIGO_ADAPTIVE_SESSION==='1' ? projection.review.dueAt : null,
      now
    });
  }
};
