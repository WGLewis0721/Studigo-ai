import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { documentId } = await params;
  const { data: document } = await supabase
    .from("documents")
    .select(
      "id, room_id, name, mime_type, size_bytes, source_type, status, error_message, page_count, page_label, ocr_page_count, chunk_count, attempts, created_at"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
  return Response.json({ document });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { documentId } = await params;
  const { data: document } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });

  // Chunks cascade with the row; the stored original has to go explicitly.
  await supabase.storage.from("study-materials").remove([document.storage_path as string]);
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) {
    return Response.json({ error: "Delete failed", detail: error.message }, { status: 500 });
  }

  return Response.json({ deleted: documentId });
}
