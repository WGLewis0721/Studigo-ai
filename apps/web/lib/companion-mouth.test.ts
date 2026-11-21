import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createMouth, VISEME_OPEN, type MouthDriver } from "./companion-motion/mouth-driver";

const inUnitRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

function closeTo(actual: number, expected: number, why = "") {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected} ${why}`.trim());
}

/** A fake word source: `say` fires the live callbacks, `ghost` fires every callback ever handed out. */
function wordSource() {
  const every: (() => void)[] = [];
  const live = new Set<() => void>();
  let unsubscribed = 0;
  const driver: MouthDriver = {
    kind: "boundary",
    onWord(cb: () => void) {
      every.push(cb);
      live.add(cb);
      return () => { unsubscribed += 1; live.delete(cb); };
    },
  };
  return {
    driver,
    say: () => { for (const cb of [...live]) cb(); },
    ghost: () => { for (const cb of every) cb(); },
    unsubscribed: () => unsubscribed,
  };
}

test("an amplitude driver sets the mouth frame by frame", () => {
  const envelope = [0, 0.2, 0.9, 0.4, 0.1, 0];
  let frame = 0;
  const mouth = createMouth();
  mouth.attach({ kind: "amplitude", sample: () => envelope[frame++] }, 0);
  assert.deepEqual(envelope.map((_, i) => mouth.sample(i * 16)), envelope);
});

test("an amplitude driver is clamped to the range from 0 to 1", () => {
  const levels = [1.7, -0.4, 0.55, 1];
  let frame = 0;
  const mouth = createMouth();
  mouth.attach({ kind: "amplitude", sample: () => levels[frame++] }, 0);
  assert.deepEqual(levels.map((_, i) => mouth.sample(i * 16)), [1, 0, 0.55, 1]);
});

test("a sampler that throws, or returns NaN or Infinity, leaves the mouth shut", () => {
  const mouth = createMouth();
  mouth.attach({ kind: "amplitude", sample: () => { throw new Error("mic lost"); } }, 0);
  assert.equal(mouth.sample(0), 0);
  mouth.attach({ kind: "amplitude", sample: () => Number.NaN }, 0);
  assert.equal(mouth.sample(16), 0);
  mouth.attach({ kind: "amplitude", sample: () => Number.POSITIVE_INFINITY }, 0);
  assert.equal(mouth.sample(32), 0);
});

test("a viseme track opens on each cue, holds it, and shuts 250 ms after the last cue", () => {
  const track = [
    { tMs: 300, viseme: "O" },
    { tMs: 40, viseme: "SS" },
    { tMs: 150, viseme: "aa" },
    { tMs: 500, viseme: "PP" },
    { tMs: 700, viseme: "E" },
  ];
  const mouth = createMouth();
  mouth.attach({ kind: "visemes", track }, 1000);
  assert.equal(mouth.sample(1000), 0, "nothing before the first cue");
  assert.equal(mouth.sample(1039), 0);
  assert.equal(mouth.sample(1040), VISEME_OPEN.SS);
  assert.equal(mouth.sample(1149), VISEME_OPEN.SS, "held until the next cue");
  assert.equal(mouth.sample(1150), VISEME_OPEN.aa);
  assert.equal(mouth.sample(1300), VISEME_OPEN.O);
  assert.equal(mouth.sample(1500), VISEME_OPEN.PP);
  assert.equal(mouth.sample(1700), VISEME_OPEN.E);
  assert.equal(mouth.sample(1949), VISEME_OPEN.E, "still open 249 ms after the last cue");
  assert.equal(mouth.sample(1950), 0, "shut 250 ms after the last cue");
  assert.equal(track[0].tMs, 300, "the caller's track is not reordered");
});

test("an unknown viseme name opens the mouth to 0.3, even one like constructor", () => {
  const mouth = createMouth();
  mouth.attach({ kind: "visemes", track: [{ tMs: 0, viseme: "zz" }] }, 0);
  assert.equal(mouth.sample(0), 0.3);
  mouth.attach({ kind: "visemes", track: [{ tMs: 0, viseme: "constructor" }] }, 0);
  assert.equal(mouth.sample(0), 0.3);
});

test("every viseme in the table is a finite openness between 0 and 1", () => {
  for (const [name, open] of Object.entries(VISEME_OPEN)) assert.ok(inUnitRange(open), name);
});

test("a spoken word pulses the mouth up to 0.8 within 60 ms and back to 0 by 180 ms", () => {
  const words = wordSource();
  const mouth = createMouth();
  mouth.attach(words.driver, 0);
  assert.equal(mouth.sample(0), 0, "no word yet");
  words.say();
  const curve = [0, 15, 30, 45, 60, 90, 120, 150, 179, 180].map((t) => mouth.sample(t));
  const expected = [0, 0.2, 0.4, 0.6, 0.8, 0.6, 0.4, 0.2, 0.8 / 120, 0];
  curve.forEach((v, i) => closeTo(v, expected[i]));
});

test("a second word restarts the pulse from the latest sample time", () => {
  const words = wordSource();
  const mouth = createMouth();
  mouth.attach(words.driver, 0);
  mouth.sample(0);
  words.say();
  closeTo(mouth.sample(100), (0.8 * 80) / 120, "the first pulse is falling");
  words.say();
  closeTo(mouth.sample(130), 0.4, "the second word starts again from 100 ms");
});

test("attaching again or detaching unsubscribes the word source being replaced", () => {
  const first = wordSource(), second = wordSource();
  const mouth = createMouth();
  mouth.attach(first.driver, 0);
  assert.equal(first.unsubscribed(), 0);
  mouth.attach(second.driver, 0);
  assert.equal(first.unsubscribed(), 1, "re-attach drops the old source");
  assert.equal(second.unsubscribed(), 0);
  assert.equal(mouth.active(), true);
  mouth.detach();
  assert.equal(second.unsubscribed(), 1, "detach drops the current source");
  assert.equal(mouth.active(), false);
  mouth.attach(null, 0);
  assert.equal(mouth.active(), false);
});

test("a word from a dropped source cannot pulse the driver that replaced it", () => {
  const old = wordSource(), fresh = wordSource();
  const mouth = createMouth();
  mouth.attach(old.driver, 0);
  mouth.sample(0);
  mouth.attach(fresh.driver, 100);
  old.ghost();
  assert.equal(mouth.sample(110), 0);
});

test("muted, the mouth stays shut for all three kinds of driver, and resumes when unmuted", () => {
  const mouth = createMouth({ muted: true });
  mouth.attach({ kind: "amplitude", sample: () => 0.9 }, 0);
  assert.equal(mouth.sample(0), 0);
  mouth.setMuted(false);
  assert.equal(mouth.sample(16), 0.9);

  mouth.attach({ kind: "visemes", track: [{ tMs: 0, viseme: "aa" }, { tMs: 500, viseme: "sil" }] }, 0);
  mouth.setMuted(true);
  assert.equal(mouth.sample(100), 0);
  mouth.setMuted(false);
  assert.equal(mouth.sample(200), VISEME_OPEN.aa, "the track picks up where the clock is");

  const words = wordSource();
  mouth.attach(words.driver, 0);
  mouth.setMuted(true);
  mouth.sample(100);
  words.say();
  assert.equal(mouth.sample(130), 0);
  mouth.setMuted(false);
  words.say();
  closeTo(mouth.sample(160), 0.4, "a word heard after unmuting pulses");
});

test("every sampled value stays finite and between 0 and 1 over a few hundred steps of each kind", () => {
  const mouth = createMouth();
  let n = 0;
  mouth.attach({ kind: "amplitude", sample: () => { n += 1; return n % 7 === 0 ? Number.NaN : Math.sin(n * 0.37) * 3; } }, 0);
  for (let t = 0; t < 400 * 16; t += 16) assert.ok(inUnitRange(mouth.sample(t)), `amplitude at ${t}`);

  const track = [{ tMs: 40, viseme: "FF" }, { tMs: 0, viseme: "aa" }, { tMs: 900, viseme: "O" }, { tMs: 1200, viseme: "nope" }];
  mouth.attach({ kind: "visemes", track }, 0);
  for (let t = -200; t < 2000; t += 7) assert.ok(inUnitRange(mouth.sample(t)), `visemes at ${t}`);

  const words = wordSource();
  mouth.attach(words.driver, 0);
  for (let t = 0; t < 1000; t += 3) {
    if (t % 200 === 0) words.say();
    assert.ok(inUnitRange(mouth.sample(t)), `boundary at ${t}`);
  }
});

test("the mouth module imports nothing and reaches for no globals, network or clock", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "companion-motion", "mouth-driver.ts");
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /^import\b/m);
  assert.doesNotMatch(source, /\b(fetch|localStorage|document|window|supabase|requestAnimationFrame|Date\.now|performance\.now|Math\.random)\b/);
  assert.doesNotMatch(source, /—/, "no em dashes");
});
