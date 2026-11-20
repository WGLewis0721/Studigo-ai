import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_GROWTH, FLAME_BOOST, GROWTH_STAGES, TRICK_LABELS, UNLOCKS, growthView, studyTasks, unlockLabel, wearableOutfit, type Growth } from "./companion-growth";
import { OUTFIT_LABELS, OUTFITS } from "./companion-logic";
import { GROWTH_KEY, loadGrowth, readGrowth, saveGrowth, writeGrowth } from "./companion-growth-store";

function fakeStore(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, String(value)); }
  };
}

const blocked = {
  getItem: () => { throw new Error("storage is blocked"); },
  setItem: () => { throw new Error("quota exceeded"); }
};

test("the growth key is device-wide and named for the companion", () => {
  assert.equal(GROWTH_KEY, "studigo.companion.growth");
});

test("growth round-trips through an injected store, under the growth key", () => {
  const store = fakeStore();
  const growth: Growth = { v: 1, points: 130, seen: ["outfit:goggles", "trick:sniff"] };
  assert.equal(saveGrowth(store, growth), true);
  assert.equal(store.items.get(GROWTH_KEY), JSON.stringify(growth));
  assert.deepEqual(loadGrowth(store), growth);
});

test("a missing, empty or malformed save reads as empty growth", () => {
  assert.deepEqual(loadGrowth(fakeStore()), EMPTY_GROWTH);
  assert.deepEqual(loadGrowth(fakeStore({ [GROWTH_KEY]: "not json" })), EMPTY_GROWTH);
  assert.deepEqual(loadGrowth(fakeStore({ [GROWTH_KEY]: "[]" })), EMPTY_GROWTH);
});

test("a save from another version keeps its points and forgets what was seen", () => {
  const store = fakeStore({ [GROWTH_KEY]: '{"v":2,"points":40,"seen":["outfit:goggles"]}' });
  assert.deepEqual(loadGrowth(store), { v: 1, points: 40, seen: [] });
});

test("blocked storage never throws: reads are empty and writes report that nothing was kept", () => {
  assert.deepEqual(loadGrowth(blocked), EMPTY_GROWTH);
  assert.equal(saveGrowth(blocked, { v: 1, points: 9, seen: [] }), false);
  assert.deepEqual(loadGrowth(null), EMPTY_GROWTH);
  assert.equal(saveGrowth(null, { v: 1, points: 9, seen: [] }), false);
});

test("outside a browser there is no device store, so reads are empty and writes do nothing", () => {
  assert.deepEqual(readGrowth(), EMPTY_GROWTH);
  assert.doesNotThrow(() => writeGrowth({ v: 1, points: 9, seen: [] }));
  assert.deepEqual(readGrowth(), EMPTY_GROWTH);
});

test("the flame boosts are warm 1, bright 1.15 and blazing 1.3", () => {
  assert.deepEqual(FLAME_BOOST, { warm: 1, bright: 1.15, blazing: 1.3 });
});

test("the first view: Hatchling, nothing bought yet, and the goggles are three tasks away", () => {
  const view = growthView(0);
  assert.equal(view.stageLabel, `Stage 1 of ${GROWTH_STAGES.length}: Hatchling`);
  assert.equal(view.fill, 0);
  assert.equal(view.line, "3 more study tasks until the Science goggles!");
  assert.equal(view.flame, "warm");
  assert.ok(OUTFITS.every((outfit) => !view.outfits[outfit].unlocked));
  assert.equal(view.outfits.goggles.tasksLeft, 3);
  assert.deepEqual(view.tricks.filter((item) => item.unlocked).map((item) => item.value), ["tailChase", "sitWag"]);
});

test("the bar fills between the last unlock and the next one, and the line counts the tasks left", () => {
  const view = growthView(10);
  assert.equal(view.fill, 0.5, "10 points sit halfway between goggles (5) and sniff (15)");
  assert.equal(view.line, "3 more study tasks until he learns Sniff!");
  assert.equal(growthView(14).line, "1 more study task until he learns Sniff!");
});

test("the outfits: each one is unlocked at its own threshold, with the tasks still to go", () => {
  const view = growthView(30);
  assert.equal(view.outfits.explorer.unlocked, true);
  assert.equal(view.outfits.visor.unlocked, false);
  assert.equal(view.outfits.visor.tasksLeft, 30);
});

test("every trick shows as known or coming, with the tasks still to go for the ones coming", () => {
  const view = growthView(60);
  assert.deepEqual(view.tricks.map((item) => [item.value, item.unlocked]), [
    ["tailChase", true], ["sitWag", true], ["sniff", true], ["doubleTake", true], ["stretch", false]
  ]);
  const stretch = view.tricks.find((item) => item.value === "stretch");
  assert.equal(stretch?.tasksLeft, Math.ceil((275 - 60) / 2));
  assert.equal(stretch?.label, TRICK_LABELS.stretch);
});

test("the top of the track: Legend, a full bar, and everything unlocked", () => {
  const view = growthView(UNLOCKS[UNLOCKS.length - 1].at);
  assert.equal(view.stageLabel, `Stage ${GROWTH_STAGES.length} of ${GROWTH_STAGES.length}: Legend`);
  assert.equal(view.fill, 1);
  assert.equal(view.line, "Everything is unlocked. He is a Legend!");
  assert.equal(view.flame, "blazing");
  assert.ok(OUTFITS.every((outfit) => view.outfits[outfit].unlocked && view.outfits[outfit].tasksLeft === 0));
  assert.ok(view.tricks.every((item) => item.unlocked));
});

test("study task counts are singular for one and plural otherwise", () => {
  assert.equal(studyTasks(1), "1 more study task");
  assert.equal(studyTasks(3), "3 more study tasks");
});

test("every unlock has a child-facing name, and outfits use their menu labels", () => {
  for (const item of UNLOCKS) assert.ok(unlockLabel(item).length > 0, item.id);
  for (const outfit of OUTFITS) {
    const unlock = UNLOCKS.find((item) => item.id === `outfit:${outfit}`);
    assert.equal(unlock && unlockLabel(unlock), OUTFIT_LABELS[outfit]);
  }
});

test("a saved outfit is worn only once growth has reached it", () => {
  assert.equal(wearableOutfit(0, "explorer"), null, "a reset save shows no outfit");
  assert.equal(wearableOutfit(30, "explorer"), "explorer");
  assert.equal(wearableOutfit(999, null), null);
});
