import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPANION_EVENTS } from "./companion-logic";
import {
  expireStudigoReaction, requestStudigoReaction, resolveStudigoIntent,
  STUDIGO_EVENT_REACTION, STUDIGO_INITIAL_BEHAVIOR, STUDIGO_INTENT, studigoDirection,
} from "./studigo-behaviors";

test("all committed companion events resolve to named Rive behavior targets", () => {
  for (const event of COMPANION_EVENTS) {
    const next = requestStudigoReaction(STUDIGO_INITIAL_BEHAVIOR, STUDIGO_EVENT_REACTION[event], 0);
    assert.ok(STUDIGO_INTENT[resolveStudigoIntent(next)] > 0, event);
  }
});

test("lower priority reactions do not interrupt or queue behind a celebration", () => {
  const start = { ...STUDIGO_INITIAL_BEHAVIOR, state: "reading" } as const;
  const celebration = requestStudigoReaction(start, "celebrating", 10);
  assert.equal(requestStudigoReaction(celebration, "incorrect", 11), celebration);
  assert.equal(resolveStudigoIntent(expireStudigoReaction(celebration, 1209)), "celebrating");
  assert.equal(resolveStudigoIntent(expireStudigoReaction(celebration, 1210)), "reading");
});

test("equal or higher priority reactions replace the earlier one", () => {
  const correct = requestStudigoReaction(STUDIGO_INITIAL_BEHAVIOR, "correct", 0);
  const incorrect = requestStudigoReaction(correct, "incorrect", 20);
  const petting = requestStudigoReaction(incorrect, "petting", 40);
  assert.equal(resolveStudigoIntent(incorrect), "incorrect");
  assert.equal(resolveStudigoIntent(petting), "petting");
  assert.equal(resolveStudigoIntent(expireStudigoReaction(petting, 1490)), "idle");
});

test("wake and a pet release a sleepy base before returning to idle", () => {
  const asleep = { ...STUDIGO_INITIAL_BEHAVIOR, state: "sleepy" } as const;
  for (const name of ["wake", "petting"] as const) {
    const active = requestStudigoReaction(asleep, name, 0);
    assert.equal(resolveStudigoIntent(active), name);
    assert.equal(resolveStudigoIntent(expireStudigoReaction(active, 2000)), "idle");
  }
});

test("direction applies during idle and uses normalized coordinates with a dead zone", () => {
  assert.equal(studigoDirection({ x: 0.17, y: 0.1 }), null);
  assert.equal(studigoDirection({ x: 0.7, y: -0.1 }), "right");
  assert.equal(studigoDirection({ x: -0.2, y: -0.6 }), "up");
  assert.equal(studigoDirection({ x: NaN, y: 1 }), null);
  const idle = { ...STUDIGO_INITIAL_BEHAVIOR, direction: "left" } as const;
  assert.equal(resolveStudigoIntent(idle), "left");
  assert.equal(resolveStudigoIntent({ ...idle, state: "thinking" }), "thinking");
});
