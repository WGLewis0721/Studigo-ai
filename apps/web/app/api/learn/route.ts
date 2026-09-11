import { explainTopic, toCitations, citationsUsedIn } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, retrieveForRoom } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Learn mode: teach one topic from this room's own materials, with citations. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string }
    | null;
  const roomId = body?.roomId?.trim();
  const topicId = body?.topicId?.trim();

  if (!roomId || !topicId) {
    return Response.json({ error: "roomId and topicId are required" }, { status: 400 });
  }

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, objective, key_terms")
    .eq("id", topicId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (!topic) return Response.json({ error: "Topic not found" }, { status: 404 });

  const query = [topic.title, topic.objective, (topic.key_terms as string[] | null)?.join(", ")]
    .filter(Boolean)
    .join(". ");

  const chunks = await retrieveForRoom({ supabase, roomId, query, matchCount: 10 });
  const explanation = await explainTopic({
    topicTitle: topic.title as string,
    objective: (topic.objective as string | null) ?? null,
    chunks
  });

  return Response.json({
    topicId,
    explanation,
    citations: citationsUsedIn(explanation, toCitations(chunks))
  });
}
