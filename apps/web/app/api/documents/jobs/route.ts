import { requireApiUser } from "@/lib/auth";
import { visibleIngestStage } from "@/lib/ingest-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });
  const { data, error } = await supabase
    .from("ingest_jobs")
    .select("id, document_id, stage, attempts, result")
    .eq("id", jobId)
    .maybeSingle();
  if (error) return Response.json({ error: "Could not read that job." }, { status: 500 });
  if (!data) return Response.json({ error: "Job not found" }, { status: 404 });
  return Response.json({
    jobId: data.id,
    documentId: data.document_id,
    stage: data.stage,
    visible: visibleIngestStage(data.stage),
    attempts: data.attempts
  });
}
