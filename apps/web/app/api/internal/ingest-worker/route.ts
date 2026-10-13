import { runIngestWorker } from "@/lib/ingest";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runIngestWorker({ deadlineMs: 240_000 });
  return Response.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
