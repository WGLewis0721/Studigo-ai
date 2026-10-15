import assert from "node:assert/strict";
import test from "node:test";
import { closeTeachingStyle } from "./coach-setup";
import { leavePendingChallenge, previousTopic } from "./topic-cursor";

const ids = ["t1", "t2", "t3"];

test("previousTopic from index 1 returns the prior topic and leaves mastery at 0", () => {
  const result = previousTopic({ orderedIds: ids, index: 1, knownIds: ids });
  assert.equal(result.status, "advanced");
  if (result.status !== "advanced") return;
  assert.equal(result.topicId, "t1");
  assert.equal(result.index, 0);
  const left = leavePendingChallenge({ pending: true, confirmed: true, mastery: 0 });
  assert.equal(left.mastery, 0);
  assert.equal(left.advanced, true);
});

test("previousTopic at index 0 returns status first and the same index", () => {
  const result = previousTopic({ orderedIds: ids, index: 0, knownIds: ids });
  assert.equal(result.status, "first");
  if (result.status !== "first") return;
  assert.equal(result.index, 0);
});

test("closeTeachingStyle restores the applied teaching style", () => {
  assert.deepEqual(closeTeachingStyle("standard"), { open: false, draft: "standard" });
});
