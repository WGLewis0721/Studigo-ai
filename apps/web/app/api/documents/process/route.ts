import { after } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { reserveAiBudget } from "@/lib/ai-budget";
import { processDocument, runIngestWorker, syncIngestEnabled } from "@/lib/ingest";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

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
  // claim_next_document never picks a document at the retry cap, so queuing it
  // would leave the client polling until its timeout.
  if ((document.attempts ?? 0) >= 3 && document.status === "failed") {
    return Response.json(
      { error: "Processing retry limit reached (3 attempts). Upload a corrected file." },
      { status: 409 }
    );
  }

  // Reserved here for both paths: the worker runs under the service role and
  // has no per-user budget check of its own.
  const budget = await reserveAiBudget(supabase, user.id);
  if (!budget.ok) return Response.json({ error: budget.error }, { status: 429 });

  if (syncIngestEnabled()) {
    const result = await processDocument({ documentId, userId: user.id });
    return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
  }

  // Async mode. The worker claims only documents carrying ingest_requested_at,
  // so this write is what turns the reservation above into permission to run
  // OCR and embeddings. Migration 002 revokes UPDATE on public.documents from
  // `authenticated`, hence the service client; ownership was proven by the RLS
  // read above and is repeated in the filter. A document already processing
  // matches no row and keeps its current run.
  const { error: requestError } = await createServiceSupabaseClient()
    .from("documents")
    .update({ status: "queued", ingest_requested_at: new Date().toISOString(), error_message: null })
    .eq("id", documentId)
    .eq("owner_id", user.id)
    .in("status", ["uploaded", "queued", "failed"]);
  if (requestError) {
    return Response.json({ error: "Processing could not start. Retry from Materials." }, { status: 500 });
  }

  after(async () => {
    try {
      await runIngestWorker({ deadlineMs: 240_000 });
    } catch (error) {
      console.error("Ingest worker kick failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return Response.json({ documentId, status: "queued" }, { status: 202 });
}
