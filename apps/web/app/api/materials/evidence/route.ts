import { requireApiUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { adaptPhase3Evidence, type Phase3EvidenceInput } from "@/lib/phase3-evidence-adapter";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

function ocrFor(status: string): Phase3EvidenceInput["ocr"] {
  if (status === "ready") return "ready";
  if (status === "partial") return "partial";
  if (status === "failed") return "uncertain";
  return "processing";
}

/** One authorized passage for a file the signed-in user already owns. Reads only. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const documentId = new URL(request.url).searchParams.get("documentId") ?? "";
  if (!isUuid(documentId)) return Response.json({ error: "Invalid document" }, { status: 400, headers });

  const { data: document } = await supabase
    .from("documents")
    .select("id, name, status, page_label, active_revision, chunk_count")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) return Response.json({ error: "Document not found" }, { status: 404, headers });

  const currentRevision = typeof document.active_revision === "number" ? document.active_revision : null;
  const base: Phase3EvidenceInput = {
    documentId,
    title: document.name,
    blockKey: null,
    pageNumber: null,
    pageLabel: document.page_label,
    revision: currentRevision,
    currentRevision,
    present: false,
    access: "allowed",
    ocr: ocrFor(document.status),
    excerpt: null,
    excerptVerified: false
  };

  if (document.status === "partial" || document.status === "failed") {
    const revision = currentRevision ?? 1;
    return Response.json({
      view: adaptPhase3Evidence({ ...base, present: true, revision, currentRevision: revision })
    }, { headers });
  }
  if (document.status !== "ready" || currentRevision == null) {
    return Response.json({ view: adaptPhase3Evidence(base) }, { headers });
  }

  let service: ReturnType<typeof createServiceSupabaseClient>;
  try {
    service = createServiceSupabaseClient();
  } catch {
    return Response.json({ error: "Could not check this file." }, { status: 503, headers });
  }
  const { data: chunks } = await service
    .from("document_chunks")
    .select("id, content, page_number, revision")
    .eq("document_id", documentId)
    .eq("owner_id", user.id)
    .eq("revision", currentRevision)
    .order("chunk_index", { ascending: true })
    .limit(12);
  const chunk = (chunks ?? []).find((row) => typeof row.content === "string" && row.content.trim().length > 0);
  if (!chunk) {
    const stale = Number(document.chunk_count) > 0;
    return Response.json({
      view: adaptPhase3Evidence({ ...base, present: stale, revision: stale ? currentRevision - 1 : currentRevision, ocr: stale ? "ready" : "missing" })
    }, { headers });
  }
  return Response.json({
    view: adaptPhase3Evidence({
      ...base,
      blockKey: chunk.id,
      pageNumber: chunk.page_number,
      present: true,
      ocr: "ready",
      excerpt: chunk.content.trim().slice(0, 1200),
      excerptVerified: true
    })
  }, { headers });
}
