import { requireApiUser } from "@/lib/auth";
import { loadReadingGuideEdition } from "@/lib/guide-reading";
import { buildPersistedEdition, type GuideEditionStore } from "@/lib/study-guide-content";
import { revisionStamp, selectCurrentBlocks } from "@/lib/source-freshness";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { StudyGuideContent } from "@studigo/ai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });
  const loaded = await loadReadingGuideEdition(supabase, roomId);
  if ("error" in loaded) return Response.json({ error: "Could not read the guide." }, { status: 500 });
  return Response.json({ edition: loaded.content, updateAvailable: loaded.updateAvailable });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null) as { roomId?: string; level?: string; topicIds?: string[] } | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const [{ data: blocks, error }, { data: documents, error: documentsError }] = await Promise.all([
    supabase.from("source_blocks").select("block_key, page_number, normalized_text, kind, revision, document_id").eq("room_id", roomId),
    supabase.from("documents").select("id, active_revision").eq("room_id", roomId)
  ]);
  if (error || documentsError) return Response.json({ error: "Could not read source blocks." }, { status: 500 });
  const sources = selectCurrentBlocks(
    (documents ?? []).map((document) => ({ id: String(document.id), revision: revisionStamp(document.active_revision) })),
    (blocks ?? []).map((block) => ({
      blockKey: block.block_key,
      pageNumber: block.page_number ?? 0,
      text: block.normalized_text,
      kind: block.kind,
      documentId: String(block.document_id),
      revision: revisionStamp(block.revision) ?? -1
    }))
  ).map((block) => ({
    blockKey: block.blockKey,
    pageNumber: block.pageNumber,
    text: block.text,
    kind: block.kind
  }));

  const service = createServiceSupabaseClient();
  const store: GuideEditionStore = {
    async get(key) {
      const existing = await service.rpc("read_guide_edition", { p_owner: user.id, p_key: key });
      return (existing.data ?? null) as StudyGuideContent | null;
    },
    async put(key, content) {
      const saved = await service.rpc("publish_guide_edition", {
        p_room: roomId,
        p_owner: user.id,
        p_key: key,
        p_content: content
      });
      if (saved.error || !saved.data) throw new Error("Could not store the guide edition.");
      return saved.data as StudyGuideContent;
    }
  };

  const result = await buildPersistedEdition({
    roomId,
    level: body?.level?.trim() || "general",
    topicIds: body?.topicIds ?? [],
    blocks: sources,
    store
  });
  return Response.json(result, { status: result.status === "ready" ? 200 : 422 });
}
