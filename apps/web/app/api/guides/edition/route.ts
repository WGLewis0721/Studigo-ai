import { requireApiUser } from "@/lib/auth";
import { buildPersistedEdition, type GuideEditionStore } from "@/lib/study-guide-content";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { StudyGuideContent } from "@studigo/ai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });
  const { data, error } = await supabase
    .from("guide_editions")
    .select("content")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return Response.json({ error: "Could not read the guide." }, { status: 500 });
  return Response.json({ edition: data?.content ?? null });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null) as { roomId?: string; level?: string; topicIds?: string[] } | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const { data: blocks, error } = await supabase
    .from("source_blocks")
    .select("block_key, page_number, normalized_text, kind")
    .eq("room_id", roomId);
  if (error) return Response.json({ error: "Could not read source blocks." }, { status: 500 });
  const sources = (blocks ?? []).map((block) => ({
    blockKey: block.block_key,
    pageNumber: block.page_number ?? 0,
    text: block.normalized_text,
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
