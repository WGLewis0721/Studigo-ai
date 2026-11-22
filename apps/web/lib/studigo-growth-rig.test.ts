import assert from "node:assert/strict";
import test from "node:test";
import { GROWTH_MAX, GROWTH_STAGES, growthFraction } from "./companion-growth";

test("the rig's growth input runs from 0 at the first stage to 1 at the last", () => {
  assert.equal(growthFraction(0), 0);
  assert.equal(growthFraction(GROWTH_MAX), 1);
  assert.equal(growthFraction(GROWTH_STAGES[3].at), 3 / (GROWTH_STAGES.length - 1));
  let last = -1;
  for (const item of GROWTH_STAGES) { const value = growthFraction(item.at); assert.ok(value > last); last = value; }
});
