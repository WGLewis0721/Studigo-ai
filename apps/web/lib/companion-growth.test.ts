import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMPANION_EVENTS, OUTFITS, type CompanionEvent, type Outfit } from "./companion-logic";
import { VIGNETTES } from "./companion-motion/beats";
import {
  EMPTY_GROWTH,
  GROWTH_MAX,
  GROWTH_POINTS,
  GROWTH_STAGES,
  POINTS_PER_TASK,
  STARTER_TRICKS,
  UNLOCKS,
  addGrowth,
  availableOutfits,
  availableTricks,
  flameStage,
  isUnlocked,
  markSeen,
  newlyUnlocked,
  nextUnlock,
  parseGrowth,
  stage,
  unlocked,
  type Growth
} from "./companion-growth";

const here = dirname(fileURLToPath(import.meta.url));
const LAST_AT = Math.max(...UNLOCKS.map((item) => item.at));

/** Deterministic PRNG so the 10,000-sequence test is repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function repeat(growth: Growth, event: CompanionEvent, count: number): Growth {
  let next = growth;
  for (let i = 0; i < count; i += 1) next = addGrowth(next, event);
  return next;
}

function unlockPoints(id: string): number {
  const item = UNLOCKS.find((unlock) => unlock.id === id);
  assert.ok(item, `no unlock named ${id}`);
  return item.at;
}

test("every committed learning event adds the points set for it in the growth table", () => {
  for (const event of COMPANION_EVENTS) {
    assert.equal(addGrowth(EMPTY_GROWTH, event).points, GROWTH_POINTS[event], `${event} earned the wrong points`);
  }
});

test("the growth table lists every event, with whole non-negative points", () => {
  assert.deepEqual(Object.keys(GROWTH_POINTS).sort(), [...COMPANION_EVENTS].sort());
  for (const points of Object.values(GROWTH_POINTS)) {
    assert.ok(Number.isInteger(points) && points >= 0, `bad points value ${points}`);
  }
});

test("hints and stalls earn nothing, so addGrowth hands back the same object", () => {
  for (const event of ["hintOpened", "stall"] as const) {
    assert.equal(GROWTH_POINTS[event], 0);
    assert.equal(addGrowth(EMPTY_GROWTH, event), EMPTY_GROWTH);
  }
});

test("growth never decreases over 10,000 random event sequences", () => {
  const next = rng(20261120);
  for (let run = 0; run < 10_000; run += 1) {
    let growth = EMPTY_GROWTH;
    for (let step = 0; step < 25; step += 1) {
      const event = COMPANION_EVENTS[Math.floor(next() * COMPANION_EVENTS.length)];
      const updated = addGrowth(growth, event);
      assert.ok(updated.points >= growth.points, `${event} lowered growth from ${growth.points} to ${updated.points}`);
      assert.ok(updated.points <= GROWTH_MAX, "growth passed its maximum");
      assert.deepEqual(updated.seen, growth.seen);
      growth = updated;
    }
  }
});

test("points stop at the maximum instead of passing it", () => {
  const nearMax: Growth = { v: 1, points: GROWTH_MAX - 1, seen: [] };
  assert.equal(addGrowth(nearMax, "missionComplete").points, GROWTH_MAX);
  const atMax: Growth = { v: 1, points: GROWTH_MAX, seen: [] };
  assert.equal(addGrowth(atMax, "setDone"), atMax);
});

test("the first completed set unlocks the first outfit and nothing else", () => {
  const first = addGrowth(EMPTY_GROWTH, "setDone");
  assert.deepEqual(availableOutfits(EMPTY_GROWTH.points), []);
  assert.deepEqual(availableOutfits(first.points), ["goggles"]);
  assert.deepEqual(newlyUnlocked(first), ["outfit:goggles"]);
  assert.equal(isUnlocked(first.points, "trick:sniff"), false);
});

test("every outfit unlocks at its own threshold and all seven are on the track", () => {
  assert.deepEqual(
    UNLOCKS.filter((item) => item.kind === "outfit").map((item) => item.value).sort(),
    [...OUTFITS].sort()
  );
  assert.deepEqual(availableOutfits(LAST_AT), [...OUTFITS]);
  for (const item of UNLOCKS.filter((unlock) => unlock.kind === "outfit")) {
    assert.ok(availableOutfits(item.at).includes(item.value as Outfit), `${item.value} is missing at ${item.at}`);
    assert.ok(!availableOutfits(item.at - 1).includes(item.value as Outfit), `${item.value} came early`);
  }
});

test("every non-starter idle trick is reachable and the starter pair is always available", () => {
  assert.deepEqual(availableTricks(0), [...STARTER_TRICKS]);
  for (const trick of VIGNETTES) {
    assert.ok(availableTricks(LAST_AT).includes(trick), `${trick} never unlocks`);
  }
  const nonStarter = VIGNETTES.filter((trick) => !STARTER_TRICKS.includes(trick)).sort();
  const earned = UNLOCKS.filter((item) => item.kind === "trick").map((item) => item.value).sort();
  assert.deepEqual(earned, nonStarter);
});

test("every unlock names a real outfit, trick or flame stage with a matching id", () => {
  for (const item of UNLOCKS) {
    assert.equal(item.id, `${item.kind}:${item.value}`);
    if (item.kind === "outfit") assert.ok((OUTFITS as readonly string[]).includes(item.value), item.id);
    if (item.kind === "trick") assert.ok((VIGNETTES as readonly string[]).includes(item.value), item.id);
    if (item.kind === "flame") assert.ok(["warm", "bright", "blazing"].includes(item.value), item.id);
  }
});

test("unlock thresholds rise strictly, and the gaps between them never shrink", () => {
  assert.equal(UNLOCKS[0].id, "flame:warm");
  assert.equal(UNLOCKS[0].at, 0);
  assert.equal(new Set(UNLOCKS.map((item) => item.id)).size, UNLOCKS.length, "unlock ids must be unique");
  const gaps = UNLOCKS.slice(1).map((item, i) => item.at - UNLOCKS[i].at);
  gaps.forEach((gap, i) => {
    assert.ok(gap > 0, `unlock ${i + 1} does not come after the one before it`);
    if (i > 0) assert.ok(gap >= gaps[i - 1], `gap ${gap} after ${gaps[i - 1]} shrinks`);
  });
});

test("the flame starts warm, turns bright and then blazes", () => {
  assert.equal(flameStage(0), "warm");
  assert.equal(flameStage(unlockPoints("flame:bright") - 1), "warm");
  assert.equal(flameStage(unlockPoints("flame:bright")), "bright");
  assert.equal(flameStage(unlockPoints("flame:blazing") - 1), "bright");
  assert.equal(flameStage(unlockPoints("flame:blazing")), "blazing");
});

test("unlocked lists only what the points have reached, in unlock order", () => {
  assert.deepEqual(unlocked(0), ["flame:warm"]);
  assert.deepEqual(unlocked(5), ["flame:warm", "outfit:goggles"]);
});

test("isUnlocked counts the starter tricks as always available", () => {
  assert.equal(isUnlocked(0, "trick:tailChase"), true);
  assert.equal(isUnlocked(0, "trick:sniff"), false);
  assert.equal(isUnlocked(unlockPoints("trick:sniff"), "trick:sniff"), true);
  assert.equal(isUnlocked(LAST_AT, "outfit:unknown"), false);
});

test("nextUnlock counts down in points and tasks, and is null once everything is unlocked", () => {
  const first = nextUnlock(0);
  assert.equal(first?.unlock.id, "outfit:goggles");
  assert.equal(first?.remainingPoints, 5);
  assert.equal(first?.remainingTasks, 3);
  for (let points = 0; points < LAST_AT; points += 1) {
    const next = nextUnlock(points);
    assert.ok(next, `nothing next at ${points} points`);
    assert.ok(next.unlock.at > points);
    assert.equal(next.remainingPoints, next.unlock.at - points);
    assert.equal(next.remainingTasks, Math.ceil(next.remainingPoints / POINTS_PER_TASK));
  }
  assert.equal(nextUnlock(LAST_AT), null);
});

test("newly unlocked items are reported once and then marked seen", () => {
  const first = addGrowth(EMPTY_GROWTH, "setDone");
  const seen = markSeen(first, ["outfit:goggles"]);
  assert.deepEqual(seen.seen, ["outfit:goggles"]);
  assert.deepEqual(newlyUnlocked(seen), []);
  assert.equal(markSeen(seen, ["outfit:goggles"]), seen);
  assert.equal(markSeen(seen, ["outfit:unknown"]), seen);
  assert.deepEqual(newlyUnlocked(repeat(seen, "correct", 10)), ["trick:sniff"]);
});

test("starting items are never new", () => {
  assert.deepEqual(newlyUnlocked(EMPTY_GROWTH), []);
  assert.deepEqual(newlyUnlocked({ v: 1, points: 4, seen: [] }), []);
});

test("growth stages run Hatchling to Legend, each starting on an unlock", () => {
  assert.deepEqual(GROWTH_STAGES, [
    { name: "Hatchling", at: 0 },
    { name: "Sprout", at: 15 },
    { name: "Explorer", at: 55 },
    { name: "Scholar", at: 135 },
    { name: "Adventurer", at: 275 },
    { name: "Champion", at: 530 },
    { name: "Legend", at: 945 }
  ]);
  for (const { at } of GROWTH_STAGES) {
    assert.ok(UNLOCKS.some((item) => item.at === at), `stage at ${at} starts on no unlock`);
  }
});

test("stage() returns the stage index for each threshold", () => {
  const cases: [number, number][] = [
    [0, 0], [14, 0], [15, 1], [54, 1], [55, 2], [134, 2], [135, 3],
    [274, 3], [275, 4], [529, 4], [530, 5], [944, 5], [945, 6], [GROWTH_MAX, 6]
  ];
  for (const [points, index] of cases) assert.equal(stage(points), index, `points ${points}`);
});

test("parseGrowth falls back to empty growth for missing or malformed saves", () => {
  for (const raw of [null, undefined, "", "not json", "[]", "5", "null", "\"text\""]) {
    assert.deepEqual(parseGrowth(raw), EMPTY_GROWTH, `raw ${String(raw)}`);
  }
});

test("parseGrowth treats bad points as zero and drops unknown seen ids", () => {
  assert.equal(parseGrowth('{"v":1,"points":-4,"seen":[]}').points, 0);
  assert.equal(parseGrowth('{"v":1,"points":null,"seen":[]}').points, 0);
  assert.equal(parseGrowth('{"v":1,"points":"12","seen":[]}').points, 0);
  assert.equal(parseGrowth('{"v":1,"points":12.7,"seen":[]}').points, 12);
  assert.equal(parseGrowth('{"v":1,"points":1e9,"seen":[]}').points, GROWTH_MAX);
  assert.deepEqual(
    parseGrowth('{"v":1,"points":30,"seen":["outfit:goggles","outfit:nope",5,null,"outfit:goggles"]}'),
    { v: 1, points: 30, seen: ["outfit:goggles"] }
  );
});

test("a save from another version keeps its valid points and forgets what was seen", () => {
  assert.deepEqual(parseGrowth('{"v":2,"points":40,"seen":["outfit:goggles"]}'), { v: 1, points: 40, seen: [] });
  assert.deepEqual(parseGrowth('{"points":40}'), { v: 1, points: 40, seen: [] });
  assert.equal(parseGrowth('{"v":2,"points":-1}').points, 0);
});

test("growth round-trips through JSON", () => {
  const growth: Growth = { v: 1, points: 130, seen: ["outfit:goggles", "trick:sniff"] };
  assert.deepEqual(parseGrowth(JSON.stringify(growth)), growth);
});

test("the growth module imports only companion-logic and touches no storage, network, clock, randomness, mastery, grading or progress code", () => {
  const source = readFileSync(join(here, "companion-growth.ts"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.deepEqual(imports, ["./companion-logic"]);
  const forbidden = source.match(/fetch|localStorage|document|window|supabase|Date\.now|performance\.now|Math\.random|mastery|grade|progress/i);
  assert.equal(forbidden, null, `forbidden text: ${forbidden?.[0]}`);
});
