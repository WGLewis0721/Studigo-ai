import assert from "node:assert/strict";
import { test } from "node:test";
import { studigoTouchRegion } from "./studigo-touch";

test("character regions follow the canonical artboard rather than the entire button", () => {
  assert.equal(studigoTouchRegion(0.46, 0.29), "head");
  assert.equal(studigoTouchRegion(0.5, 0.72), "belly");
  assert.equal(studigoTouchRegion(0.1, 0.15), "outside");
  assert.equal(studigoTouchRegion(0.5, 0.51), "belly");
});
