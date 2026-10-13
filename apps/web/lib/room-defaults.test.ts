import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ROOM_TITLE, inferRoomTitle, nameRoomFromTopics, roomTitleOrDefault } from "./room-defaults";

const topic = (title: string, priority = 80) => ({ title, priority });

test("the default title fills in only when nothing was typed", () => {
  for (const typed of [undefined, null, "", "   ", "\n\t"]) assert.equal(roomTitleOrDefault(typed), DEFAULT_ROOM_TITLE);
  assert.equal(roomTitleOrDefault("Biology Midterm"), "Biology Midterm");
  assert.equal(roomTitleOrDefault("  Biology Midterm  "), "Biology Midterm");
});

test("an inferred title comes from the two most testable topics", () => {
  const title = inferRoomTitle([topic("Background reading", 20), topic("Photosynthesis", 95), topic("Cell respiration", 90)]);
  assert.equal(title, "Photosynthesis, Cell respiration");
  assert.equal(inferRoomTitle([topic("Mitosis"), topic("mitosis")]), "Mitosis");
});

test("an inferred title is trimmed, plain and bounded", () => {
  assert.equal(inferRoomTitle([topic("  1) The   French\nRevolution:  ")]), "The French Revolution");
  assert.equal(inferRoomTitle([topic("- Cell structure.")]), "Cell structure");

  const marked = inferRoomTitle([topic("<script>alert(1)</script>Cell <b>structure</b>"), topic("**Osmosis**")]);
  assert.equal(marked, "alert(1) Cell structure, Osmosis");
  assert.doesNotMatch(marked ?? "", /[<>*`]/);

  assert.equal(inferRoomTitle([topic("See [the notes](https://example.test/x) for Osmosis")]), "See the notes for Osmosis");
  assert.equal(inferRoomTitle([topic("Unclosed <img src=x onerror=alert(1)")]), "Unclosed");
  assert.equal(inferRoomTitle([topic("Cell‮structure​\u0000 basics")]), "Cell structure basics");

  const long = inferRoomTitle([topic("word ".repeat(40))]) ?? "";
  assert.ok(Array.from(long).length <= 60, long);
  assert.ok(long.endsWith("…"));

  const emoji = inferRoomTitle([topic("🧬".repeat(80))]) ?? "";
  assert.ok(Array.from(emoji).length <= 60);
  assert.ok(emoji.isWellFormed());
});

test("nothing usable means no inferred title, and the default text is never re-suggested", () => {
  assert.equal(inferRoomTitle([]), null);
  assert.equal(inferRoomTitle([topic("   "), topic("<b></b>"), topic("---"), topic("...")]), null);
  assert.equal(inferRoomTitle([topic(DEFAULT_ROOM_TITLE), topic("my study room.")]), null);
});

type Row = { id: string; owner_id: string; title: string; subject: string | null };

function fakeRooms(rows: Row[]) {
  const db = {
    from(table: string) {
      assert.equal(table, "study_rooms");
      const filters: Array<(row: Row) => boolean> = [];
      let patch: Partial<Row> = {};
      const builder = {
        update(values: Partial<Row>) { patch = values; return builder; },
        eq(column: keyof Row, value: unknown) { filters.push((row) => row[column] === value); return builder; },
        is(column: keyof Row, value: null) { filters.push((row) => row[column] === value); return builder; },
        then(resolve: (value: { error: null }) => void) {
          for (const row of rows) if (filters.every((match) => match(row))) Object.assign(row, patch);
          resolve({ error: null });
        }
      };
      return builder;
    }
  };
  return db as unknown as Pick<SupabaseClient, "from">;
}

test("a learner-typed title or subject is never replaced by an inferred one", async () => {
  const rows: Row[] = [
    { id: "untouched", owner_id: "me", title: DEFAULT_ROOM_TITLE, subject: null },
    { id: "typed-title", owner_id: "me", title: "My Bio Final", subject: null },
    { id: "typed-subject", owner_id: "me", title: DEFAULT_ROOM_TITLE, subject: "Biology" },
    { id: "someone-elses", owner_id: "them", title: DEFAULT_ROOM_TITLE, subject: null }
  ];
  const topics = [topic("Photosynthesis", 95)];

  for (const roomId of ["typed-title", "typed-subject"]) await nameRoomFromTopics(fakeRooms(rows), { roomId, ownerId: "me", topics });
  assert.deepEqual(rows.map((row) => row.title), [DEFAULT_ROOM_TITLE, "My Bio Final", DEFAULT_ROOM_TITLE, DEFAULT_ROOM_TITLE]);

  await nameRoomFromTopics(fakeRooms(rows), { roomId: "someone-elses", ownerId: "me", topics });
  assert.equal(rows[3].title, DEFAULT_ROOM_TITLE);

  await nameRoomFromTopics(fakeRooms(rows), { roomId: "untouched", ownerId: "me", topics });
  assert.equal(rows[0].title, "Photosynthesis");
  assert.deepEqual(rows.map((row) => row.subject), [null, null, "Biology", null]);

  await nameRoomFromTopics(fakeRooms(rows), { roomId: "untouched", ownerId: "me", topics: [topic("Osmosis")] });
  assert.equal(rows[0].title, "Photosynthesis");
});

test("no write is attempted when no title can be inferred", async () => {
  const db = { from() { throw new Error("no write expected"); } } as unknown as Pick<SupabaseClient, "from">;
  await nameRoomFromTopics(db, { roomId: "r", ownerId: "o", topics: [topic("<b></b>")] });
});
