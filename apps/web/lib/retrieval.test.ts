import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchChunksByIds } from "./retrieval";

type QueryError = { message: string } | null;
type QueryResult = { data: unknown[] | null; error: QueryError };

function fakeSupabase(args: {
  chunks: QueryResult;
  documents?: QueryResult;
}): SupabaseClient {
  const documents = args.documents ?? { data: [], error: null };

  function table(result: QueryResult) {
    return {
      select: () => ({
        in: () => ({
          eq: async () => result
        })
      })
    };
  }

  return {
    from: (name: string) => {
      if (name === "document_chunks") return table(args.chunks) as never;
      if (name === "documents") return table(documents) as never;
      throw new Error(`Unexpected table: ${name}`);
    }
  } as unknown as SupabaseClient;
}

test("fetchChunksByIds throws when the chunk query fails instead of pretending material disappeared", async () => {
  const supabase = fakeSupabase({
    chunks: { data: null, error: { message: "PGRST201 ambiguous relationship" } }
  });

  await assert.rejects(
    () => fetchChunksByIds(supabase, "room-1", ["chunk-1"]),
    /Could not re-fetch Coach source chunks: PGRST201 ambiguous relationship/
  );
});

test("fetchChunksByIds throws when document metadata lookup fails", async () => {
  const supabase = fakeSupabase({
    chunks: {
      data: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          content: "Matter takes up space.",
          page_number: 2,
          page_label: null
        }
      ],
      error: null
    },
    documents: { data: null, error: { message: "metadata unavailable" } }
  });

  await assert.rejects(
    () => fetchChunksByIds(supabase, "room-1", ["chunk-1"]),
    /Could not re-fetch Coach source document metadata: metadata unavailable/
  );
});

test("fetchChunksByIds restores the persisted source order and joins document metadata", async () => {
  const supabase = fakeSupabase({
    chunks: {
      data: [
        {
          id: "chunk-2",
          document_id: "doc-2",
          content: "Opposite magnetic poles attract.",
          page_number: 7,
          page_label: null
        },
        {
          id: "chunk-1",
          document_id: "doc-1",
          content: "Melting changes a solid into a liquid.",
          page_number: 4,
          page_label: "page"
        }
      ],
      error: null
    },
    documents: {
      data: [
        {
          id: "doc-1",
          name: "Physical Science.pdf",
          source_type: "study_guide",
          page_label: "page",
          source_priority: 100
        },
        {
          id: "doc-2",
          name: "Physical Science.pdf",
          source_type: "study_guide",
          page_label: "page",
          source_priority: 100
        }
      ],
      error: null
    }
  });

  const chunks = await fetchChunksByIds(supabase, "room-1", ["chunk-1", "chunk-2"]);

  assert.deepEqual(chunks.map((chunk) => chunk.id), ["chunk-1", "chunk-2"]);
  assert.equal(chunks[0].documentName, "Physical Science.pdf");
  assert.equal(chunks[0].priority, 100);
  assert.equal(chunks[1].pageNumber, 7);
});

test("fetchChunksByIds returns fewer rows only when a requested chunk is genuinely missing", async () => {
  const supabase = fakeSupabase({
    chunks: {
      data: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          content: "Melting changes a solid into a liquid.",
          page_number: 4,
          page_label: "page"
        }
      ],
      error: null
    },
    documents: {
      data: [
        {
          id: "doc-1",
          name: "Physical Science.pdf",
          source_type: "study_guide",
          page_label: "page",
          source_priority: 100
        }
      ],
      error: null
    }
  });

  const chunks = await fetchChunksByIds(supabase, "room-1", ["chunk-1", "chunk-missing"]);

  assert.deepEqual(chunks.map((chunk) => chunk.id), ["chunk-1"]);
});
