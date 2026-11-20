import assert from "node:assert/strict";
import { test } from "node:test";
import { STALL_LEVEL1_MS, STALL_LEVEL2_MS, createStallTimer, type StallLevel, type StallTimer } from "./companion-stall";

const L1 = STALL_LEVEL1_MS;
const L2 = STALL_LEVEL2_MS;

function harness(options: { closeOnFirstLevel?: boolean } = {}) {
  const clock = { t: 0 };
  const fired: { level: StallLevel; at: number }[] = [];
  const timer: StallTimer = createStallTimer({
    now: () => clock.t,
    onStall: (level) => {
      fired.push({ level, at: clock.t });
      if (level === 1 && options.closeOnFirstLevel) timer.close();
    }
  });
  return {
    timer,
    fired,
    levels: () => fired.map((event) => event.level),
    at(ms: number) { clock.t = ms; timer.tick(); },
    set(ms: number, action: () => void) { clock.t = ms; action(); }
  };
}

test("placeholder thresholds sit in the approved range, and level 2 is twice level 1", () => {
  assert.ok(STALL_LEVEL1_MS >= 20_000 && STALL_LEVEL1_MS <= 45_000);
  assert.equal(STALL_LEVEL2_MS, 2 * STALL_LEVEL1_MS);
});

test("fires level 1 at its threshold and level 2 at twice that", () => {
  const h = harness();
  h.timer.open("q1");
  h.at(L1 - 1);
  assert.deepEqual(h.levels(), []);
  h.at(L1);
  assert.deepEqual(h.levels(), [1]);
  h.at(L2 - 1);
  assert.deepEqual(h.levels(), [1]);
  h.at(L2);
  assert.deepEqual(h.levels(), [1, 2]);
});

test("each level fires once per open beat, however long it stays open", () => {
  const h = harness();
  h.timer.open("q1");
  for (let t = 0; t <= 10 * L2; t += 1000) h.at(t);
  assert.deepEqual(h.levels(), [1, 2]);
});

test("activity restarts the idle clock", () => {
  const h = harness();
  h.timer.open("q1");
  h.set(25_000, () => h.timer.activity());
  h.at(L1);
  assert.deepEqual(h.levels(), []);
  h.at(25_000 + L1 - 1);
  assert.deepEqual(h.levels(), []);
  h.at(25_000 + L1);
  assert.deepEqual(h.levels(), [1]);
});

test("activity after level 1 does not repeat level 1, and pushes level 2 out", () => {
  const h = harness();
  h.timer.open("q1");
  h.at(L1);
  h.set(40_000, () => h.timer.activity());
  h.at(40_000 + L2 - 1);
  assert.deepEqual(h.levels(), [1]);
  h.at(40_000 + L2);
  assert.deepEqual(h.levels(), [1, 2]);
});

test("never fires once closed, and activity on a closed beat changes nothing", () => {
  const h = harness();
  h.timer.open("q1");
  h.set(10_000, () => h.timer.close());
  h.set(20_000, () => h.timer.activity());
  h.at(10 * L2);
  assert.deepEqual(h.levels(), []);
});

test("never fires before any beat is opened", () => {
  const h = harness();
  h.at(10 * L2);
  assert.deepEqual(h.levels(), []);
});

test("a different beat starts its own clock and fires its own levels", () => {
  const h = harness();
  h.timer.open("q1");
  h.at(L1);
  h.set(35_000, () => h.timer.open("q2"));
  h.at(35_000 + L1 - 1);
  assert.deepEqual(h.levels(), [1]);
  h.at(35_000 + L1);
  assert.deepEqual(h.levels(), [1, 1]);
  h.at(35_000 + L2);
  assert.deepEqual(h.levels(), [1, 1, 2]);
});

test("opening the beat that is already showing does not reset its clock", () => {
  const h = harness();
  h.timer.open("q1");
  h.set(20_000, () => h.timer.open("q1"));
  h.at(L1);
  assert.deepEqual(h.levels(), [1]);
});

test("a closed beat that is opened again starts a fresh showing", () => {
  const h = harness();
  h.timer.open("q1");
  h.at(L1);
  h.set(31_000, () => h.timer.close());
  h.set(40_000, () => h.timer.open("q1"));
  h.at(40_000 + L1 - 1);
  assert.deepEqual(h.levels(), [1]);
  h.at(40_000 + L1);
  assert.deepEqual(h.levels(), [1, 1]);
});

test("uneven tick intervals fire each level at the first tick past its threshold", () => {
  const h = harness();
  h.timer.open("q1");
  for (const t of [4_000, 11_500, 19_000, 29_900, 30_400, 41_000, 58_000, 60_200, 61_000, 130_000]) h.at(t);
  assert.deepEqual(h.fired, [{ level: 1, at: 30_400 }, { level: 2, at: 60_200 }]);
});

test("one late tick that finds both levels overdue fires them in order", () => {
  const h = harness();
  h.timer.open("q1");
  h.at(3 * L1);
  assert.deepEqual(h.levels(), [1, 2]);
});

test("closing the beat from its level 1 callback stops level 2 in the same tick", () => {
  const h = harness({ closeOnFirstLevel: true });
  h.timer.open("q1");
  h.at(L2);
  assert.deepEqual(h.levels(), [1]);
  h.at(10 * L2);
  assert.deepEqual(h.levels(), [1]);
});
