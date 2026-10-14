import { requireApiUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import {
  THREAD_MESSAGE_WINDOW,
  assembleRestoredThreads,
  savePointerDecision,
  type ThreadConversation,
  type ThreadMessage,
  type ThreadPointer
} from "@/lib/thread-restore";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

/** Read the active Learn and Coach threads. Newest messages, shown oldest-first by the assembler. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const roomId = new URL(request.url).searchParams.get("roomId")?.trim() ?? "";
  if (!isUuid(roomId)) return Response.json({ error: "roomId is required" }, { status: 400, headers: noStore });

  const room = await supabase.from("study_rooms").select("id, owner_id").eq("id", roomId).maybeSingle();
  if (room.error) return Response.json({ error: "Could not load that Study Room." }, { status: 503, headers: noStore });
  if (!room.data || room.data.owner_id !== user.id) return Response.json({ error: "Study Room not found" }, { status: 404, headers: noStore });

  const pointers = await supabase
    .from("chat_thread_pointers")
    .select("owner_id, room_id, surface, conversation_id, cursor_index, topic_ids")
    .eq("owner_id", user.id)
    .eq("room_id", roomId);
  if (pointers.error) return Response.json({ error: "Could not load this chat." }, { status: 503, headers: noStore });

  const pointerRows = (pointers.data ?? []) as ThreadPointer[];
  const conversationIds = [...new Set(pointerRows.map((row) => row.conversation_id).filter((id): id is string => isUuid(id)))];
  const conversations = conversationIds.length
    ? await supabase.from("conversations").select("id, owner_id, room_id, surface, archived_at, coach_state").in("id", conversationIds)
    : { data: [], error: null };
  if (conversations.error) return Response.json({ error: "Could not load this chat." }, { status: 503, headers: noStore });

  const messagesByConversation: Record<string, ThreadMessage[]> = {};
  for (const conversationId of conversationIds) {
    const loaded = await supabase
      .from("messages")
      .select("id, role, content, citations, created_at")
      .eq("conversation_id", conversationId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(THREAD_MESSAGE_WINDOW);
    if (loaded.error) return Response.json({ error: "Could not load this chat." }, { status: 503, headers: noStore });
    messagesByConversation[conversationId] = (loaded.data ?? []) as ThreadMessage[];
  }

  const restored = assembleRestoredThreads({
    requesterId: user.id,
    roomId,
    roomOwnerId: room.data.owner_id,
    pointers: pointerRows,
    conversations: (conversations.data ?? []) as ThreadConversation[],
    messagesByConversation
  });
  if (restored.denied) return Response.json({ error: "Study Room not found" }, { status: 404, headers: noStore });
  return Response.json({ learn: restored.learn, coach: restored.coach }, { headers: noStore });
}

/** Save the active thread id, topic cursor, and selected scope. Transcripts are not accepted here. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null) as {
    roomId?: unknown;
    surface?: unknown;
    conversationId?: unknown;
    cursorIndex?: unknown;
    topicIds?: unknown;
  } | null;
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  const surface = typeof body?.surface === "string" ? body.surface : "";
  const topicIds = Array.isArray(body?.topicIds) ? body.topicIds.filter((id): id is string => typeof id === "string") : [];
  const hasConversation = Boolean(body) && Object.prototype.hasOwnProperty.call(body, "conversationId");
  const conversationValue = hasConversation ? body?.conversationId : undefined;
  if (hasConversation && conversationValue !== null && (typeof conversationValue !== "string" || !isUuid(conversationValue.trim()))) {
    return Response.json({ error: "Invalid conversation." }, { status: 400, headers: noStore });
  }
  const conversationId = typeof conversationValue === "string" ? conversationValue.trim() : conversationValue === null ? null : undefined;
  const cursorIndex = body?.cursorIndex;
  if (!isUuid(roomId) || (surface !== "learn" && surface !== "coach") || typeof cursorIndex !== "number" || !Number.isInteger(cursorIndex)) {
    return Response.json({ error: "roomId, surface, and cursor are required" }, { status: 400, headers: noStore });
  }

  const room = await supabase.from("study_rooms").select("id, owner_id").eq("id", roomId).maybeSingle();
  if (room.error) return Response.json({ error: "Could not load that Study Room." }, { status: 503, headers: noStore });
  const roomOwned = Boolean(room.data && room.data.owner_id === user.id);
  let conversation: ThreadConversation | null = null;
  if (typeof conversationId === "string" && isUuid(conversationId)) {
    const loaded = await supabase.from("conversations").select("id, owner_id, room_id, surface, archived_at").eq("id", conversationId).maybeSingle();
    if (loaded.error) return Response.json({ error: "Could not load that chat." }, { status: 503, headers: noStore });
    conversation = loaded.data as ThreadConversation | null;
  }
  const decision = savePointerDecision({
    ownerId: user.id,
    roomId,
    surface,
    roomOwned,
    cursorIndex,
    topicIds,
    conversationId: hasConversation ? conversationId ?? null : undefined,
    conversation
  });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status, headers: noStore });

  const existing = await supabase
    .from("chat_thread_pointers")
    .select("conversation_id")
    .eq("owner_id", user.id)
    .eq("room_id", roomId)
    .eq("surface", surface)
    .maybeSingle();
  if (existing.error) return Response.json({ error: "Could not save this chat." }, { status: 503, headers: noStore });
  const saved = await supabase.from("chat_thread_pointers").upsert({
    owner_id: user.id,
    room_id: roomId,
    surface,
    conversation_id: decision.conversationId === undefined ? existing.data?.conversation_id ?? null : decision.conversationId,
    cursor_index: decision.cursorIndex,
    topic_ids: decision.topicIds,
    updated_at: new Date().toISOString()
  }, { onConflict: "owner_id,room_id,surface" });
  if (saved.error) return Response.json({ error: "Could not save this chat." }, { status: 503, headers: noStore });
  return Response.json({ saved: true }, { headers: noStore });
}
