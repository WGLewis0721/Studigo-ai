import { cronAuthorized } from "@/lib/cron-auth";
import { durableIngestEnabled } from "@/lib/ingest-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One bounded pass. Does nothing until durable ingest is explicitly enabled. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!durableIngestEnabled()) return Response.json({ ran: false, reason: "disabled" });
  return Response.json({ ran: true, claimed: 0 });
}
