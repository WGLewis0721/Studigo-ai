import { embedText, type RetrievedChunk } from "@studigo/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toRetrievedChunks } from "@/lib/ingest";

export const MAX_RETRIEVAL_CHUNKS = Number(process.env.STUDIGO_MAX_RETRIEVAL_CHUNKS || 8);
export const MIN_SIMILARITY = Number(process.env.STUDIGO_MIN_SIMILARITY || 0.35);

/**
 * Retrieval is always scoped to one Study Room and one owner: a question about
 * biology can never be answered out of last term's history notes.
 */
export async function retrieveForRoom(args: {
  supabase: SupabaseClient;
  roomId: string;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
}): Promise<RetrievedChunk[]> {
  const embedding = await embedText(args.query);

  const { data, error } = await args.supabase.rpc("match_study_chunks", {
    p_room_id: args.roomId,
    p_query_embedding: embedding as unknown as string,
    p_match_count: args.matchCount ?? MAX_RETRIEVAL_CHUNKS,
    p_min_similarity: args.minSimilarity ?? MIN_SIMILARITY,
    p_owner_id: null
  });

  if (error) throw new Error(`Retrieval failed: ${error.message}`);
  return toRetrievedChunks((data ?? []) as Array<Record<string, unknown>>);
}

/**
 * Re-fetches specific chunks by id, scoped to the room, under the same RLS
 * boundary as any other read. Used to re-ground a pending Coach question
 * against its original source material at grading time, instead of trusting
 * a cached copy of chunk content that may have been edited or deleted since
 * the question was asked. Missing ids (deleted, or never accessible to this
 * caller) are silently dropped rather than erroring, so the caller can detect
 * "some/all source material is gone" from a shorter result and invalidate
 * the pending state accordingly.
 */
export async function fetchChunksByIds(
  supabase: SupabaseClient,
  roomId: string,
  chunkIds: string[]
): Promise<RetrievedChunk[]> {
  if (!chunkIds.length) return [];

  const { data, error } = await supabase
    .from("document_chunks")
    .select(
      "id, document_id, content, page_number, page_label, priority, documents!inner(name, source_type, room_id)"
    )
    .in("id", chunkIds)
    .eq("documents.room_id", roomId);

  if (error || !data) return [];

  type ChunkRow = {
    id: string;
    document_id: string;
    content: string;
    page_number: number | null;
    page_label: string | null;
    priority: number | null;
    documents: { name: string; source_type: string | null } | null;
  };

  return (data as unknown as ChunkRow[]).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentName: row.documents?.name ?? "Unknown document",
    content: row.content,
    similarity: 1,
    sourceType: row.documents?.source_type ?? null,
    pageNumber: row.page_number ?? null,
    pageLabel: row.page_label || "page",
    priority: row.priority ?? null
  }));
}

/** Confirms the room belongs to the caller before any generation work starts. */
export async function assertRoomAccess(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase
    .from("study_rooms")
    .select("id, title")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; title: string };
}

export function markersToCitations(
  markers: number[],
  chunks: RetrievedChunk[]
) {
  return markers
    .map((marker) => chunks[marker - 1])
    .filter(Boolean)
    .map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber ?? null,
      pageLabel: chunk.pageLabel || "page"
    }));
}
