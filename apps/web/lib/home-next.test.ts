import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHomeNext, daysUntil, pickFocusRoom, progressLine, testLine } from "./home-next";
import type { WeakArea } from "./study-planning";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();
const room = (id: string, testInDays: number | null, updatedDaysAgo = 1) => ({ id, title: id, test_date: testInDays === null ? null : at(testInDays), updated_at: at(-updatedDaysAgo) });
const area = (title: string, reasons: string[], recommendation: WeakArea["recommendation"] = "quiz") => ({ topic: { title }, reasons, recommendation, label: "Needs work" }) as unknown as WeakArea;

test("Home leads with the nearest test that has not passed", () => {
  assert.equal(pickFocusRoom([room("later", 12), room("soon", 3), room("past", -2), room("none", null)], NOW)?.id, "soon");
});

test("with no upcoming test, Home leads with the room touched most recently", () => {
  assert.equal(pickFocusRoom([room("old", null, 9), room("recent", -3, 1), room("mid", null, 4)], NOW)?.id, "recent");
  assert.equal(pickFocusRoom([], NOW), null);
});

test("the test line never invents a date", () => {
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil("not a date", NOW), null);
  assert.equal(testLine(null), "No test date yet. Add one in Room Settings when you know it.");
  assert.equal(testLine(0), "Your test is today.");
  assert.equal(testLine(1), "Your test is tomorrow.");
  assert.equal(testLine(6), "Your test is in 6 days.");
  assert.match(testLine(-1), /has passed/);
});

test("progress is a plain count, and absent when the room has no topics", () => {
  assert.equal(progressLine({ topicCount: 0, practicedTopicCount: 0, masteredCount: 0 }), null);
  assert.equal(progressLine({ topicCount: 8, practicedTopicCount: 3, masteredCount: 0 }), "3 of 8 topics practiced");
  assert.equal(progressLine({ topicCount: 8, practicedTopicCount: 5, masteredCount: 2 }), "5 of 8 topics practiced, 2 strong");
});

test("a room with no topics sends the learner to add materials, with no progress claim", () => {
  const next = buildHomeNext(room("Science", 6), [], { topicCount: 0, practicedTopicCount: 0, masteredCount: 0 }, NOW);
  assert.equal(next.mode, "materials");
  assert.equal(next.progress, null);
  assert.equal(next.line, "Your test is in 6 days.");
});

test("next up is the most urgent weak area, in the mode it recommends", () => {
  const next = buildHomeNext(room("Science", 6), [area("Tornado formation", ["2 of the last 3 quiz questions missed."]), area("Clouds", [])], { topicCount: 8, practicedTopicCount: 3, masteredCount: 1 }, NOW);
  assert.equal(next.heading, "Tornado formation");
  assert.equal(next.note, "2 of the last 3 quiz questions missed.");
  assert.equal(next.mode, "quiz");
  assert.equal(next.progress, "3 of 8 topics practiced, 1 strong");
});

test("when nothing is slipping, Home says so instead of inventing a weak spot", () => {
  const next = buildHomeNext(room("Science", null), [], { topicCount: 4, practicedTopicCount: 4, masteredCount: 4 }, NOW);
  assert.equal(next.heading, "Everything here is strong");
  assert.equal(next.mode, "quiz");
});
