/** Public, provider-neutral result of looking for a grounded Learn explanation. */
export type LearnOutcomeKind =
  | "ready"
  | "partial_coverage"
  | "materials_processing"
  | "no_ready_materials"
  | "no_relevant_evidence"
  | "invalid_topic_scope"
  | "retrieval_error"
  | "generation_error";

export type LearnFailureKind = Exclude<LearnOutcomeKind, "ready" | "partial_coverage">;

export type LearnOutcome = {
  kind: LearnOutcomeKind;
  reasonCode: Uppercase<LearnOutcomeKind>;
  retryable: boolean;
  counts: {
    readyMaterials: number;
    processingMaterials: number;
    failedMaterials: number;
    relevantChunks: number;
  };
  /** Ready source document IDs represented by the retrieved evidence. */
  coverageIds: string[];
};

export type LearnCitation = {
  marker: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel: string;
  sourceType: string | null;
};

export type LearnResponse =
  | {
      topicId: string;
      level: string;
      explanation: string;
      citations: LearnCitation[];
      outcome: LearnOutcome & { kind: "ready" | "partial_coverage" };
      error?: never;
    }
  | {
      topicId?: string;
      error: string;
      outcome: LearnOutcome & { kind: LearnFailureKind };
      explanation?: never;
      citations?: never;
    };

export type LearnDocumentStatus = { id: string; status: string };

export function classifyLearnOutcome(input: {
  documentStatuses: LearnDocumentStatus[];
  /** Empty or omitted means all documents in the authorized room. */
  sourceDocumentIds?: string[];
  evidenceDocumentIds?: string[];
  evidenceChunkCount?: number;
  failure?: "invalid_topic_scope" | "retrieval_error" | "generation_error";
}): LearnOutcome {
  const scope = new Set(input.sourceDocumentIds ?? []);
  const scoped = scope.size
    ? input.documentStatuses.filter((document) => scope.has(document.id))
    : input.documentStatuses;
  const readyIds = new Set(scoped.filter((document) => document.status === "ready").map((document) => document.id));
  const processingMaterials = scoped.filter((document) =>
    ["uploaded", "queued", "processing"].includes(document.status)
  ).length;
  const failedMaterials = scoped.filter((document) => document.status === "failed").length;
  const coverageIds = [...new Set(input.evidenceDocumentIds ?? [])].filter((id) => readyIds.has(id));
  const relevantChunks = Math.max(0, input.evidenceChunkCount ?? 0);
  const incomplete = scope.size
    ? [...scope].some((id) => !readyIds.has(id))
    : processingMaterials + failedMaterials > 0;
  const kind: LearnOutcomeKind = input.failure
    ?? (readyIds.size === 0
      ? processingMaterials > 0 ? "materials_processing" : "no_ready_materials"
      : relevantChunks === 0 || coverageIds.length === 0
        ? "no_relevant_evidence"
        : incomplete ? "partial_coverage" : "ready");
  return {
    kind,
    reasonCode: kind.toUpperCase() as Uppercase<LearnOutcomeKind>,
    retryable: ["partial_coverage", "materials_processing", "retrieval_error", "generation_error"].includes(kind),
    counts: {
      readyMaterials: readyIds.size,
      processingMaterials,
      failedMaterials,
      relevantChunks
    },
    coverageIds
  };
}

export function learnOutcomeStatus(kind: LearnOutcomeKind): number {
  switch (kind) {
    case "ready":
    case "partial_coverage": return 200;
    case "materials_processing": return 425;
    case "no_ready_materials":
    case "no_relevant_evidence": return 422;
    case "invalid_topic_scope": return 404;
    case "retrieval_error":
    case "generation_error": return 503;
  }
}

export function learnOutcomeMessage(kind: LearnOutcomeKind): string {
  switch (kind) {
    case "ready":
    case "partial_coverage": return "Your lesson is ready.";
    case "materials_processing": return "Your materials are still processing. Try again when they are ready.";
    case "no_ready_materials": return "No readable materials are ready yet. Check Materials for uploads or failed files.";
    case "no_relevant_evidence": return "The ready materials do not cover this topic yet. See topics or add a relevant source.";
    case "invalid_topic_scope": return "This topic is not active in this Study Room.";
    case "retrieval_error": return "The materials could not be searched right now. Please retry.";
    case "generation_error": return "A grounded answer could not be built right now. Please retry.";
  }
}

export function buildLearnSuccess(input: {
  topicId: string;
  level: string;
  explanation: string;
  citations: LearnCitation[];
  outcome: LearnOutcome & { kind: "ready" | "partial_coverage" };
}): LearnResponse {
  return {
    topicId: input.topicId,
    level: input.level,
    explanation: input.explanation,
    citations: input.citations,
    outcome: input.outcome
  };
}

/** Keeps the established SSE completion fields for legacy Coach clients. */
export function learnStreamDone(
  answer: { text: string; citations: LearnCitation[]; grounded: boolean },
  outcome: LearnOutcome
) {
  return { type: "done" as const, text: answer.text, citations: answer.citations, grounded: answer.grounded, outcome };
}

export function learnStreamError(outcome: LearnOutcome) {
  return { type: "error" as const, error: learnOutcomeMessage(outcome.kind), outcome };
}
