import { guardAiRequest } from "@/lib/ai-admission";
import { generateFlashcards } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, markersToCitations, retrieveForRoom } from "@/lib/retrieval";
import { selectPracticeTopics } from "@/lib/practice-topic-selection";
import { allocateTestQuestions } from "@/lib/study-planning";
import { TOPIC_COLUMNS, type Topic } from "@/lib/rooms";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_CARDS = 20;

/** Returns the cards that are due now, oldest due first. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId");
  const topicIdsParam = url.searchParams.get("topicIds");
  let topicIds: string[] | null = null;
  if (topicIdsParam !== null) {
    const { data, error } = await supabase.from("topics").select("id").eq("active", true).eq("room_id", roomId);
    if (error) return Response.json({ error: "Could not load the current study scope." }, { status: 500 });
    const selected = selectPracticeTopics(data ?? [], topicIdsParam.split(","));
    if (!selected) return Response.json({ error: "Select one or more current topics in this room." }, { status: 400 });
    topicIds = selected.map((topic) => topic.id);
  }
  let query = supabase
    .from("flashcards")
    .select("id, front, back, citations, due_at, repetitions, topic_id, learner_edited")
    .eq("room_id", roomId)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(MAX_CARDS);
  if (topicIds) query = query.in("topic_id", topicIds);
  else if (topicId) query = query.eq("topic_id", topicId);
  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cards: data ?? [] });
}

async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string | null; topicIds?: unknown; count?: number }
    | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const count = Math.min(MAX_CARDS, Math.max(1, Math.round(body?.count ?? 10)));

  const { data: rows, error: topicError } = await supabase.from("topics")
    .select(TOPIC_COLUMNS).eq("active", true).eq("room_id", roomId);
  if (topicError) return Response.json({ error: "Could not load the current study scope." }, { status: 500 });
  const available = (rows ?? []) as Topic[];
  const selected = body?.topicIds === undefined ? null : selectPracticeTopics(available, body.topicIds);
  if (body?.topicIds !== undefined && !selected) return Response.json({ error: "Select one or more current topics in this room." }, { status: 400 });
  const legacy = body?.topicId ? available.find((topic) => topic.id === body.topicId) : null;
  if (body?.topicId && !legacy) return Response.json({ error: "That topic is no longer in this room." }, { status: 400 });
  const allocation: Array<{ topic: Topic | null; count: number }> = selected
    ? allocateTestQuestions(selected, count)
    : [{ topic: legacy ?? null, count }];
  const generated: Array<{ front: string; back: string; topic_id: string | null; citations: ReturnType<typeof markersToCitations> }> = [];
  try {
    for (let offset = 0; offset < allocation.length; offset += 2) {
      const batches = await Promise.all(allocation.slice(offset, offset + 2).map(async ({ topic, count: topicCount }) => {
        const query = topic ? `${topic.title}. ${topic.objective ?? ""}` : "key terms, definitions, and processes worth memorizing in these materials";
        const chunks = await retrieveForRoom({ supabase, roomId, query, matchCount: Math.min(14, Math.max(6, topicCount * 2)) });
        if (!chunks.length) throw new Error(topic ? `Add supporting material for “${topic.title}” before making cards.` : "There isn't enough processed material to build cards yet.");
        const cards = await generateFlashcards({ chunks, topicTitle: topic?.title, count: topicCount });
        return cards.slice(0, topicCount).map((card) => ({
          front: card.front, back: card.back, topic_id: topic?.id ?? null,
          citations: markersToCitations(card.sourceMarkers, chunks)
        }));
      }));
      generated.push(...batches.flat());
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not build cards." }, { status: 422 });
  }
  if (!generated.length) {
    return Response.json({ error: "Studigo couldn't build grounded cards from this material." }, { status: 422 });
  }

  // Re-generating should not flood the deck with duplicates of cards the
  // learner is already reviewing.
  const { data: existing } = await supabase
    .from("flashcards")
    .select("front")
    .eq("room_id", roomId);

  const seen = new Set(
    ((existing ?? []) as Array<{ front: string }>).map((card) =>
      card.front.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    )
  );

  const fresh = generated.filter((card) => {
    const key = card.front.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!fresh.length) {
    return Response.json({ cards: [], note: "Your deck already covers this material." });
  }

  const { data: inserted, error } = await createServiceSupabaseClient()
    .from("flashcards")
    .insert(
      fresh.map((card) => ({
        room_id: roomId,
        owner_id: user.id,
        topic_id: card.topic_id,
        front: card.front,
        back: card.back,
        citations: card.citations
      }))
    )
    .select("id, front, back, citations, due_at, repetitions, topic_id, learner_edited");

  if (error) {
    return Response.json({ error: "Saving the cards failed" }, { status: 500 });
  }

  return Response.json({ cards: inserted ?? [] });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "flashcards-generate", guardedPost);
}
