import { answerFromRetrievedContext, embedText } from "@studigo/ai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as
    | { roomId?: string; question?: string }
    | null;

  const roomId = body?.roomId?.trim();
  const question = body?.question?.trim();

  if (!roomId || !question) {
    return Response.json({ error: "roomId and question are required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "Question is too long" }, { status: 400 });
  }

  const queryEmbedding = await embedText(question);
  const matchCount = Number(process.env.STUDIGO_MAX_RETRIEVAL_CHUNKS || 8);
  const minSimilarity = Number(process.env.STUDIGO_MIN_SIMILARITY || 0.35);

  const { data: chunks, error } = await supabase.rpc("match_study_chunks", {
    p_room_id: roomId,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
    p_min_similarity: minSimilarity
  });

  if (error) {
    return Response.json({ error: "Retrieval failed", detail: error.message }, { status: 500 });
  }

  const answer = await answerFromRetrievedContext({
    question,
    chunks: (chunks ?? []).map((chunk: Record<string, unknown>) => ({
      id: String(chunk.chunk_id),
      documentId: String(chunk.document_id),
      documentName: String(chunk.document_name),
      content: String(chunk.content),
      similarity: Number(chunk.similarity),
      sourceType: chunk.source_type ? String(chunk.source_type) : null,
      pageNumber: chunk.page_number == null ? null : Number(chunk.page_number),
      priority: chunk.priority == null ? null : Number(chunk.priority)
    }))
  });

  return Response.json(answer);
}
