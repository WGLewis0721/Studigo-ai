import assert from "node:assert/strict";
import test from "node:test";
import { ROOM_SHELLS } from "./room-shell";
import { ROOM_THEMES } from "./room-theme";

test("every default room color can be shown as selected in the picker", () => {
  const ids: string[] = ROOM_THEMES.map((item) => item.id);
  for (const shell of ROOM_SHELLS) assert.ok(ids.includes(shell), `${shell} is missing from the picker`);
});

test("theme ids are unique", () => {
  const ids = ROOM_THEMES.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});
