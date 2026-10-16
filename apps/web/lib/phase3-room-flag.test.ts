import { test } from "node:test";
import assert from "node:assert/strict";
import { phase3UiEnabledForRoom, guidedLearnCanaryEnabledForRoom } from "./phase3-room-flag";

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


test("Guided Learn canary never activates globally or without explicit room opt-in", () => {
  const ids = "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222";
  const roomA = "11111111-1111-4111-8111-111111111111";
  const outside = "33333333-3333-4333-8333-333333333333";
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "1", ids), true);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, undefined, ids), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "0", ids), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "true", ids), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(outside, "1", ids), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "1", undefined), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "1", ""), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA, "1", "*"), false);
  assert.equal(guidedLearnCanaryEnabledForRoom(roomA.slice(0, -1), "1", ids), false);
});
