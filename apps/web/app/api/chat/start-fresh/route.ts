import { requireApiUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { assertRoomAccess } from "@/lib/retrieval";

export const runtime = "nodejs";

/** Archive only the caller's active Learn or Coach thread. History is retained. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: unknown; conversationId?: unknown; surface?: unknown }
    | null;
  const roomId = body?.roomId;
  const conversationId = body?.conversationId ?? null;
  const surface = body?.surface;
  if (!isUuid(roomId) || (conversationId !== null && !isUuid(conversationId)) || (surface !== "coach" && surface !== "learn")) {
    return Response.json({ error: "Choose a valid Study Room conversation." }, { status: 400 });
  }

  if (!await assertRoomAccess(supabase, roomId)) {
    return Response.json({ error: "Study Room not found." }, { status: 404 });
  }

  const { data, error } = await supabase.rpc("archive_conversation_surface", {
    p_room_id: roomId,
    p_conversation_id: conversationId,
    p_surface: surface
  });
  if (error) {
    return Response.json({ error: "That conversation is not available for this chat." }, { status: 409 });
  }
  return Response.json({ archived: data === true });
}
