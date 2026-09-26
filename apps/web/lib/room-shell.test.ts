import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOM_SHELLS, roomShellFor } from "./room-shell";

test("a room keeps the same shell color every time", () => {
  const id = "5f0c2a8e-3d1b-4c7a-9e21-6b8f0d4a1c33";
  assert.equal(roomShellFor(id), roomShellFor(id));
});

test("shell colors come from the named palette", () => {
  for (const id of ["", "fixture", "a", "room-42"]) {
    assert.ok(ROOM_SHELLS.includes(roomShellFor(id)));
  }
});

test("different rooms spread across the palette", () => {
  const seen = new Set(
    Array.from({ length: 60 }, (_, index) => roomShellFor(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`))
  );
  assert.ok(seen.size >= 4, `expected a spread of shells, saw ${[...seen].join(", ")}`);
});
