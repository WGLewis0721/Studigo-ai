import type { SupabaseClient } from "@supabase/supabase-js";

/** How many recent attempts on a topic count toward its mastery score. */
const ATTEMPT_WINDOW = 12;
const MASTERED_THRESHOLD = 85;
const LEARNING_THRESHOLD = 1;

/**
 * Mastery is earned, not displayed. A topic's score is the learner's recent
 * performance on it, weighted so the latest attempts matter most, and damped
 * while the evidence is thin — three lucky answers is not mastery.
 */
export async function recalculateTopicMastery(args: {
  supabase: SupabaseClient;
  topicId: string;
}): Promise<number> {
  const { data: attempts } = await args.supabase
    .from("quiz_attempts")
    .select("score, created_at")
    .eq("topic_id", args.topicId)
    .order("created_at", { ascending: false })
    .limit(ATTEMPT_WINDOW);

  const rows = (attempts ?? []) as Array<{ score: number }>;
  if (!rows.length) return 0;

  let weightedTotal = 0;
  let weightSum = 0;
  rows.forEach((attempt, index) => {
    // Most recent attempt carries the most weight, decaying smoothly.
    const weight = 1 / (index + 1);
    weightedTotal += Number(attempt.score) * weight;
    weightSum += weight;
  });

  const raw = weightedTotal / weightSum;
  // Confidence damping: full credit needs at least four attempts on the topic.
  const confidence = Math.min(1, rows.length / 4);
  const score = Math.round(raw * (0.55 + 0.45 * confidence));

  const status =
    score >= MASTERED_THRESHOLD && rows.length >= 4
      ? "mastered"
      : rows.length >= LEARNING_THRESHOLD
        ? "learning"
        : "not_started";

  await args.supabase
    .from("topics")
    .update({
      mastery_score: score,
      status,
      last_practiced_at: new Date().toISOString()
    })
    .eq("id", args.topicId);

  return score;
}

/**
 * Spaced repetition for flashcards: an SM-2 style schedule, simplified to the
 * three ratings a learner will actually use.
 */
export function scheduleFlashcard(args: {
  rating: 1 | 2 | 3;
  ease: number;
  intervalDays: number;
  repetitions: number;
}) {
  const quality = args.rating === 3 ? 5 : args.rating === 2 ? 3 : 1;
  let ease = args.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ease = Math.min(3.2, Math.max(1.3, ease));

  let repetitions = args.repetitions;
  let intervalDays: number;

  if (quality < 3) {
    // Missed: back to the front of the queue, later today.
    repetitions = 0;
    intervalDays = 0;
  } else {
    repetitions += 1;
    intervalDays =
      repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(args.intervalDays * ease) || 3;
  }

  const dueAt = new Date();
  if (intervalDays === 0) {
    dueAt.setMinutes(dueAt.getMinutes() + 10);
  } else {
    dueAt.setDate(dueAt.getDate() + intervalDays);
  }

  return { ease: Number(ease.toFixed(2)), intervalDays, repetitions, dueAt: dueAt.toISOString() };
}

/** Flashcard reviews feed mastery too, at a lower weight than quiz answers. */
export function flashcardRatingToScore(rating: 1 | 2 | 3) {
  return rating === 3 ? 90 : rating === 2 ? 60 : 20;
}
