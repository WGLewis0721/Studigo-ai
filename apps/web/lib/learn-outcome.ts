/** Safe, source-free status shared by Learn routes and their UI consumers. */
export type LearnReasonCode =
  | "ready"
  | "partial_coverage"
  | "materials_processing"
  | "no_ready_materials"
  | "no_relevant_evidence"
  | "invalid_topic_scope"
  | "retrieval_error"
  | "generation_error";

export type LearnMaterial = { id: string; status: string };
export type LearnOutcome = {
  reasonCode: LearnReasonCode;
  retryable: boolean;
  counts: { ready: number; processing: number; failed: number };
  coverageIds: string[];
};

export function classifyLearnOutcome(args: {
  materials?: LearnMaterial[];
  evidenceCount?: number;
  error?: "invalid_topic_scope" | "retrieval_error" | "generation_error";
}): LearnOutcome {
  const materials = args.materials ?? [];
  const ready = materials.filter((item) => item.status === "ready");
  const processing = materials.filter((item) => ["uploaded", "queued", "processing"].includes(item.status));
  const failed = materials.filter((item) => item.status === "failed");
  const reasonCode: LearnReasonCode = args.error
    ?? (ready.length === 0
      ? processing.length > 0 ? "materials_processing" : "no_ready_materials"
      : args.evidenceCount === 0
        ? "no_relevant_evidence"
        : processing.length + failed.length > 0 ? "partial_coverage" : "ready");
  return {
    reasonCode,
    retryable: ["materials_processing", "retrieval_error", "generation_error"].includes(reasonCode),
    counts: { ready: ready.length, processing: processing.length, failed: failed.length },
    coverageIds: ready.map((item) => item.id)
  };
}

export function learnOutcomeMessage(reasonCode: LearnReasonCode): string {
  switch (reasonCode) {
    case "ready": return "Your materials are ready.";
    case "partial_coverage": return "This answer uses the ready materials. Some other files are still unavailable.";
    case "materials_processing": return "Your materials are still being read. Try again when processing finishes.";
    case "no_ready_materials": return "This Study Room has no ready materials yet. Check your uploads or add a source.";
    case "no_relevant_evidence": return "Your materials are available, but I could not find a passage that supports this topic. See your topics or add a relevant page.";
    case "invalid_topic_scope": return "That topic is no longer in this Study Room. See your current topics.";
    case "retrieval_error": return "I could not search your materials right now. Please retry.";
    case "generation_error": return "I found material, but could not build a grounded answer. Please retry.";
  }
}

export function isLearnSuccess(outcome: LearnOutcome): boolean {
  return outcome.reasonCode === "ready" || outcome.reasonCode === "partial_coverage";
}
