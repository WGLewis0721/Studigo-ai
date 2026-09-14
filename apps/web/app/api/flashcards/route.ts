import { generateFlashcards } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, markersToCitations, retrieveForRoom } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_CARDS = 20;

/** Returns the cards that are due now, oldest due first. */
export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const topicId = new URL(request.url).searchParams.get("topicId");
  let query = supabase
    .from("flashcards")
    .select("id, front, back, citations, due_at, repetitions, topic_id, learner_edited")
    .eq("room_id", roomId)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(MAX_CARDS);
  if (topicId) query = query.eq("topic_id", topicId);
  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cards: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string | null; count?: number }
    | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const count = Math.min(MAX_CARDS, Math.max(1, Math.round(body?.count ?? 10)));

  type CardTopic = { id: string; title: string; objective: string | null };
  let topic: CardTopic | null = null;
  if (body?.topicId) {
    const { data } = await supabase
      .from("topics")
      .select("id, title, objective").eq("active", true)
      .eq("id", body.topicId)
      .eq("room_id", roomId)
      .maybeSingle();
    topic = (data as CardTopic | null) ?? null;
  }

  const query = topic
    ? `${topic.title}. ${topic.objective ?? ""}`
    : "key terms, definitions, and processes worth memorizing in these materials";

  const chunks = await retrieveForRoom({ supabase, roomId, query, matchCount: 14 });
  if (!chunks.length) {
    return Response.json(
      { error: "There isn't enough processed material in this room to build cards yet." },
      { status: 400 }
    );
  }

  const generated = await generateFlashcards({ chunks, topicTitle: topic?.title, count });
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
        topic_id: topic?.id ?? null,
        front: card.front,
        back: card.back,
        citations: markersToCitations(card.sourceMarkers, chunks)
      }))
    )
    .select("id, front, back, citations, due_at, repetitions, topic_id, learner_edited");

  if (error) {
    return Response.json({ error: "Saving the cards failed", detail: error.message }, { status: 500 });
  }

  return Response.json({ cards: inserted ?? [] });
}
