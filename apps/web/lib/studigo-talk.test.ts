import assert from "node:assert/strict";
import test from "node:test";
import { createTalkSmoother, talkFromRms, TALK_REDUCED_CAP } from "./studigo-talk";

test("rms maps 0.02 to 0.25 onto 0 to 1 and clamps outside", () => {
  assert.equal(talkFromRms(0), 0);
  assert.equal(talkFromRms(0.02), 0);
  assert.ok(Math.abs(talkFromRms(0.135) - 0.5) < 1e-9);
  assert.equal(talkFromRms(0.25), 1);
  assert.equal(talkFromRms(0.9), 1);
  assert.equal(talkFromRms(Number.NaN), 0);
});

test("the mouth opens faster than it closes", () => {
  const up = createTalkSmoother();
  const opened = up.step(1, 60);
  const down = createTalkSmoother();
  for (let t = 0; t < 600; t += 16) down.step(1, 16);
  const closed = down.step(0, 60);
  assert.ok(opened > 0.6 && opened < 0.7, String(opened));
  assert.ok(1 - closed < opened, "release over 60 ms covers less ground than attack");
});

test("silence settles at exactly 0 and reduced motion caps at 0.4", () => {
  const s = createTalkSmoother();
  for (let t = 0; t < 400; t += 16) s.step(1, 16, true);
  assert.ok(s.value <= TALK_REDUCED_CAP + 1e-9);
  for (let t = 0; t < 2000; t += 16) s.step(0, 16, true);
  assert.equal(s.value, 0);
});
