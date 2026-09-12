import { drainStorageCleanup } from "@/lib/storage-cleanup";
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

  // The delete trigger queues the original path in the same transaction.
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) {
    return Response.json({ error: "Delete failed", detail: error.message }, { status: 500 });
  }

  const cleanup = await drainStorageCleanup(user.id).catch(() => ({ pending: 1 }));
  return Response.json({ deleted: documentId, cleanupPending: cleanup.pending > 0 });
}
