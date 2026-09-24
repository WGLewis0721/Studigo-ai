import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachInteraction } from "@/lib/coach-learning-events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInteractionId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Reuse of an interaction ID for a different message. Always fails closed. */
export class InteractionConflictError extends Error {}

/**
 * Persists the learner's submission as the user message whose ID IS the
 * interaction ID (generated once by the client per submitted turn). An exact
 * retry (same ID, conversation, role and content) reuses the existing row
 * and its server `created_at`; any other reuse of the ID fails closed. The
 * returned `createdAt` is server time, never browser time.
 */
export async function persistUserInteraction(args: {
  supabase: SupabaseClient;
  interactionId: string;
  conversationId: string;
  content: string;
}): Promise<CoachInteraction> {
  if (!isInteractionId(args.interactionId)) throw new InteractionConflictError("Invalid interaction ID");

  const inserted = await args.supabase
    .from("messages")
    .insert({ id: args.interactionId, conversation_id: args.conversationId, role: "user", content: args.content })
    .select("id, created_at")
    .single();
  if (!inserted.error && inserted.data) {
    const row = inserted.data as { id: string; created_at: string };
    return { id: row.id, createdAt: new Date(row.created_at).toISOString() };
  }
  if (inserted.error?.code !== "23505") {
    throw new Error(`Could not save the message: ${inserted.error?.message ?? "unknown error"}`);
  }

  // The ID already exists. Read it back under the learner's own RLS: a row in
  // someone else's conversation is invisible and therefore a conflict.
  const existing = await args.supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("id", args.interactionId)
    .maybeSingle();
  const row = existing.data as { id: string; conversation_id: string; role: string; content: string; created_at: string } | null;
  if (
    existing.error ||
    !row ||
    row.conversation_id !== args.conversationId ||
    row.role !== "user" ||
    row.content !== args.content
  ) {
    throw new InteractionConflictError("This interaction ID was already used for a different message");
  }
  return { id: row.id, createdAt: new Date(row.created_at).toISOString() };
}
