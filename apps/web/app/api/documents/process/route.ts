import { requireApiUser } from "@/lib/auth";
import { processDocument } from "@/lib/ingest";

export const runtime = "nodejs";
/** Extraction, OCR, and embedding of a long chapter need real time. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
  const documentId = body?.documentId?.trim();
  if (!documentId) {
    return Response.json({ error: "documentId is required" }, { status: 400 });
  }

  // Ownership is verified against RLS before the service-role worker runs.
  const { data: document } = await supabase
    .from("documents")
    .select("id, status, attempts")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  if (document.status === "ready") {
    return Response.json({ documentId, status: "ready", alreadyProcessed: true });
  }

  const result = await processDocument({ documentId, userId: user.id });
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}
