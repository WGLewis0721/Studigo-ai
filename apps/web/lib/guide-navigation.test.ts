import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guideNavigationIntent, retrieveGuideNavigationChunks } from "./guide-navigation";

const ROOM = "11111111-1111-4111-8111-111111111111";
const OTHER_ROOM = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";
const DOC = "44444444-4444-4444-8444-444444444444";
const OTHER_DOC = "55555555-5555-4555-8555-555555555555";
const documents = [
  { id: DOC, room_id: ROOM, owner_id: OWNER, name: "Study guide .pdf", source_type: "study_guide",
    source_priority: 100, page_label: "page", status: "ready", created_at: "2026-10-14T14:00:00Z" },
  { id: OTHER_DOC, room_id: OTHER_ROOM, owner_id: OWNER, name: "Private.pdf", source_type: "study_guide",
    source_priority: 100, page_label: "page", status: "ready", created_at: "2026-10-14T14:00:01Z" },
  { id: "pending", room_id: ROOM, owner_id: OWNER, name: "not-ready.pdf", source_type: "study_guide",
    source_priority: 100, page_label: "page", status: "processing", created_at: "2026-10-14T14:00:02Z" }
];
const rows = [
  { id: "page1", document_id: DOC, room_id: ROOM, chunk_index: 0, page_number: 1,
    page_label: "page", content: "Our Government Vocabulary\nprimary source - someone who was there\nsecondary source - someone who was not there" },
  { id: "page2", document_id: DOC, room_id: ROOM, chunk_index: 1, page_number: 2,
    page_label: "page", content: "Three Branches of Government\nExecutive, Legislative and Judicial. Supreme Court." },
  { id: "page2b", document_id: DOC, room_id: ROOM, chunk_index: 2, page_number: 2,
    page_label: "page", content: "Three Levels of Government: national, state, local." },
  { id: "page3", document_id: DOC, room_id: ROOM, chunk_index: 3, page_number: 3,
    page_label: "page", content: "Vocabulary for Every Vote Counts\nCandidate - running for office\nFoundation - starting point" },
  { id: "other", document_id: OTHER_DOC, room_id: OTHER_ROOM, chunk_index: 0, page_number: 1,
    page_label: "page", content: "Private other-room evidence" },
  { id: "unfinished", document_id: "pending", room_id: ROOM, chunk_index: 0, page_number: 1,
    page_label: "page", content: "Unprocessed content must not be cited" }
];

function fakeClient(opts: { noReady?: boolean; errorOn?: "documents" | "document_chunks" } = {}) {
  const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const sorts: Array<{ field: string; ascending: boolean }> = [];
      let max = 1000;
      const builder = {
        select(_cols: string) { return this; },
        eq(field: string, value: unknown) { filters[field] = value; return this; },
        in(field: string, values: unknown[]) { filters[field] = values; return this; },
        order(field: string, options: { ascending: boolean }) { sorts.push({ field, ascending: options.ascending }); return this; },
        limit(value: number) { max = value; return this; },
        then(resolve: (result: unknown) => unknown, reject: (reason: unknown) => unknown) {
          calls.push({ table, filters: { ...filters } });
          if (opts.errorOn === table) return Promise.resolve({ data: null, error: { message: "Offline query failure" } }).then(resolve, reject);
          const source = table === "documents" ? documents : rows;
          let data: Array<Record<string, unknown>> = source.filter((item) =>
            Object.entries(filters).every(([name, expected]) =>
              Array.isArray(expected) ? expected.includes((item as Record<string, unknown>)[name])
                : (item as Record<string, unknown>)[name] === expected
            )
          );
          if (opts.noReady && table === "documents") data = [];
          for (const { field, ascending } of [...sorts].reverse()) {
            data.sort((a, b) => (String(a[field] ?? "") < String(b[field] ?? "") ? -1 : String(a[field] ?? "") > String(b[field] ?? "") ? 1 : 0) * (ascending ? 1 : -1));
          }
          return Promise.resolve({ data: data.slice(0, max), error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
  return { supabase: client as unknown as SupabaseClient, calls };
}

test("generic guide prompts use bounded indexed-source navigation; specific questions remain semantic", () => {
  assert.equal(guideNavigationIntent("What does the study guide say I need to know?"), "overview");
  assert.equal(guideNavigationIntent("What's in my guide?"), "overview");
  assert.equal(guideNavigationIntent("What do I need to know for the test?"), "overview");
  assert.equal(guideNavigationIntent("What are the key terms I need to know? Give each one a short definition."), "terms");
  assert.equal(guideNavigationIntent("List vocabulary words and their definitions"), "terms");
  assert.equal(guideNavigationIntent("Explain Three Branches of Government simply."), null);
  assert.equal(guideNavigationIntent("What does the study guide say about the Supreme Court?"), null);
  assert.equal(guideNavigationIntent("Who leads the executive branch?"), null);
  assert.equal(guideNavigationIntent("Give me 10 practice questions."), null);
});

test("overview returns the actual indexed three-page scan in page order, with citation metadata and room RLS filters", async () => {
  const { supabase, calls } = fakeClient();
  const found = await retrieveGuideNavigationChunks({
    supabase, roomId: ROOM, ownerId: OWNER,
    question: "What does the study guide say I need to know?", intent: "overview"
  });
  assert.deepEqual(found.map((chunk) => chunk.id), ["page1", "page2", "page2b", "page3"]);
  assert.deepEqual(found.map((chunk) => chunk.pageNumber), [1, 2, 2, 3]);
  assert.equal(found[0].documentName, "Study guide .pdf");
  assert.ok(found.every((chunk) => chunk.documentId === DOC));
  assert.equal(found.some((chunk) => chunk.content.includes("Private other-room")), false);
  assert.equal(found.some((chunk) => chunk.content.includes("Unprocessed")), false);
  assert.equal(calls[0].filters.room_id, ROOM);
  assert.equal(calls[0].filters.owner_id, OWNER);
  assert.ok(calls.every((call) => call.filters.room_id === ROOM));
});

test("key terms retrieve both real vocabulary pages rather than answering 'not in your materials'", async () => {
  const { supabase } = fakeClient();
  const found = await retrieveGuideNavigationChunks({
    supabase, roomId: ROOM, ownerId: OWNER,
    question: "What are the key terms I need to know? Give each one a short definition.", intent: "terms"
  });
  assert.deepEqual(found.map((chunk) => chunk.pageNumber), [1, 3]);
  assert.match(found[0].content, /primary source/);
  assert.match(found[1].content, /Candidate/);
});

test("empty or failed authorized document reads do not invent source evidence", async () => {
  const empty = fakeClient({ noReady: true });
  assert.deepEqual(await retrieveGuideNavigationChunks({
    supabase: empty.supabase, roomId: ROOM, ownerId: OWNER,
    question: "What's in my guide?", intent: "overview"
  }), []);
  const broken = fakeClient({ errorOn: "document_chunks" });
  await assert.rejects(retrieveGuideNavigationChunks({
    supabase: broken.supabase, roomId: ROOM, ownerId: OWNER,
    question: "What's in my guide?", intent: "overview"
  }), /Could not read Study Room source passages/);
});
