import { after } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { processDocument, runIngestWorker, syncIngestEnabled } from "@/lib/ingest";

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

  if (syncIngestEnabled()) {
    const result = await processDocument({ documentId, userId: user.id });
    return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
  }

  // Async mode. RLS: migration 002 revokes UPDATE on public.documents from
  // `authenticated`, so the user-scoped client cannot set status. We leave the
  // row untouched; upload already marks it "queued" and claim_next_document
  // accepts uploaded/failed/queued rows, so the worker will claim it.
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
