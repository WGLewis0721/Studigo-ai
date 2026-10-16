import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLearningMissionPlan } from "@studigo/learning";
import {
  GUIDED_LEARN_CLIENT_FLAG,
  GUIDED_LEARN_SERVER_FLAG,
  guidedLearnEnabled,
  guidedLearnSurfaceEnabled,
  guidedLearnSwitchOn
} from "./guided-learn-flag";

test("Guided Learn stays off unless the value is exactly 1", () => {
  assert.equal(GUIDED_LEARN_SERVER_FLAG, "STUDIGO_GUIDED_LEARN");
  assert.equal(GUIDED_LEARN_CLIENT_FLAG, "NEXT_PUBLIC_STUDIGO_GUIDED_LEARN");
  for (const value of [undefined, "", "0", "true", "on", " 1", "1 "]) {
    assert.equal(guidedLearnSwitchOn(value), false, String(value));
  }
  assert.equal(guidedLearnSwitchOn("1"), true);
});

test("server and client flags must both be on", () => {
  assert.equal(guidedLearnEnabled(undefined, undefined), false);
  assert.equal(guidedLearnEnabled("1", undefined), false);
  assert.equal(guidedLearnEnabled(undefined, "1"), false);
  assert.equal(guidedLearnEnabled("1", "0"), false);
  assert.equal(guidedLearnEnabled("1", "1"), true);
});

test("the client surface stays off when the public flag is absent", () => {
  assert.equal(guidedLearnSurfaceEnabled(false, "1"), false);
  assert.equal(guidedLearnSurfaceEnabled(true, undefined), false);
  assert.equal(guidedLearnSurfaceEnabled(true, "1"), true);
});

test("the current Learn path stays mounted while the new flag is only observable", () => {
  const page = readFileSync(new URL("../app/app/rooms/[roomId]/page.tsx", import.meta.url), "utf8");
  const coach = readFileSync(new URL("../components/room/coach-panel.tsx", import.meta.url), "utf8");
  assert.match(page, /const phase3Learn = false/);
  assert.match(page, /guidedLearnEnabled\(\s*process\.env\.STUDIGO_GUIDED_LEARN,\s*process\.env\.NEXT_PUBLIC_STUDIGO_GUIDED_LEARN\s*\)/);
  assert.match(coach, /const guidedLearn = \(roomId === "fixture" \|\| phase3Learn\)/);
  assert.equal(coach.includes("STUDIGO_GUIDED_LEARN"), false);
  assert.equal(coach.includes("NEXT_PUBLIC_STUDIGO_GUIDED_LEARN"), false);
  assert.equal(page.includes("buildLearningMissionPlan"), false);
  assert.equal(page.includes("mission-plan"), false);
  assert.equal(coach.includes("buildLearningMissionPlan"), false);
  assert.equal(page.includes("phase3Learn = true"), false);
});

test("plan generation does not run when the Guided Learn flag is off", () => {
  assert.equal(guidedLearnEnabled(undefined, undefined), false);
  const result = buildLearningMissionPlan({
    guidedLearn: guidedLearnEnabled(undefined, undefined),
    roomId: "room-government",
    selectedTopicIds: ["branches"],
    topics: [{ topicId: "branches", orderIndex: 0, title: "Branches", objective: "Name the three branches of government." }],
    blocks: [],
    familiarity: "new",
    explanationLevel: "simpler",
    sourceRevisionKey: "room-government@corpus-1",
    topicScopeRevision: "topics@1",
    prerequisites: [{ prerequisiteId: "constitution", topicId: "branches" }]
  });
  assert.deepEqual(result, { status: "disabled", plan: null });
});
