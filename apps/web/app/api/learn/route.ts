import { explainTopic, toCitations, citationsUsedIn } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, fetchLearnMaterials, MIN_SIMILARITY, retrieveForRoom } from "@/lib/retrieval";
import { readExplainLevel } from "@/lib/explain-level";
import { classifyLearnOutcome, isLearnSuccess, learnOutcomeMessage, type LearnOutcome } from "@/lib/learn-outcome";
import { writeStudyTrace } from "@/lib/study-trace";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Learn mode: teach one topic from this room's own materials, with citations. */
export async function POST(request: Request) {
  const started = Date.now();
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string }
    | null;
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  const topicId = typeof body?.topicId === "string" ? body.topicId.trim() : "";

  if (!roomId || !topicId) {
    return Response.json({ error: "roomId and topicId are required" }, { status: 400 });
  }

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const recordOutcome = (outcome: LearnOutcome, chunkIds: string[] = []) => writeStudyTrace({
    route: "api/learn", ownerId: user.id, chunkIds, cutoff: MIN_SIMILARITY,
    tokenEstimate: 0, latencyMs: Date.now() - started,
    reasonCode: outcome.reasonCode, readyCount: outcome.counts.ready,
    processingCount: outcome.counts.processing, failedCount: outcome.counts.failed
  });
  const outcomeResponse = (outcome: LearnOutcome, status: number) => {
    recordOutcome(outcome);
    return Response.json({ outcome, error: learnOutcomeMessage(outcome.reasonCode) }, { status });
  };

  let materials;
  try { materials = await fetchLearnMaterials(supabase, roomId); }
  catch { return outcomeResponse(classifyLearnOutcome({ error: "retrieval_error" }), 503); }

  let level;
  try { level = await readExplainLevel(supabase, roomId); }
  catch { return outcomeResponse(classifyLearnOutcome({ materials, error: "retrieval_error" }), 503); }

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, title, objective, key_terms").eq("active", true)
    .eq("id", topicId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (topicError) return outcomeResponse(classifyLearnOutcome({ materials, error: "retrieval_error" }), 503);
  if (!topic) return outcomeResponse(classifyLearnOutcome({ materials, error: "invalid_topic_scope" }), 400);

  const availability = classifyLearnOutcome({ materials });
  if (!isLearnSuccess(availability)) return outcomeResponse(availability, 409);

  const query = [topic.title, topic.objective, (topic.key_terms as string[] | null)?.join(", ")]
    .filter(Boolean)
    .join(". ");

  let chunks;
  try { chunks = await retrieveForRoom({ supabase, roomId, query, matchCount: 10 }); }
  catch { return outcomeResponse(classifyLearnOutcome({ materials, error: "retrieval_error" }), 503); }
  const outcome = classifyLearnOutcome({ materials, evidenceCount: chunks.length });
  if (!isLearnSuccess(outcome)) return outcomeResponse(outcome, 422);

  let explanation;
  try {
    explanation = await explainTopic({
      topicTitle: topic.title as string,
      objective: (topic.objective as string | null) ?? null,
      chunks,
      level
    });
  } catch {
    return outcomeResponse(classifyLearnOutcome({ materials, error: "generation_error" }), 503);
  }
  const citations = citationsUsedIn(explanation, toCitations(chunks));
  if (!citations.length) return outcomeResponse(classifyLearnOutcome({ materials, error: "generation_error" }), 503);
  recordOutcome(outcome, chunks.map((chunk) => chunk.id));

  return Response.json({
    topicId,
    level,
    explanation,
    citations,
    outcome
  });
}
