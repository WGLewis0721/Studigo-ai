import assert from "node:assert/strict";
import test from "node:test";
import { buildExploreChapters, canSwitchExploreQuest, exploreStatus } from "./explore-journal";

const topics = [
  { id: "a", title: "Three Branches", objective: "Identify the branches", order_index: 1 },
  { id: "b", title: "How Laws Work", objective: "Explain a law", order_index: 2 },
  { id: "c", title: "Rights", objective: null, order_index: 3 }
];

test("journal uses real topic order without generating imaginary chapters", () => {
  const chapters = buildExploreChapters([topics[2], topics[0], topics[1]], null);
  assert.deepEqual(chapters.map((chapter) => chapter.title), ["Guide topics"]);
  assert.deepEqual(chapters[0].quests.map((quest) => quest.id), ["a", "b", "c"]);
});

test("only exact uniquely matched guide chapters can claim a topic", () => {
  const chapters = buildExploreChapters(topics, {
    topicIds: ["a", "b", "c"],
    chapters: [
      { id: "one", title: "Three Branches", objective: "Identify the branches", objectiveEvidence: [{ blockKey: "block", pageNumber: 1 }] },
      { id: "two", title: "Unknown content", objective: "Nothing present", objectiveEvidence: [{ blockKey: "other", pageNumber: 2 }] },
      { id: "three", title: "Rights", objective: "Rights", objectiveEvidence: [] }
    ]
  });
  assert.equal(chapters[0].title, "Three Branches");
  assert.deepEqual(chapters[0].quests.map((q) => q.id), ["a"]);
  assert.deepEqual(chapters[1].quests.map((q) => q.id), ["b", "c"]);
});

test("invalid or duplicate matching source evidence cannot create unsupported chapters", () => {
  const chapters = buildExploreChapters([
    { id: "a", title: "Same", objective: null, order_index: 0 },
    { id: "b", title: "Same", objective: null, order_index: 1 }
  ], { topicIds: ["a", "b"], chapters: [
    { id: "dup", title: "Same", objective: "Other", objectiveEvidence: [{ blockKey: "b", pageNumber: 1 }] }
  ] });
  assert.deepEqual(chapters.map((c) => c.id), ["guide-topics"]);
});

test("status is reading-only and scoped to the exact current quest", () => {
  const cursor = { topic_id: "a", phase: "done" as const, paused: false };
  assert.equal(exploreStatus("a", cursor, true), "reading_complete");
  assert.equal(exploreStatus("b", cursor, true), "available");
  assert.equal(exploreStatus("a", cursor, false), "source_changed");
});

test("unfinished room cursor cannot be silently overwritten by another quest", () => {
  const cursor = { topic_id: "a", phase: "show" as const, paused: true };
  assert.equal(canSwitchExploreQuest("b", cursor), false);
  assert.equal(canSwitchExploreQuest("a", cursor), true);
  assert.equal(canSwitchExploreQuest("b", { ...cursor, phase: "done" }), true);
  assert.equal(canSwitchExploreQuest("b", null), true);
});
