import type { SupabaseClient } from "@supabase/supabase-js";
import { nextChallenge, type ChallengeRequest, type ChallengeSpec, type LearningRoute } from "@/lib/learning";
import { loadConceptLearningState } from "@/lib/learning/persistence";
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
    /** Forwarded verbatim. Only "Challenge me" asks for "stretch". */
    challengeRequest: ChallengeRequest;
    now?:string;
  }): Promise<ChallengeSpec>;
};

export const learningControlPlaneDirector: CoachDirector = {
  async contextUnused({supabase,userId,roomId,topicId,contextId}) {
    const {events}=await loadConceptLearningState(supabase,{userId,roomId,topicId});return !events.some(e=>e.contextId===contextId);
  },
  async recommendTopic(args) {
    const plan=await loadSessionRecommendation(args);return plan.topicId;
  },
  async challengeFor({ supabase, userId, roomId, topic, route, challengeRequest, now:serverTime }) {
    const key = { userId, roomId, topicId: topic.id };
    const { state, events } = await loadConceptLearningState(supabase, key);
    const recentEvents = [...events]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
      .slice(0, 12);
    const now=serverTime??new Date().toISOString();
    const spec=nextChallenge({
      concept: { ...key, objective: topic.objective || topic.title },
      learnerState: state,
      recentEvents,
      activity: "coach",
      route,
      challengeRequest,
      now
    });
    const projection=projectConcept(key,events);
    if(process.env.STUDIGO_ADAPTIVE_SESSION==='1'&&projection.review.dueAt&&Date.parse(projection.review.dueAt)<=Date.parse(now)&&!state.rematch&&challengeRequest==='normal') {
      spec.reasoningLevel=1;spec.challengeKind='recall';spec.reasons.push('scheduled_independent_recall');
    }
    return spec;
  }
};
