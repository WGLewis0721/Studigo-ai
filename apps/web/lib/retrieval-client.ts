/**
 * Client for the optional Python retrieval service (services/retrieval):
 * local embeddings + FAISS search + rule-based flashcards, zero LLM, zero
 * API cost. Entirely optional infrastructure — every function here is a
 * no-op when RETRIEVAL_SERVICE_URL isn't configured, so ingestion and the
 * rest of the app work unchanged whether or not this service exists.
 */

export type RetrievalPage = { page_number: number; text: string };

export type RetrievalHit = {
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
};

export type ClozeCard = { kind: "cloze"; prompt: string; answer: string; source: Record<string, unknown> };
export type TrueFalseCard = {
  kind: "true_false";
  statement: string;
  is_true: boolean;
  source: Record<string, unknown>;
};

function baseUrl(): string | null {
  const url = process.env.RETRIEVAL_SERVICE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

/** True only when the service is configured; callers use this to skip optional work entirely. */
export function retrievalServiceConfigured(): boolean {
  return baseUrl() !== null;
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  const url = baseUrl();
  if (!url) return null;
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // This is best-effort supplementary infra, not on the critical path.
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Retrieval service ${path} returned ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Mirrors a document's already-extracted pages into the local retrieval
 * service's FAISS index for its room. Called after ingestion so both
 * systems index the same content; never on the critical path — a caller
 * should swallow errors from this rather than fail ingestion over it.
 */
export async function indexDocumentLocally(args: {
  roomId: string;
  documentId: string;
  documentName: string;
  pages: RetrievalPage[];
}): Promise<number | null> {
  const result = await post<{ chunks_indexed: number }>("/index", {
    room_id: args.roomId,
    document_id: args.documentId,
    document_name: args.documentName,
    pages: args.pages
  });
  return result?.chunks_indexed ?? null;
}

export async function searchLocally(args: {
  roomId: string;
  query: string;
  topK?: number;
}): Promise<RetrievalHit[] | null> {
  const result = await post<{ hits: RetrievalHit[] }>("/search", {
    room_id: args.roomId,
    query: args.query,
    top_k: args.topK ?? 6
  });
  return result?.hits ?? null;
}

export async function generateLocalFlashcards(args: {
  roomId: string;
  query?: string;
  clozeCount?: number;
  trueFalseCount?: number;
  poolSize?: number;
}): Promise<{ cloze: ClozeCard[]; trueFalse: TrueFalseCard[] } | null> {
  const result = await post<{ cloze: ClozeCard[]; true_false: TrueFalseCard[] }>("/flashcards", {
    room_id: args.roomId,
    query: args.query ?? "",
    cloze_count: args.clozeCount ?? 5,
    true_false_count: args.trueFalseCount ?? 5,
    pool_size: args.poolSize ?? 20
  });
  if (!result) return null;
  return { cloze: result.cloze, trueFalse: result.true_false };
}
