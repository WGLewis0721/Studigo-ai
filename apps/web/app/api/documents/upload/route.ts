import { assertUploadAllowed, buildDocumentStoragePath } from "@studigo/documents";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SOURCE_TYPES = new Set([
  "study_guide",
  "teacher_material",
  "textbook",
  "student_notes",
  "worksheet",
  "presentation",
  "other"
]);

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const roomId = String(form.get("roomId") || "").trim();
  const requestedSourceType = String(form.get("sourceType") || "other");
  const sourceType = SOURCE_TYPES.has(requestedSourceType) ? requestedSourceType : "other";

  if (!(file instanceof File) || !roomId) {
    return Response.json({ error: "file and roomId are required" }, { status: 400 });
  }

  try {
    assertUploadAllowed(file);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid upload" },
      { status: 400 }
    );
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath({
    userId: auth.user.id,
    roomId,
    documentId,
    filename: file.name
  });

  const { error: uploadError } = await supabase.storage
    .from("study-materials")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
  }

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      room_id: roomId,
      owner_id: auth.user.id,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      source_type: sourceType,
      status: "uploaded"
    })
    .select("id, room_id, name, mime_type, size_bytes, source_type, status, created_at")
    .single();

  if (insertError) {
    await supabase.storage.from("study-materials").remove([storagePath]);
    return Response.json({ error: "Document record failed", detail: insertError.message }, { status: 500 });
  }

  return Response.json({ document }, { status: 201 });
}
