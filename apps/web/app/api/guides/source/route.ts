import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

/** Owner-scoped source text. This does not write or generate anything. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId")?.trim();
  const blockKey = url.searchParams.get("blockKey")?.trim();
  if (!roomId || !blockKey) return Response.json({ error: "roomId and blockKey are required" }, { status: 400 });
  const { data, error } = await supabase
    .from("source_blocks")
    .select("block_key, page_number, normalized_text")
    .eq("room_id", roomId)
    .eq("block_key", blockKey)
    .maybeSingle();
  if (error) return Response.json({ error: "Could not read that source." }, { status: 500 });
  if (!data) return Response.json({ error: "Source not found" }, { status: 404 });
  return Response.json({ blockKey: data.block_key, pageNumber: data.page_number, text: data.normalized_text });
}
