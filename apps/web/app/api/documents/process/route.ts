import { guardAiRequest } from "@/lib/ai-admission";
import { requireApiUser } from "@/lib/auth";
import { durableIngestEnabled } from "@/lib/ingest-jobs";
import { processDocument } from "@/lib/ingest";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
/** Extraction, OCR, and embedding of a long chapter need real time. */
export const maxDuration = 300;

async function guardedPost(request: Request) {
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
  if (document.status === "ready" && !durableIngestEnabled()) {
    return Response.json({ documentId, status: "ready", alreadyProcessed: true });
  }

  if (durableIngestEnabled()) {
    const operation = request.headers.get("x-studigo-operation-id")?.trim() || `process:${documentId}`;
    const service = createServiceSupabaseClient();
    const queued = await service.rpc("enqueue_ingest_job", {
      p_document: documentId,
      p_owner: user.id,
      p_operation: operation
    });
    if (queued.error || !queued.data) {
      return Response.json({ error: "Could not record the processing job." }, { status: 500 });
    }
    return Response.json({ documentId, jobId: queued.data, status: "queued" }, { status: 202 });
  }

  const result = await processDocument({ documentId, userId: user.id });
  if (result.preserved) {
    return Response.json(
      { error: "Processing did not finish. The previous version is still searchable.", ...result },
      { status: 409 }
    );
  }
  return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "document-process", guardedPost);
}
