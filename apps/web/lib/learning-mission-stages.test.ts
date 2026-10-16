import assert from "node:assert/strict";
import test from "node:test";
import { lessonBeatIndex, formativeReflection, canAdvanceLesson, LEARN_PHASES } from "./learning-mission-stages";

test("persisted phase deterministically restores exact activity after reload", () => {
  const expected = [0,1,2,3,null];
  for (let index = 0; index < LEARN_PHASES.length; index += 1) {
    assert.equal(lessonBeatIndex(LEARN_PHASES[index],4),expected[index]);
  }
  assert.equal(lessonBeatIndex("check",2),1);
});
test("formative response cannot award mastery or force progression", () => {
  assert.equal(formativeReflection("try", true, true),"ready");
  assert.equal(formativeReflection("try", true, false),"review");
  assert.equal(formativeReflection("try", false, false),null);
  assert.equal(formativeReflection("show", true, true),null);
  assert.equal(canAdvanceLesson("try", false, false, true, false),false);
  assert.equal(canAdvanceLesson("try", false, true, false, false),false);
});
test("pause and completion are terminal for immediate advance", () => {
  assert.equal(canAdvanceLesson("brief", true, false, false, true),false);
  assert.equal(canAdvanceLesson("done", false, true, true, true),false);
  assert.equal(canAdvanceLesson("brief", false, false, false, true),true);
});
