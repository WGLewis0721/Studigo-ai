import { requireApiUser } from "@/lib/auth";
import {
  flashcardRatingToScore,
  recalculateTopicMastery,
  scheduleFlashcard
} from "@/lib/mastery";

export const runtime = "nodejs";

/** Records one card review: reschedules the card and moves its topic's mastery. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { cardId?: string; rating?: number }
    | null;
  const cardId = body?.cardId?.trim();
  const rating = body?.rating;

  if (!cardId || (rating !== 1 && rating !== 2 && rating !== 3)) {
    return Response.json(
      { error: "cardId and a rating of 1 (missed), 2 (hard), or 3 (got it) are required" },
      { status: 400 }
    );
  }

  const { data: card } = await supabase
    .from("flashcards")
    .select("id, room_id, topic_id, ease, interval_days, repetitions")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) return Response.json({ error: "Card not found" }, { status: 404 });

  const next = scheduleFlashcard({
    rating,
    ease: Number(card.ease),
    intervalDays: Number(card.interval_days),
    repetitions: Number(card.repetitions)
  });

  await supabase
    .from("flashcards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_at: next.dueAt,
      last_rating: rating
    })
    .eq("id", cardId);

  let mastery: number | null = null;
  if (card.topic_id) {
    // A card review is weaker evidence than a quiz answer, but it is evidence:
    // it is recorded as an attempt so mastery reflects all real practice.
    await supabase.from("quiz_attempts").insert({
      question_id: null,
      source: "flashcard",
      room_id: card.room_id,
      owner_id: user.id,
      topic_id: card.topic_id,
      response: `flashcard:${rating}`,
      is_correct: rating === 3,
      score: flashcardRatingToScore(rating),
      feedback: null
    });
    mastery = await recalculateTopicMastery({ supabase, topicId: card.topic_id as string });
  }

  return Response.json({ cardId, dueAt: next.dueAt, intervalDays: next.intervalDays, mastery });
}
