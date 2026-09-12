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
