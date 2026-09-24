import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningEvent } from "@/lib/learning";
import { recordLearningEvent } from "@/lib/learning/persistence";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * Where Coach observations go. Injectable so the router's commit order can be
 * tested without a database.
 */
export type CoachEvidenceStore = {
  /** Idempotent: an identical retry of the same event ID succeeds; conflicting reuse throws. */
  record(event: LearningEvent): Promise<void>;
  /**
   * The result already recorded under this event ID, read with the
   * learner's own RLS-scoped client, so a transport retry keeps the outcome
   * that was committed the first time instead of re-grading it.
   */
  recordedResult(supabase: SupabaseClient, eventId: string): Promise<LearningEvent["result"] | null>;
};

export const learningEventStore: CoachEvidenceStore = {
  async record(event) {
    // Service role only after the router has established ownership with the
    // user-scoped client and verified the issued spec's scope.
    await recordLearningEvent(createServiceSupabaseClient(), event);
  },
  async recordedResult(supabase, eventId) {
    const { data, error } = await supabase.from("learning_events").select("result").eq("id", eventId).maybeSingle();
    if (error) throw new Error("Could not read learning history; retry the same interaction");
    return ((data as { result?: LearningEvent["result"] } | null)?.result) ?? null;
  }
};
