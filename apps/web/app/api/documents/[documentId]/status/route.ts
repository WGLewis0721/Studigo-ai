import { requireApiUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { documentId } = await params;
  if (!isUuid(documentId)) {
    return Response.json({ error: "Invalid document id" }, { status: 400, headers: NO_STORE });
  }

  // User-scoped client: RLS proves ownership.
  const { data: document } = await supabase
    .from("documents")
    .select("id, status, error_message, chunk_count, processed_at")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404, headers: NO_STORE });
  }
  return Response.json(document, { headers: NO_STORE });
}
