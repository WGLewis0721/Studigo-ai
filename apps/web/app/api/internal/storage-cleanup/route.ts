import { drainStorageCleanup } from "@/lib/storage-cleanup";
import { cronAuthorized } from "@/lib/cron-auth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await drainStorageCleanup();
  return Response.json(result);
}
