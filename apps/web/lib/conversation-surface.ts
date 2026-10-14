export type ChatSurface = "learn" | "coach" | "ask";

export type ConversationRow = {
  id: string;
  owner_id: string;
  room_id: string;
  surface: string | null;
  archived_at: string | null;
};

/** Coach is the request mode. Learn must be named. Anything else stays standalone Ask. */
export function surfaceForRequest(input: { mode?: string | null; surface?: string | null }): ChatSurface | null {
  if (input.mode === "coach") return "coach";
  if (input.surface == null || input.surface === "" || input.surface === "ask") return "ask";
  if (input.surface === "learn") return "learn";
  return null;
}

export function admitThread(input: {
  conversationId: string | null;
  row: ConversationRow | null;
  ownerId: string;
  roomId: string;
  surface: ChatSurface;
}): { ok: true; reuse: boolean } | { ok: false; status: number; error: string } {
  if (!input.conversationId) return { ok: true, reuse: false };
  const row = input.row;
  if (!row || row.id !== input.conversationId || row.owner_id !== input.ownerId || row.room_id !== input.roomId) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }
  if (row.archived_at || row.surface == null || row.surface !== input.surface) {
    return { ok: false, status: 409, error: "That chat cannot be reused on this surface." };
  }
  return { ok: true, reuse: true };
}

/** Archive is idempotent. It never deletes messages, receipts, or mastery. */
export function archiveDecision(input: {
  row: ConversationRow | null;
  ownerId: string;
  roomId: string;
  surface: ChatSurface;
}): { ok: true; already: boolean } | { ok: false; status: number; error: string } {
  const row = input.row;
  if (!row || row.owner_id !== input.ownerId || row.room_id !== input.roomId) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }
  if (row.surface !== input.surface) {
    return { ok: false, status: 409, error: "That chat belongs to a different surface." };
  }
  return { ok: true, already: row.archived_at != null };
}
