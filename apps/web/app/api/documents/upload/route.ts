import {
  SOURCE_TYPES,
  assertUploadAllowed,
  buildDocumentStoragePath,
  resolveMimeType,
  sha256Hex,
  type SourceType
} from "@studigo/documents";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_SOURCE_TYPES = new Set<string>(SOURCE_TYPES);

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const roomId = String(form?.get("roomId") || "").trim();
  const requested = String(form?.get("sourceType") || "other");
  const sourceType: SourceType = (
    ALLOWED_SOURCE_TYPES.has(requested) ? requested : "other"
  ) as SourceType;

  if (!(file instanceof File) || !roomId) {
    return Response.json({ error: "A file and a Study Room are required." }, { status: 400 });
  }

  let mimeType: string;
  try {
    mimeType = assertUploadAllowed({ type: resolveMimeType(file), size: file.size, name: file.name });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "That file can't be uploaded." },
      { status: 400 }
    );
  }

  // RLS would reject the insert anyway; checking first gives a clear message.
  const { data: room } = await supabase
    .from("study_rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) {
    return Response.json({ error: "Study Room not found." }, { status: 404 });
  }

  const buffer = await file.arrayBuffer();
  const checksum = await sha256Hex(buffer);

  const { data: duplicate } = await supabase
    .from("documents")
    .select("id, name")
    .eq("room_id", roomId)
    .eq("checksum", checksum)
    .maybeSingle();

  if (duplicate) {
    return Response.json(
      { error: `“${duplicate.name}” is already in this room.`, documentId: duplicate.id },
      { status: 409 }
    );
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath({
    userId: user.id,
    roomId,
    documentId,
    filename: file.name
  });

  let service: ReturnType<typeof createServiceSupabaseClient>;
  try {
    service = createServiceSupabaseClient();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Server is misconfigured." },
      { status: 503 }
    );
  }

  const { data: document, error: insertError } = await service
    .from("documents")
    .insert({
      id: documentId,
      room_id: roomId,
      owner_id: user.id,
      name: file.name.slice(0, 255),
      mime_type: mimeType,
      size_bytes: file.size,
      storage_path: storagePath,
      source_type: sourceType,
      checksum,
      status: "uploaded"
    })
    .select("id, room_id, name, mime_type, size_bytes, source_type, status, created_at")
    .single();

  if (insertError) {
    return Response.json(
      { error: "Saving the document record failed", detail: insertError.message },
      { status: 500 }
    );
  }

  const { error: uploadError } = await supabase.storage
    .from("study-materials")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    await service.from("documents").update({ status: "failed", error_message: "Upload did not complete. Delete this file and upload it again." }).eq("id", documentId);
    return Response.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
  }

  const { error: queuedError } = await service.from("documents").update({ status: "queued" }).eq("id", documentId);
  if (queuedError) return Response.json({ error: "Upload saved, but processing could not start. Retry from Materials." }, { status: 500 });
  return Response.json({ document: { ...document, status: "queued" } }, { status: 201 });
}
