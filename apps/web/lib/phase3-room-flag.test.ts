import { test } from "node:test";
import assert from "node:assert/strict";
import { phase3UiEnabledForRoom } from "./phase3-room-flag";

test("Phase 3 uses the established global default if no room override exists", () => {
  assert.equal(phase3UiEnabledForRoom("room-a", undefined, true), true);
  assert.equal(phase3UiEnabledForRoom("room-a", undefined, false), false);
});

test("Phase 3 room allowlist enables only explicit room IDs, ignoring whitespace", () => {
  assert.equal(phase3UiEnabledForRoom("room-a", " room-a,room-b ", false), true);
  assert.equal(phase3UiEnabledForRoom("room-b", " room-a,room-b ", false), true);
  assert.equal(phase3UiEnabledForRoom("room-c", " room-a,room-b ", true), false);
});

test("Empty per-room allowlist fails safely closed and overrides global rollout", () => {
  assert.equal(phase3UiEnabledForRoom("room-a", "", true), false);
  assert.equal(phase3UiEnabledForRoom("room-a", " , ", true), false);
  assert.equal(phase3UiEnabledForRoom("", ",", true), false);
});

test("Room matching is exact, not prefix, wildcard or substring based", () => {
  assert.equal(phase3UiEnabledForRoom("abc", "abcdef,xyz", true), false);
  assert.equal(phase3UiEnabledForRoom("abc", "*", true), false);
  assert.equal(phase3UiEnabledForRoom("abc", "abc", false), true);
});
