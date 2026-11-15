import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SLEEP_AFTER_MS, type CompanionEvent } from "./companion-logic";
import { MOOD_EVENTS_NEUTRAL, SPARK_ACTIVE_FLOOR, SPARK_HALF_LIFE_MS, SPARK_MAX, SPARK_MIN, SPARK_START, moodTier, nextSpark } from "./companion-mood";

const here = dirname(fileURLToPath(import.meta.url));

/** Deterministic PRNG so the 10,000-sequence bounds test is repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test("mood starts at Sunny and sessionReturn resets to start", () => {
  assert.equal(SPARK_START, 2);
  assert.equal(nextSpark(4, "sessionReturn", 0), SPARK_START);
  assert.equal(nextSpark(0, "sessionReturn", 0), SPARK_START);
});

test("mistakes and neutral events never lower mood", () => {
  for (const event of MOOD_EVENTS_NEUTRAL) {
    for (const spark of [1, 2, 3, 4]) {
      assert.ok(nextSpark(spark, event, 0) >= spark, `${event} lowered spark ${spark}`);
    }
  }
});

test("ten wrong answers in a row keep mood at or above the active floor and never decrease", () => {
  let spark = SPARK_START;
  for (let i = 0; i < 10; i += 1) {
    const next = nextSpark(spark, "wrong", 0);
    assert.ok(next >= spark, "wrong must not decrease mood");
    assert.ok(next >= SPARK_ACTIVE_FLOOR);
    spark = next;
  }
});

test("a single event moves mood by at most 2", () => {
  const events: CompanionEvent[] = ["correct", "correctFast", "cardGood", "setDone", "missionComplete", "wrong", "stall"];
  for (const event of events) {
    for (let spark = SPARK_MIN; spark <= SPARK_MAX; spark += 0.5) {
      assert.ok(Math.abs(nextSpark(spark, event, 0) - spark) <= 2, `${event} from ${spark} moved more than 2`);
    }
  }
});

test("bounds hold over 10,000 random event sequences", () => {
  const next = rng(20261115);
  const events: CompanionEvent[] = ["correct", "correctFast", "wrong", "blindspot", "cardGood", "cardMiss", "setDone", "stall", "hintOpened", "missionComplete", "sessionReturn"];
  for (let run = 0; run < 10_000; run += 1) {
    let spark = SPARK_START;
    let idle = 0;
    for (let step = 0; step < 20; step += 1) {
      const event = events[Math.floor(next() * events.length)];
      const dt = Math.floor(next() * 5_000);
      idle = next() < 0.2 ? SLEEP_AFTER_MS + 1 : 0;
      spark = nextSpark(spark, event, dt, idle);
      assert.ok(spark >= SPARK_MIN && spark <= SPARK_MAX, `out of bounds: ${spark}`);
      if (idle < SLEEP_AFTER_MS) assert.ok(spark >= SPARK_ACTIVE_FLOOR, `active learner dropped below floor: ${spark}`);
    }
  }
});

test("decay is frame-rate independent at 30, 60 and 120 Hz", () => {
  const run = (hz: number) => {
    let spark = 4;
    const step = 1000 / hz;
    const frames = 30 * hz;
    for (let i = 0; i < frames; i += 1) spark = nextSpark(spark, null, step, 0);
    return spark;
  };
  const at30 = run(30), at60 = run(60), at120 = run(120);
  assert.ok(Math.abs(at30 - at60) < 1e-6, `30 Hz ${at30} vs 60 Hz ${at60}`);
  assert.ok(Math.abs(at60 - at120) < 1e-6, `60 Hz ${at60} vs 120 Hz ${at120}`);
});

test("idle learners drift toward sleepy, active learners rest at Sunny", () => {
  let idle = nextSpark(4, null, 10 * SPARK_HALF_LIFE_MS, SLEEP_AFTER_MS);
  assert.ok(idle < 1, "sleepy learner should fall below the active floor");
  assert.ok(Math.abs(nextSpark(4, null, 20 * SPARK_HALF_LIFE_MS, 0) - SPARK_START) < 0.01);
});

test("tiers map to the five MOOD_METER names", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => moodTier(n)), [0, 1, 2, 3, 4]);
  assert.equal(moodTier(-1), 0);
  assert.equal(moodTier(9), 4);
});

test("mood module imports nothing from learning, Supabase, or AI packages", () => {
  const source = readFileSync(join(here, "companion-mood.ts"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  for (const path of imports) {
    assert.ok(!/learning|supabase|packages\/ai|mastery|fetch/.test(path), `forbidden import: ${path}`);
  }
});
