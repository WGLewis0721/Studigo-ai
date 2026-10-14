import { isUuid } from "./ids";

/** Recent context only. Callers must read newest-first, never the oldest page. */
export const THREAD_MESSAGE_WINDOW = 40;

export type ThreadSurface = "learn" | "coach";
export type StoredTurn = "idle" | "interrupted" | "pending";

export type ThreadPointer = {
  owner_id: string;
  room_id: string;
  surface: string;
  conversation_id: string | null;
  cursor_index: number;
  topic_ids: string[];
};

export type ThreadConversation = {
  id: string;
  owner_id: string;
  room_id: string;
  surface: string | null;
  archived_at: string | null;
  coach_state?: unknown;
};

export type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  citations?: unknown;
  created_at: string;
};

export type RestoredCitation = {
  marker?: number;
  chunkId?: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel?: string | null;
  sourceType?: string | null;
};

export type RestoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: RestoredCitation[];
  createdAt: string;
};

export type RestoredThread = {
  surface: ThreadSurface;
  conversationId: string | null;
  cursorIndex: number;
  topicIds: string[];
  messages: RestoredMessage[];
  turn: StoredTurn;
  retryInteractionId: string | null;
  autoSubmit: false;
  grade: false;
};

const NO_RESUME = { autoSubmit: false as const, grade: false as const };

/** Reload shows the stored turn. It does not start a provider call or a grade. */
export function shouldAutoResumeStoredTurn(): false {
  return false;
}

export function latestMessagesSql(limit = THREAD_MESSAGE_WINDOW): string {
  const bounded = Math.max(1, Math.min(100, Math.floor(limit)));
  return `select id, role, content, citations, created_at::text as created_at
    from messages
    where conversation_id = $1 and role in ('user', 'assistant')
    order by created_at desc, id desc
    limit ${bounded}`;
}

export function latestMessageWindow(messages: ThreadMessage[], limit = THREAD_MESSAGE_WINDOW): ThreadMessage[] {
  const visible = messages.filter((message) => message.role === "user" || message.role === "assistant");
  const newestFirst = [...visible].sort((left, right) => {
    const byTime = right.created_at.localeCompare(left.created_at);
    return byTime === 0 ? right.id.localeCompare(left.id) : byTime;
  });
  return newestFirst.slice(0, Math.max(1, Math.min(100, Math.floor(limit)))).reverse();
}

export function savePointerDecision(input: {
  ownerId: string;
  roomId: string;
  surface: string;
  roomOwned: boolean;
  cursorIndex: number;
  topicIds: string[];
  /** Omit to leave the stored conversation id unchanged. Null clears it. */
  conversationId?: string | null;
  conversation: ThreadConversation | null;
}): { ok: true; conversationId: string | null | undefined; cursorIndex: number; topicIds: string[] } | { ok: false; status: number; error: string } {
  if (!input.roomOwned || !isUuid(input.roomId)) return { ok: false, status: 404, error: "Study Room not found" };
  if (input.surface !== "learn" && input.surface !== "coach") return { ok: false, status: 400, error: "Choose Learn or Coach." };
  if (!Number.isInteger(input.cursorIndex) || input.cursorIndex < 0 || input.cursorIndex >= 1000) {
    return { ok: false, status: 400, error: "Choose a topic in this Study Room." };
  }
  if (!Array.isArray(input.topicIds) || input.topicIds.length > 80 || input.topicIds.some((id) => !isUuid(id))) {
    return { ok: false, status: 400, error: "Choose valid Study Room topics." };
  }
  const topicIds = [...new Set(input.topicIds)];
  if (input.conversationId === undefined) {
    return { ok: true, conversationId: undefined, cursorIndex: input.cursorIndex, topicIds };
  }
  if (input.conversationId === null) {
    return { ok: true, conversationId: null, cursorIndex: input.cursorIndex, topicIds };
  }
  if (!isUuid(input.conversationId)) return { ok: false, status: 400, error: "Invalid conversation." };
  const row = input.conversation;
  const current = row
    && row.id === input.conversationId
    && row.owner_id === input.ownerId
    && row.room_id === input.roomId
    && row.surface === input.surface
    && row.archived_at == null;
  if (!row || row.owner_id !== input.ownerId || row.room_id !== input.roomId) {
    return { ok: false, status: 404, error: "Conversation not found" };
  }
  if (!current) return { ok: false, status: 409, error: "That chat cannot be restored on this surface." };
  return { ok: true, conversationId: input.conversationId, cursorIndex: input.cursorIndex, topicIds };
}

