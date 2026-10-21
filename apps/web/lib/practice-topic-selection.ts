/** Reject stale or foreign topic IDs instead of silently widening a learner's scope. */
export function selectPracticeTopics<T extends { id: string }>(topics: T[], requested: unknown): T[] | null {
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > topics.length ||
      requested.some((id) => typeof id !== "string") || new Set(requested).size !== requested.length) return null;
  const selected = new Set(requested);
  if (requested.some((id) => !topics.some((topic) => topic.id === id))) return null;
  return topics.filter((topic) => selected.has(topic.id));
}
