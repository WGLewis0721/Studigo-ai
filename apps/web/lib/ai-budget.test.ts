import assert from "node:assert/strict";
import test from "node:test";
import { reindexCooldownElapsed, withinBudget } from "./ai-budget";

test("a budget denies the call that would pass the cap", () => {
  assert.equal(withinBudget({ calls: 200, tokens: 10 }, { calls: 200, tokens: 100 }), true);
  assert.equal(withinBudget({ calls: 201, tokens: 10 }, { calls: 200, tokens: 100 }), false);
  assert.equal(withinBudget({ calls: 1, tokens: 101 }, { calls: 200, tokens: 100 }), false);
});

test("a second reindex inside the cooldown does not start", () => {
  const now = 1_000_000;
  assert.equal(reindexCooldownElapsed(now - 60_000, now, 15 * 60 * 1000), false);
  assert.equal(reindexCooldownElapsed(now - 15 * 60 * 1000, now, 15 * 60 * 1000), true);
  assert.equal(reindexCooldownElapsed(now, now, 0), true);
});
