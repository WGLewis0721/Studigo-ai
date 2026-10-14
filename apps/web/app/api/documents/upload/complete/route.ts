import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { assertContentMatchesType, assertUploadAllowed, sha256Hex } from "@studigo/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Finalizes an owner-scoped signed upload only after inspecting stored bytes.
 * Supabase Storage can receive 50 MB directly from the browser; Vercel sees
 * only this small JSON control request, not the file body.
 */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = await request.json().catch(() => null) as { documentId?: unknown } | null;
  const documentId = typeof body?.documentId === "string" ? body.documentId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(documentId)) {
    return Response.json({ error: "A valid document ID is required." }, { status: 400 });
  }

  // RLS checks ownership; never accept a client-selected storage path.
  const { data: document, error: loadError } = await supabase.from("documents")
    .select("id, room_id, owner_id, name, mime_type, size_bytes, storage_path, status, checksum")
    .eq("id", documentId).maybeSingle();
  if (loadError || !document || document.owner_id !== user.id) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.status === "queued" || document.status === "ready") {
    return Response.json({ document: { id: document.id, status: document.status } });
  }
  if (document.status !== "uploaded") {
    return Response.json({ error: "This upload is no longer pending." }, { status: 409 });
  }

  // Bound abandoned signed uploads. An old token must not be usable to
  // finalize an arbitrary future object at the same user-owned path.
  const service = createServiceSupabaseClient();
  const { data: storedFile, error: downloadError } = await service.storage
    .from("study-materials").download(document.storage_path);
  if (downloadError || !storedFile) {
    return Response.json({ error: "The file has not reached Storage yet. Try uploading it again." }, { status: 409 });
  }

  const buffer = await storedFile.arrayBuffer();
  let checksum: string;
  try {
    assertUploadAllowed({
      name: document.name, size: buffer.byteLength, type: document.mime_type
    });
    if (buffer.byteLength !== Number(document.size_bytes)) {
      throw new Error("The uploaded file size did not match the selected file.");
    }
    assertContentMatchesType(document.mime_type, buffer);
    checksum = await sha256Hex(buffer);
  } catch (error) {
    await service.from("documents").update({
      status: "failed", error_message: "Invalid uploaded file. Remove it and try again."
    }).eq("id", document.id).eq("owner_id", user.id).eq("status", "uploaded");
    // Never index a file whose bytes failed validation.
    return Response.json({
      error: error instanceof Error ? error.message : "Invalid uploaded file."
    }, { status: 400 });
  }

  const { data: duplicate } = await supabase.from("documents")
    .select("id, name").eq("room_id", document.room_id).eq("checksum", checksum)
    .neq("id", document.id).maybeSingle();
  if (duplicate) {
    await service.from("documents").update({
      status: "failed", error_message: "The same file is already in this Study Room."
    }).eq("id", document.id).eq("owner_id", user.id).eq("status", "uploaded");
    return Response.json({ error: "This file is already in the Study Room." }, { status: 409 });
  }

  const { data: queued, error: updateError } = await service.from("documents")
    .update({ checksum, status: "queued" })
    .eq("id", document.id).eq("owner_id", user.id).eq("status", "uploaded")
    .select("id, status").maybeSingle();
  if (updateError || !queued) {
    return Response.json({ error: "Upload saved, but confirmation was interrupted. Refresh Materials." }, { status: 409 });
  }
  return Response.json({ document: queued }, { headers: { "Cache-Control": "no-store" } });
}
