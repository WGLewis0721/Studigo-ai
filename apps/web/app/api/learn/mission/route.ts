import { requireApiUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

// The mission API is available to authenticated learners in all rooms.
// SQL verifies p_owner/p_room, source revision, authorized topic and receipts.
// Only the server service role can execute these RPCs.

export async function GET(request: Request) {
  const { user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const roomId = new URL(request.url).searchParams.get("roomId") ?? "";
  if (!isUuid(roomId)) return Response.json({ error: "Invalid room" }, { status: 400, headers });
  const result = await createServiceSupabaseClient().rpc("read_learn_mission", { p_owner: user.id, p_room: roomId });
  if (result.error) return Response.json({ error: result.error.code === "42501" ? "Room not found" : "Could not read this mission" }, { status: result.error.code === "42501" ? 404 : 503, headers });
  return Response.json(result.data, { headers });
}

export async function POST(request: Request) {
  const { user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return Response.json({ error: "Request too large" }, { status: 413, headers });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const roomId = body?.roomId;
  const topicId = body?.topicId;
  const requestId = body?.requestId;
  const expected = body?.expectedRevision;
  const action = body?.action;
  const reflection = body?.reflection ?? null;
  const chunkId = body?.chunkId ?? null;
  if (typeof roomId !== "string" || !isUuid(roomId) || typeof topicId !== "string" || !isUuid(topicId)
    || typeof requestId !== "string" || !isUuid(requestId) || !Number.isSafeInteger(expected) || (expected as number) < 0
    || !["start", "restart", "advance", "back", "pause", "resume"].includes(String(action))
    || (action === "start" || action === "restart" ? typeof chunkId !== "string" || !isUuid(chunkId) : chunkId !== null)
    || (reflection !== null && reflection !== "ready" && reflection !== "review")) {
    return Response.json({ error: "Invalid mission action" }, { status: 400, headers });
  }
  const result = await createServiceSupabaseClient().rpc("commit_learn_mission", {
    p_owner: user.id, p_room: roomId, p_topic: topicId, p_request: requestId,
    p_expected: expected, p_action: action, p_reflection: reflection, p_chunk: chunkId
  });
  if (result.error) {
    const code = result.error.code;
    return Response.json({ error: code === "40001" ? "The mission or its source changed. Reload to continue."
      : code === "42501" ? "Room not found" : code === "22023" ? "This action or source is unavailable."
      : code === "23505" ? "This request ID was already used for another action." : "Could not save the mission." },
      { status: code === "40001" || code === "23505" ? 409 : code === "42501" ? 404 : code === "22023" ? 422 : 503, headers });
  }
  return Response.json(result.data, { headers });
}
