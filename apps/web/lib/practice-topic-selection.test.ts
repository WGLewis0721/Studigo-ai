import test from "node:test";
import assert from "node:assert/strict";
import { selectPracticeTopics } from "./practice-topic-selection";

const available = [{ id: "first" }, { id: "second" }, { id: "third" }];

test("selection preserves room topic order for a chosen subset", () => {
  assert.deepEqual(selectPracticeTopics(available, ["third", "first"]), [available[0], available[2]]);
  assert.deepEqual(selectPracticeTopics(available, ["first", "second", "third"]), available);
});

test("explicit empty, duplicate, stale, and foreign selections never expand the scope", () => {
  for (const ids of [[], ["first", "first"], ["first", "old"], ["first", "foreign"], "first", [42]]) {
    assert.equal(selectPracticeTopics(available, ids), null);
  }
});
