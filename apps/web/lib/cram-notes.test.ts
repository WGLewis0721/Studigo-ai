import assert from "node:assert/strict";
import test from "node:test";
import { compactCramNotes } from "./cram-notes";

test("cram keeps facts from the cited lesson and drops exercises", () => {
  const text = "## Election\nCitizens choose a candidate during an election. Electors cast votes after Election Day.\nCheck your understanding: Who are electors?\n- The Electoral College chooses the president.";
  const notes = compactCramNotes(text);
  assert.match(notes, /Citizens choose a candidate/);
  assert.match(notes, /Electoral College chooses/);
  assert.doesNotMatch(notes, /Check your understanding|Who are electors/);
});
