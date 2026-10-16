import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningMissionPlan, type MissionSourceRef } from "./learning-mission-blueprint";

const government: MissionSourceRef = {
  topicId: "branches", documentId: "gov-guide", chunkId: "page-3", revision: 4,
  pageNumber: 3, documentName: "Government guide.pdf", eligible: true,
  excerpt: "The legislative branch makes laws. The judicial branch interprets the laws."
};
const physics: MissionSourceRef = {
  topicId: "net-force", documentId: "physics-notes", chunkId: "page-7", revision: 2,
  pageNumber: 7, documentName: "Mechanics notes.pdf", eligible: true,
  excerpt: "F = ma. When net force is not zero, acceleration follows the force."
};
test("teacher topic order is preserved without duplicate objectives", () => {
  const plan = buildLearningMissionPlan(
    [{ id: "branches", title: "Three branches" }, { id: "branches", title: "Duplicate" }, { id: "voting", title: "Voting" }],
    [government]
  );
  assert.deepEqual(plan.objectives.map((item) => item.topicId), ["branches", "voting"]);
  assert.equal(plan.sourceStatus, "partial");
  assert.equal(plan.objectives[1].status, "needs_source");
  assert.equal(plan.objectives[1].source, null);
});
test("elementary and college fixtures reuse the schema but not each other's sources", () => {
  const gov = buildLearningMissionPlan([{ id: "branches", title: "Three branches" }], [government]);
  const college = buildLearningMissionPlan([{ id: "net-force", title: "Newton's second law" }], [physics]);
  assert.equal(gov.sourceStatus, "ready");
  assert.equal(college.sourceStatus, "ready");
  assert.notEqual(gov.revisionKey, college.revisionKey);
  assert.equal(gov.objectives[0].source?.pageNumber, 3);
  assert.equal(college.objectives[0].source?.pageNumber, 7);
});
test("retired source revision is blocked instead of replayed", () => {
  const valid = buildLearningMissionPlan([{ id: "branches", title: "Three branches" }], [government], { branches: 4 });
  const stale = buildLearningMissionPlan([{ id: "branches", title: "Three branches" }], [government], { branches: 5 });
  assert.equal(valid.objectives[0].status, "ready");
  assert.equal(stale.objectives[0].status, "stale");
  assert.equal(stale.objectives[0].source, null);
  assert.notEqual(valid.revisionKey, stale.revisionKey);
});
test("unknown prerequisite or unavailable source never manufactures a citation", () => {
  const plan = buildLearningMissionPlan(
    [{ id: "needed-math", title: "Vectors" }],
    [{ ...physics, topicId: "needed-math", eligible: false }]
  );
  assert.equal(plan.sourceStatus, "missing");
  assert.equal(plan.objectives[0].source, null);
});
