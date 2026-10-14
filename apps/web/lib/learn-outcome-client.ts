import type { LearnOutcome } from "./learn-outcome";

export type LearnOutcomeAction = "retry" | "see_topics" | "materials";

export type LearnOutcomeView = {
  title: string;
  message: string;
  action: LearnOutcomeAction | null;
};

const KINDS = new Set<LearnOutcome["kind"]>([
  "ready",
  "partial_coverage",
  "materials_processing",
  "no_ready_materials",
  "no_relevant_evidence",
  "invalid_topic_scope",
  "retrieval_error",
  "generation_error"
]);

/** The network boundary is untyped. Only recognized server outcomes drive recovery UI. */
export function readLearnOutcome(value: unknown): LearnOutcome | null {
  if (!value || typeof value !== "object") return null;
  const outcome = value as Partial<LearnOutcome>;
  if (!KINDS.has(outcome.kind as LearnOutcome["kind"])) return null;
  if (outcome.reasonCode !== outcome.kind?.toUpperCase() || typeof outcome.retryable !== "boolean") return null;
  if (!Array.isArray(outcome.coverageIds) || !outcome.coverageIds.every((id) => typeof id === "string")) return null;
  const counts = outcome.counts;
  if (!counts || typeof counts !== "object") return null;
  if ([counts.readyMaterials, counts.processingMaterials, counts.failedMaterials, counts.relevantChunks]
    .some((count) => typeof count !== "number" || !Number.isFinite(count) || count < 0)) return null;
  return outcome as LearnOutcome;
}

/** Product wording is selected by a domain kind, never by matching answer text. */
export function learnOutcomeView(outcome: LearnOutcome): LearnOutcomeView | null {
  switch (outcome.kind) {
    case "ready":
      return null;
    case "partial_coverage":
      return {
        title: "Some sources are still unavailable",
        message: "This answer uses the sources currently available. Check Materials for documents still processing or needing attention.",
        action: "materials"
      };
    case "materials_processing":
      return {
        title: "Your materials are still processing",
        message: "Studigo is reading this room's documents. Check Materials for progress, then try again.",
        action: "materials"
      };
    case "no_ready_materials":
      return {
        title: "No materials are ready yet",
        message: outcome.counts.failedMaterials > 0
          ? "No documents are ready. Review failed uploads in Materials or add another document."
          : "No documents are ready. Add a document in Materials to start learning.",
        action: "materials"
      };
    case "no_relevant_evidence":
      return {
        title: "No supporting passage found",
        message: "Ready materials are available, but they do not support an answer to this topic. Review your topics or add a source that covers it.",
        action: "see_topics"
      };
    case "invalid_topic_scope":
      return {
        title: "Choose a current topic",
        message: "This topic is no longer available in the current Study Room scope. Choose a topic to continue.",
        action: "see_topics"
      };
    case "retrieval_error":
      return {
        title: "Could not search your materials",
        message: "The search failed. Your materials may still be ready; please try again.",
        action: outcome.retryable ? "retry" : null
      };
    case "generation_error":
      return {
        title: "Could not finish the explanation",
        message: "Studigo found relevant material but could not finish the answer. Please try again.",
        action: outcome.retryable ? "retry" : null
      };
  }
}
