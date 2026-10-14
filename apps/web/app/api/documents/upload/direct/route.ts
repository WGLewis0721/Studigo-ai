import { guardAiRequest } from "@/lib/ai-admission";
import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  SOURCE_TYPES, UnsafeFileError, assertContentMatchesType,
  assertUploadAllowed, buildDocumentStoragePath, resolveMimeType, sha256Hex,
  type SourceType
} from "@studigo/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedSources = new Set<string>(SOURCE_TYPES);
type PrepareBody = {
  action: "prepare";
  roomId: string;
  name: string;
  mimeType: string;
  size: number;
  checksum: string;
  sourceType: SourceType;
};

function invalid(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * A bounded JSON handshake lets the browser send large materials straight to
 * private Supabase Storage, avoiding Vercel's 4.5-MB Function request limit.
 * The service role issues an upload token only for a generated user-owned path.
 * A separate finalize request validates the stored bytes before indexing.
 */
async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized ?? invalid("Sign in to upload materials.", 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body) || typeof body !== "object") return invalid("Invalid upload request.");

  if (body.action === "prepare") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const size = body.size;
    const declaredType = typeof body.mimeType === "string" ? body.mimeType : "";
    const checksum = body.checksum;
    const requestedSource = typeof body.sourceType === "string" ? body.sourceType : "";
    if (!name || name.length > 255 || !roomId || !Number.isSafeInteger(size) ||
        typeof checksum !== "string" || !/^[a-f0-9]{64}$/.test(checksum)) {
      return invalid("Invalid file metadata.");
    }
    const sourceType = (allowedSources.has(requestedSource) ? requestedSource : "other") as SourceType;
    let mimeType: string;
    try {
      mimeType = assertUploadAllowed({
        name, type: resolveMimeType({ name, type: declaredType }), size: size as number
      });
    } catch (error) {
      return invalid(error instanceof Error ? error.message : "Unsupported upload.");
    }
    const { data: room, error: roomError } = await supabase
      .from("study_rooms").select("id").eq("id", roomId).maybeSingle();
    if (roomError || !room) return invalid("Study Room not found.", 404);

    const { data: duplicate } = await supabase.from("documents")
      .select("id, name").eq("room_id", roomId).eq("checksum", checksum).maybeSingle();
    if (duplicate) return invalid("This file is already in this Study Room.", 409);

    const service = createServiceSupabaseClient();
    const documentId = crypto.randomUUID();
    const storagePath = buildDocumentStoragePath({
      userId: user.id, roomId, documentId, filename: name
    });
    const { data: document, error: insertError } = await service.from("documents")
      .insert({
        id: documentId, room_id: roomId, owner_id: user.id, name,
        mime_type: mimeType, size_bytes: size, storage_path: storagePath,
        source_type: sourceType, checksum, status: "uploaded"
      })
      .select("id, room_id, name, mime_type, size_bytes, source_type, status, created_at")
      .single();
    if (insertError || !document) {
      console.error("Direct upload record creation failed", { code: insertError?.code });
      return invalid("Could not prepare the upload.", 500);
    }
    const { data: signed, error: signError } = await service.storage
      .from("study-materials").createSignedUploadUrl(storagePath, { upsert: false });
    if (signError || !signed?.token) {
      await service.from("documents").update({
        status: "failed", error_message: "Could not prepare secure storage upload."
      }).eq("id", documentId).eq("owner_id", user.id);
      console.error("Secure storage upload token creation failed", { name: signError?.name });
      return invalid("Could not prepare secure storage upload.", 503);
    }
    return Response.json({
      documentId, upload: { path: storagePath, token: signed.token }
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "finalize") {
    const id = typeof body.documentId === "string" ? body.documentId : "";
    if (!/^[a-f0-9-]{36}$/i.test(id)) return invalid("Invalid upload reference.");
    const service = createServiceSupabaseClient();
    const { data: document } = await service.from("documents")
      .select("id, room_id, owner_id, name, mime_type, size_bytes, storage_path, checksum, status, source_type, created_at")
      .eq("id", id).eq("owner_id", user.id).maybeSingle();
    if (!document) return invalid("Upload not found.", 404);
    if (document.status !== "uploaded") return invalid("This upload has already been finalized.", 409);

    const { data: uploaded, error: downloadError } = await service.storage
      .from("study-materials").download(document.storage_path);
    if (downloadError || !uploaded) {
      return invalid("File transfer is not complete. Please wait before finalizing.", 409);
    }
    const bytes = await uploaded.arrayBuffer();
    let valid = bytes.byteLength === Number(document.size_bytes);
    if (valid) {
      try {
        assertContentMatchesType(document.mime_type, bytes);
        valid = (await sha256Hex(bytes)) === document.checksum;
      } catch (error) {
        valid = false;
        if (!(error instanceof UnsafeFileError)) {
          console.error("Direct upload content verification failed");
        }
      }
    }
    if (!valid) {
      await service.from("documents").update({
        status: "failed", error_message: "Stored file does not match the requested upload."
      }).eq("id", document.id).eq("owner_id", user.id);
      return invalid("Upload verification failed. Export a fresh copy and try again.", 400);
    }

    const { data: queued, error: updateError } = await service.from("documents")
      .update({ status: "queued" })
      .eq("id", document.id).eq("owner_id", user.id).eq("status", "uploaded")
      .select("id, room_id, name, mime_type, size_bytes, source_type, status, created_at")
      .maybeSingle();
    if (updateError || !queued) return invalid("Upload saved but processing could not start.", 503);
    return Response.json({ document: queued }, {
      status: 201, headers: { "Cache-Control": "no-store" }
    });
  }

  return invalid("Unknown upload operation.");
}

export async function POST(request: Request) {
  return guardAiRequest(request, "document-upload", guardedPost);
}
