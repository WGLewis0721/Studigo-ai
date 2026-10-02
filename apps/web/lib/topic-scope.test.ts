import assert from "node:assert/strict";
import { test } from "node:test";
import { scopeTopicsForRequest } from "./engine";
import type { Topic } from "./rooms";

const topic = (id: string, title: string): Topic => ({
  id,
  room_id: "room",
  title,
  objective: `Explain ${title}`,
  key_terms: [],
  priority: 50,
  order_index: 0,
  origin: "study_guide",
  mastery_score: 0,
  status: "not_started",
  last_practiced_at: null,
  learner_edited: false
});

const A = topic("10000000-0000-4000-8000-000000000001", "Matter");
const B = topic("10000000-0000-4000-8000-000000000002", "Forces");
const C = topic("10000000-0000-4000-8000-000000000003", "Energy");

test("no explicit topic selection leaves the active room scope intact", () => {
  assert.deepEqual(scopeTopicsForRequest([A, B, C], undefined), [A, B, C]);
  assert.deepEqual(scopeTopicsForRequest([A, B, C], []), [A, B, C]);
});

test("multi-select preserves room order while restricting the director", () => {
  assert.deepEqual(scopeTopicsForRequest([A, B, C], [C.id, A.id]), [A, C]);
});

test("stale/cross-room topic IDs fail closed when none are active in this room", () => {
  assert.throws(
    () => scopeTopicsForRequest([A, B], ["10000000-0000-4000-8000-000000000099"]),
    /selected topics are no longer available/i
  );
});

test("a stale ID does not poison valid selected topics", () => {
  assert.deepEqual(
    scopeTopicsForRequest([A, B, C], [B.id, "10000000-0000-4000-8000-000000000099"]),
    [B]
  );
});
