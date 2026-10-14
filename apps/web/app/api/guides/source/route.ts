import { requireApiUser } from "@/lib/auth";
import { revisionStamp, selectCurrentBlocks } from "@/lib/source-freshness";

export const runtime = "nodejs";

/** Owner-scoped source text. This does not write or generate anything. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId")?.trim();
  const blockKey = url.searchParams.get("blockKey")?.trim();
  if (!roomId || !blockKey) return Response.json({ error: "roomId and blockKey are required" }, { status: 400 });
  const [{ data: blocks, error }, { data: documents, error: documentError }] = await Promise.all([
    supabase.from("source_blocks").select("block_key, page_number, normalized_text, revision, document_id").eq("room_id", roomId).eq("block_key", blockKey),
    supabase.from("documents").select("id, active_revision").eq("room_id", roomId)
  ]);
  if (error || documentError) return Response.json({ error: "Could not read that source." }, { status: 500 });
  const current = selectCurrentBlocks(
    (documents ?? []).map((document) => ({ id: String(document.id), revision: revisionStamp(document.active_revision) })),
    (blocks ?? []).map((block) => ({
      blockKey: block.block_key,
      pageNumber: block.page_number,
      text: block.normalized_text,
      documentId: String(block.document_id),
      revision: revisionStamp(block.revision) ?? -1
    }))
  );
  const data = current[0];
  if (!data) return Response.json({ error: "Source not found" }, { status: 404 });
  return Response.json({ blockKey: data.blockKey, pageNumber: data.pageNumber, text: data.text });
}
