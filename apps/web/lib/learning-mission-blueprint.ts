/** Revision-bound, learner-facing outline. Source eligibility is established by
 * the authenticated retrieval layer, never by this presentation helper. */
export type MissionSourceRef = {
  topicId: string;
  documentId: string;
  chunkId: string;
  revision: number;
  pageNumber: number | null;
  excerpt: string;
  documentName: string;
  eligible: boolean;
};
export type MissionScope = {
  id: string;
  title: string;
  objective?: string | null;
};
export type MissionObjective = {
  topicId: string;
  title: string;
  objective: string;
  source: MissionSourceRef | null;
  status: "ready" | "needs_source" | "stale";
};
export type LearningMissionPlan = {
  schemaVersion: 1;
  revisionKey: string;
  objectives: MissionObjective[];
  supportedCount: number;
  sourceStatus: "ready" | "partial" | "missing";
};
/** Never promise a cited concept without an exact authorized, current source.
 * Unknown prerequisites remain unsupported instead of being fabricated. */
export function buildLearningMissionPlan(
  orderedTopics: readonly MissionScope[],
  currentSources: readonly MissionSourceRef[],
  expectedRevisions: Readonly<Record<string, number>> = {}
): LearningMissionPlan {
  const seen = new Set<string>();
  const topics = orderedTopics.filter((topic) => {
    if (!topic.id || seen.has(topic.id)) return false;
    seen.add(topic.id);
    return true;
  });
  const objectives = topics.map((topic): MissionObjective => {
    const source = currentSources.find((candidate) =>
      candidate.topicId === topic.id && candidate.eligible &&
      candidate.excerpt.trim().length > 0 &&
      Number.isSafeInteger(candidate.revision) &&
      candidate.revision >= 0) ?? null;
    const expected = expectedRevisions[topic.id];
    const stale = Boolean(source && expected !== undefined && source.revision !== expected);
    return {
      topicId: topic.id,
      title: topic.title,
      objective: topic.objective?.trim() || `Understand ${topic.title}.`,
      status: !source ? "needs_source" : stale ? "stale" : "ready",
      source: stale ? null : source
    };
  });
  const supportedCount = objectives.filter((objective) => objective.status === "ready").length;
  // An exact revision/ID token, not a hash of private source text.
  const revisionKey = JSON.stringify({
    version: 1,
    objectives: objectives.map((item) => [
      item.topicId, item.status, item.source?.documentId ?? null,
      item.source?.chunkId ?? null, item.source?.revision ?? null
    ])
  });
  return {
    schemaVersion: 1,
    revisionKey,
    objectives,
    supportedCount,
    sourceStatus: supportedCount === 0 ? "missing" : supportedCount === objectives.length ? "ready" : "partial"
  };
}
