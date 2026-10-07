import assert from "node:assert/strict";
import { test } from "node:test";
import { isUuid } from "./ids";

test("isUuid accepts only a canonical uuid", () => {
  assert.equal(isUuid("00000000-0000-4000-8000-000000000001"), true);
  assert.equal(isUuid("00000000-0000-4000-8000-000000000001 "), false);
  assert.equal(isUuid("not-an-id"), false);
  assert.equal(isUuid(null), false);
});