function blank(surface: ThreadSurface): RestoredThread {
  return { surface, conversationId: null, cursorIndex: 0, topicIds: [], messages: [], turn: "idle", retryInteractionId: null, ...NO_RESUME };
}

function citationsOf(value: unknown): RestoredCitation[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.documentId !== "string" || typeof row.documentName !== "string") return [];
    return [{
      marker: typeof row.marker === "number" ? row.marker : undefined,
      chunkId: typeof row.chunkId === "string" ? row.chunkId : undefined,
      documentId: row.documentId,
      documentName: row.documentName,
      pageNumber: typeof row.pageNumber === "number" ? row.pageNumber : null,
      pageLabel: typeof row.pageLabel === "string" || row.pageLabel === null ? row.pageLabel : null,
      sourceType: typeof row.sourceType === "string" || row.sourceType === null ? row.sourceType : null
    }];
  });
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function coachKind(state: unknown): string | null {
  const parsed = typeof state === "string" ? parseJson(state) : state;
  if (!parsed || typeof parsed !== "object" || !("kind" in parsed)) return null;
  const kind = (parsed as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : null;
}

function restoreOne(surface: ThreadSurface, input: {
  requesterId: string;
  roomId: string;
  pointers: ThreadPointer[];
  conversations: ThreadConversation[];
  messagesByConversation: Record<string, ThreadMessage[]>;
}): RestoredThread {
  const pointer = input.pointers.find((row) => row.owner_id === input.requesterId && row.room_id === input.roomId && row.surface === surface) ?? null;
  if (!pointer) return blank(surface);
  const topicIds = (pointer.topic_ids ?? []).filter((id) => isUuid(id)).slice(0, 80);
  const cursorIndex = Number.isInteger(pointer.cursor_index) && pointer.cursor_index >= 0 && pointer.cursor_index < 1000 ? pointer.cursor_index : 0;
  const conversation = pointer.conversation_id
    ? input.conversations.find((row) => row.id === pointer.conversation_id) ?? null
    : null;
  const current = Boolean(
    conversation
    && conversation.owner_id === input.requesterId
    && conversation.room_id === input.roomId
    && conversation.surface === surface
    && conversation.archived_at == null
  );
  if (!current || !conversation || !pointer.conversation_id) {
    return { surface, conversationId: null, cursorIndex, topicIds, messages: [], turn: "idle", retryInteractionId: null, ...NO_RESUME };
  }
  const messages = latestMessageWindow(input.messagesByConversation[conversation.id] ?? []).map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" as const : "user" as const,
    content: message.content,
    citations: citationsOf(message.citations),
    createdAt: message.created_at
  }));
  const last = messages.at(-1);
  const turn: StoredTurn = surface === "coach" && last?.role === "user"
    ? "interrupted"
    : surface === "coach" && last?.role === "assistant" && coachKind(conversation.coach_state) === "awaiting_answer"
      ? "pending"
      : "idle";
  return {
    surface,
    conversationId: conversation.id,
    cursorIndex,
    topicIds,
    messages,
    turn,
    retryInteractionId: turn === "interrupted" && last ? last.id : null,
    ...NO_RESUME
  };
}

/**
 * Owner and room are checked before any transcript is copied. An archived
 * conversation is not the current thread. Learn and Coach are separate rows.
 */
export function assembleRestoredThreads(input: {
  requesterId: string;
  roomId: string;
  roomOwnerId: string | null;
  pointers: ThreadPointer[];
  conversations: ThreadConversation[];
  messagesByConversation: Record<string, ThreadMessage[]>;
}): { denied: boolean; learn: RestoredThread; coach: RestoredThread } {
  if (!input.roomOwnerId || input.roomOwnerId !== input.requesterId) {
    return { denied: true, learn: blank("learn"), coach: blank("coach") };
  }
  return {
    denied: false,
    learn: restoreOne("learn", input),
    coach: restoreOne("coach", input)
  };
}
