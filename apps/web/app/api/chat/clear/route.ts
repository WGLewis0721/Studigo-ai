import { requireApiUser } from "@/lib/auth";
import { archiveDecision, surfaceForRequest, type ConversationRow } from "@/lib/conversation-surface";
import { isUuid } from "@/lib/ids";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/** Archive one surface's active chat. Messages, receipts, and mastery stay. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null) as { roomId?: string; conversationId?: string; surface?: string } | null;
  const roomId = body?.roomId?.trim() ?? "";
  const conversationId = body?.conversationId?.trim() ?? "";
  const surface = surfaceForRequest({ surface: body?.surface, mode: body?.surface === "coach" ? "coach" : "ask" });
  if (!isUuid(roomId) || !isUuid(conversationId) || !surface || surface === "ask" && body?.surface !== "ask") {
    return Response.json({ error: "roomId, conversationId, and surface are required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("conversations")
    .select("id, owner_id, room_id, surface, archived_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) return Response.json({ error: "Could not load that chat." }, { status: 503 });
  const decision = archiveDecision({ row: data as ConversationRow | null, ownerId: user.id, roomId, surface });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status });
  if (!decision.already) {
    const service = createServiceSupabaseClient();
    const archived = await service.from("conversations").update({ archived_at: new Date().toISOString() }).eq("id", conversationId);
    if (archived.error) return Response.json({ error: "Could not archive that chat." }, { status: 503 });
  }
  return Response.json({ archived: true });
}
