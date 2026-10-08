import { guardAiRequest } from "@/lib/ai-admission";
import { requireApiUser } from "@/lib/auth";
import { reindexCooldownElapsed, reindexCooldownMs } from "@/lib/ai-budget";
import { processDocument } from "@/lib/ingest";
import { isUuid } from "@/lib/ids";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Manual recovery path for stale source/topic state.
 *
 * Rereads the stored original, replaces its chunks/embeddings, and rebuilds the
 * topic map from that study guide. The caller stays on Materials while this
 * runs, so Coach/Learn remount with fresh conversation context when reopened.
 */
async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; documentId?: string }
    | null;
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  const requestedDocumentId =
    typeof body?.documentId === "string" ? body.documentId.trim() : "";

  if (!isUuid(roomId)) {
    return Response.json({ error: "roomId is required" }, { status: 400 });
  }
  if (requestedDocumentId && !isUuid(requestedDocumentId)) {
    return Response.json({ error: "Could not find that study guide." }, { status: 400 });
  }

  let query = supabase
    .from("documents")
    .select("id, room_id, name, source_type, status, created_at, last_forced_reindex_at")
    .eq("room_id", roomId)
    .eq("source_type", "study_guide")
    .order("created_at", { ascending: false })
    .limit(1);

  if (requestedDocumentId) query = query.eq("id", requestedDocumentId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    return Response.json({ error: "Could not find that study guide." }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { error: "Upload a file as Study guide first, then refresh it." },
      { status: 404 }
    );
  }

  if (data.status === "processing") {
    return Response.json(
      { error: "This study guide is still being processed. Wait for it to finish first." },
      { status: 409 }
    );
  }

  const lastForced = data.last_forced_reindex_at ? Date.parse(data.last_forced_reindex_at as string) : null;
  if (!reindexCooldownElapsed(lastForced, Date.now(), reindexCooldownMs())) {
    return Response.json(
      { error: "This study guide was just refreshed. Wait a few minutes before refreshing it again." },
      { status: 429 }
    );
  }

  const result = await processDocument({
    documentId: data.id as string,
    userId: user.id,
    force: true
  });

  if (result.status !== "ready") {
    return Response.json(
      { error: result.error || "The study guide could not be refreshed.", ...result },
      { status: 500 }
    );
  }

  return Response.json({
    refreshed: true,
    document: { id: data.id, name: data.name },
    ...result
  });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "document-reindex", guardedPost);
}
