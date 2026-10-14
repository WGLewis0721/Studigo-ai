import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedChunk } from "@studigo/ai";
import { fetchChunksByIds } from "@/lib/retrieval";

export type GuideNavigationIntent = "overview" | "terms";

/**
 * Deterministic, narrow source-navigation intents. Ordinary factual questions
 * stay on strict semantic retrieval; we never relax its similarity threshold.
 */
export function guideNavigationIntent(question: string): GuideNavigationIntent | null {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();
  const requestingList = /\b(what|which|list|show|give|define|tell|review|summarize|outline)\b/.test(q);
  if (requestingList && /\b(key terms?|vocabulary|vocab words?|glossary|definitions? of (?:the |my )?terms?)\b/.test(q)) {
    return "terms";
  }
  if (
    /\bwhat(?:'s| is) in (?:my |the |this )?(?:study )?(?:guide|handout|materials|notes)\b/.test(q) ||
    /\bwhat (?:does|do|should|am i) (?:the |my |this )?(?:study )?(?:guide|materials|notes|handout)?\s*(?:say )?(?:i |we )?need to know\b/.test(q) ||
    /\bwhat (?:do|should) i need to (?:know|study|review)\b/.test(q) ||
    /\b(?:summarize|overview of|outline|review)\b.*\b(?:study guide|materials|handout|notes)\b/.test(q)
  ) return "overview";
  return null;
}

type DocumentSource = {
  id: string;
  name: string;
  source_type: string | null;
  source_priority: number | null;
};
type ChunkSource = {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
};

/**
 * Browse already-indexed, ready material in the authenticated Study Room.
 * This is NOT fallback to generic model knowledge or a cross-room search.
 * In particular, "What's in my guide?" must not depend on the embedding of
 * the learner's generic wording being similar to a specific document sentence.
 */
export async function retrieveGuideNavigationChunks(args: {
  supabase: SupabaseClient;
  roomId: string;
  ownerId?: string;
  question: string;
  intent: GuideNavigationIntent;
  maxChunks?: number;
}): Promise<RetrievedChunk[]> {
  let query = args.supabase.from("documents")
    .select("id,name,source_type,source_priority")
    .eq("room_id", args.roomId)
    .eq("status", "ready");
  if (args.ownerId) query = query.eq("owner_id", args.ownerId);
  const { data: documentData, error: documentError } = await query
    .order("source_priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);
  if (documentError) throw new Error("Could not read Study Room document index");
  const documents = (documentData ?? []) as DocumentSource[];
  const guideDocuments = documents.filter((doc) =>
    doc.source_type === "study_guide" || /study[\s_-]*guide/i.test(doc.name)
  );
  const explicitlyGuide = /\b(?:study\s+guide|my guide|the guide|this guide)\b/i.test(args.question);
  const selected = (guideDocuments.length ? guideDocuments : explicitlyGuide ? [] : documents).slice(0, 3);
  if (!selected.length) return [];

  // This query reads just one room's indexed chunks, not full uploaded bytes.
  // RLS remains effective because this is the caller's authenticated client.
  const { data: chunkData, error: chunkError } = await args.supabase.from("document_chunks")
    .select("id,document_id,chunk_index,page_number,content")
    .eq("room_id", args.roomId)
    .in("document_id", selected.map((doc) => doc.id))
    .order("chunk_index", { ascending: true })
    .limit(48);
  if (chunkError) throw new Error("Could not read Study Room source passages");
  const rows = (chunkData ?? []) as ChunkSource[];
  const documentOrder = new Map(selected.map((doc, index) => [doc.id, index]));
  rows.sort((a, b) =>
    (documentOrder.get(a.document_id) ?? 99) - (documentOrder.get(b.document_id) ?? 99) ||
    (a.page_number ?? 0) - (b.page_number ?? 0) ||
    a.chunk_index - b.chunk_index
  );
  // Vocabulary requests use the guide's actual vocabulary/glossary sections,
  // when present. They should not turn into an unrelated topic explanation.
  const vocabulary = args.intent === "terms"
    ? rows.filter((row) => /(?:^|\n)\s*(?:vocabulary\b|.*\bvocabulary\b|key terms?\b|glossary\b)/im.test(row.content))
    : [];
  const candidates = vocabulary.length ? vocabulary : rows;
  const bounded = candidates.slice(0, Math.min(8, Math.max(1, args.maxChunks ?? 8)));
  if (!bounded.length) return [];

  // Re-fetch with the existing RLS-safe helper: it verifies ready-document
  // state again and constructs trusted document/page citation metadata.
  const chunks = await fetchChunksByIds(args.supabase, args.roomId, bounded.map((row) => row.id));
  let remainingChars = 18_000;
  return chunks.flatMap((chunk) => {
    if (remainingChars <= 0) return [];
    const content = chunk.content.slice(0, Math.min(remainingChars, 9_000));
    remainingChars -= content.length;
    return content ? [{ ...chunk, content }] : [];
  });
}
