/**
 * An Explore journal is a presentation of actual ordered room topics.
 * A generated guide's chapter is shown only for an unambiguous, exact
 * title/objective match with an eligible authored chapter and topic UUID.
 * Similarity guesses are intentionally not allowed.
 */
export type ExploreTopic = {
  id: string;
  title: string;
  objective: string | null;
  order_index: number;
};

export type ExploreGuide = {
  topicIds: string[];
  chapters: Array<{
    id: string;
    title: string;
    objective: string;
    objectiveEvidence: Array<{ blockKey: string; pageNumber: number }>;
  }>;
};

export type ExploreChapter = {
  id: string;
  title: string;
  quests: ExploreTopic[];
};

export type ExploreCursor = {
  topic_id: string;
  phase: "brief" | "show" | "try" | "check" | "done";
  paused: boolean;
};

export type ExploreStatus = "available" | "in_progress" | "reading_complete" | "source_changed";

const norm = (s: string) => s.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");

export function buildExploreChapters(topics: readonly ExploreTopic[], guide: ExploreGuide | null): ExploreChapter[] {
  const ordered = [...topics].sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
  const linked = new Set<string>();
  const chapters: ExploreChapter[] = [];
  if (guide && Array.isArray(guide.topicIds) && Array.isArray(guide.chapters)) {
    const included = new Set(guide.topicIds);
    for (const chapter of guide.chapters) {
      if (!chapter?.id || !chapter?.title?.trim() || !chapter?.objectiveEvidence?.length) continue;
      const candidates = ordered.filter((topic) => included.has(topic.id) && !linked.has(topic.id)
        && [topic.title, topic.objective ?? ""].some((value) => value.trim()
          && [chapter.title, chapter.objective].some((key) => key.trim() && norm(value) === norm(key))));
      if (candidates.length !== 1) continue;
      const topic = candidates[0];
      linked.add(topic.id);
      chapters.push({ id: `source-${chapter.id}`, title: chapter.title, quests: [topic] });
    }
  }
  const remaining = ordered.filter((topic) => !linked.has(topic.id));
  if (remaining.length) chapters.push({ id: "guide-topics", title: "Guide topics", quests: remaining });
  return chapters;
}

export function exploreStatus(topicId: string, cursor: ExploreCursor | null, sourceCurrent: boolean | undefined): ExploreStatus {
  if (!cursor || cursor.topic_id !== topicId) return "available";
  if (sourceCurrent === false) return "source_changed";
  return cursor.phase === "done" ? "reading_complete" : "in_progress";
}

export function canSwitchExploreQuest(targetId: string, cursor: ExploreCursor | null): boolean {
  // Existing backend holds only one room-wide cursor. Switching away would
  // erase a partly finished lesson. Phase 7 requires per-quest persistence.
  return !cursor || cursor.topic_id === targetId || cursor.phase === "done";
}
