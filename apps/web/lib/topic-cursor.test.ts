import assert from "node:assert/strict";
import test from "node:test";
import { activeTopicId, leavePendingChallenge, nextTopic } from "./topic-cursor";

const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];

test("C03 six topics advance independently and stop at the edges", () => {
  const learn = { index: 0 };
  const coach = { index: 0 };
  const seen = [ids[0]];
  for (let step = 0; step < 5; step += 1) {
    const result = nextTopic({ orderedIds: ids, index: learn.index, knownIds: ids });
    assert.equal(result.status, "advanced");
    if (result.status === "advanced") {
      learn.index = result.index;
      seen.push(result.topicId);
      assert.equal(activeTopicId(ids, learn.index), result.topicId);
    }
  }
  assert.deepEqual(seen, ids);
  assert.equal(coach.index, 0);
  assert.equal(nextTopic({ orderedIds: ids, index: 5, knownIds: ids }).status, "last");
  assert.equal(nextTopic({ orderedIds: ["t1"], index: 0, knownIds: ["t1"] }).status, "choose_more");
  assert.equal(nextTopic({ orderedIds: ids, index: 2, knownIds: ids.filter((id) => id !== "t3") }).status, "removed");
});

test("C03 leaving a pending challenge does not change mastery", () => {
  const stayed = leavePendingChallenge({ pending: true, confirmed: false, mastery: 40 });
  assert.equal(stayed.advanced, false);
  assert.equal(stayed.graded, false);
  assert.equal(stayed.mastery, 40);
  const left = leavePendingChallenge({ pending: true, confirmed: true, mastery: 40 });
  assert.equal(left.advanced, true);
  assert.equal(left.graded, false);
  assert.equal(left.mastery, 40);
});
