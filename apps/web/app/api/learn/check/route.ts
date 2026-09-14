import { askSocraticQuestion, respondToSocraticAnswer } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { readExplainLevel } from "@/lib/explain-level";
import { assertRoomAccess, retrieveForRoom } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * The Socratic check inside Learn mode: Studigo asks the learner to explain the
 * idea back, then responds to what they said.
 *
 * This is formative on purpose. It records no attempt and moves no mastery —
 * mastery is earned in Quiz, where the learner knows they are being measured.
 */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string; question?: string; answer?: string }
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
    .eq("active", true)
    .eq("id", topicId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (!topic) return Response.json({ error: "Topic not found" }, { status: 404 });

  const level = await readExplainLevel(supabase, roomId);
  const query = [topic.title, topic.objective, (topic.key_terms as string[] | null)?.join(", ")]
    .filter(Boolean)
    .join(". ");
  const chunks = await retrieveForRoom({ supabase, roomId, query, matchCount: 10 });

  if (!chunks.length) {
    return Response.json(
      { error: "There isn't enough processed material on this topic to check your understanding." },
      { status: 400 }
    );
  }

  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  // No answer yet: open the check with a question.
  if (!answer) {
    const asked = await askSocraticQuestion({
      topicTitle: topic.title as string,
      objective: (topic.objective as string | null) ?? null,
      chunks,
      level
    });
    return Response.json({ topicId, question: asked.question });
  }

  if (!question) {
    return Response.json({ error: "Start a check before answering it." }, { status: 400 });
  }

  const response = await respondToSocraticAnswer({
    topicTitle: topic.title as string,
    question,
    learnerAnswer: answer,
    chunks,
    level
  });

  return Response.json({ topicId, ...response });
}
