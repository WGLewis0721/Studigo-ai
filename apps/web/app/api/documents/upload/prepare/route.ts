import { guardAiRequest } from "@/lib/ai-admission";
import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  SOURCE_TYPES, assertUploadAllowed, buildDocumentStoragePath, resolveMimeType,
  type SourceType
} from "@studigo/documents";

export const runtime = "nodejs";
const ALLOWED = new Set<string>(SOURCE_TYPES);

/**
 * Authorize a specific user-owned storage path without proxying file bytes
 * through Vercel's 4.5 MB function request-body limit.
 */
async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const input = await request.json().catch(() => null) as {
    roomId?: unknown; name?: unknown; size?: unknown;
    type?: unknown; sourceType?: unknown;
  } | null;
  const roomId = typeof input?.roomId === "string" ? input.roomId.trim() : "";
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const size = input?.size;
  if (!roomId || !name || name.length > 255 || !Number.isSafeInteger(size) || (size as number) <= 0) {
    return Response.json({ error: "Choose a valid file and Study Room." }, { status: 400 });
  }

  let mimeType: string;
  try {
    mimeType = assertUploadAllowed({
      name, size: size as number,
      type: resolveMimeType({ name, type: typeof input?.type === "string" ? input.type : "" })
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unsupported upload." }, { status: 400 });
  }

  const sourceType: SourceType = typeof input?.sourceType === "string" && ALLOWED.has(input.sourceType)
    ? input.sourceType as SourceType : "other";
  const { data: room, error: roomError } = await supabase.from("study_rooms")
    .select("id").eq("id", roomId).maybeSingle();
  if (roomError || !room) return Response.json({ error: "Study Room not found." }, { status: 404 });

  const id = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath({ userId: user.id, roomId, documentId: id, filename: name });
  const service = createServiceSupabaseClient();

  const { error: insertError } = await service.from("documents").insert({
    id, room_id: roomId, owner_id: user.id,
    name, mime_type: mimeType, size_bytes: size as number,
    storage_path: storagePath, source_type: sourceType, status: "uploaded"
  });
  if (insertError) {
    console.error("Signed upload record insert failed", { code: insertError.code });
    return Response.json({ error: "Could not prepare the upload." }, { status: 500 });
  }

  const { data: signed, error: tokenError } = await service.storage
    .from("study-materials").createSignedUploadUrl(storagePath);
  if (tokenError || !signed?.token) {
    await service.from("documents").update({
      status: "failed", error_message: "Upload could not be authorized."
    }).eq("id", id).eq("owner_id", user.id);
    console.error("Signed upload authorization failed", { name: tokenError?.name });
    return Response.json({ error: "Could not authorize the upload." }, { status: 503 });
  }

  return Response.json({
    upload: { path: storagePath, token: signed.token, mimeType },
    document: { id, status: "uploaded" }
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "document-upload", guardedPost);
}
