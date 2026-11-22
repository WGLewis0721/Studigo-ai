import assert from "node:assert/strict";
import test from "node:test";
import { emoteDone, emoteIn, emoteOut } from "./studigo-emote";

test("the pop overshoots to 1.25 at 120 ms and settles to 1 by 320 ms", () => {
  assert.equal(emoteIn(0), 0);
  assert.ok(Math.abs(emoteIn(120) - 1.25) < 1e-9);
  assert.ok(emoteIn(60) > 0.9 && emoteIn(60) < 1.25);
  assert.ok(emoteIn(220) > 1 && emoteIn(220) < 1.25);
  assert.equal(emoteIn(320), 1);
  assert.equal(emoteIn(5000), 1);
});

test("the exit eases in from where it is to 0 over 140 ms", () => {
  assert.equal(emoteOut(1, 0), 1);
  assert.ok(emoteOut(1, 70) > 0.8);
  assert.equal(emoteOut(1, 140), 0);
  assert.equal(emoteOut(1.2, 999), 0);
  assert.ok(emoteDone("in", 320) && !emoteDone("in", 319) && emoteDone("out", 140));
});
