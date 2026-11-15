import { SLEEP_AFTER_MS, type CompanionEvent } from "./companion-logic";

/* The per-session mood meter ("Spark") from design/living-companion/MOOD_METER.md.
   Presentation only. It is held in memory by the caller and is never stored, sent, or read by
   grading, mastery, progression or evidence. Mistakes never lower it. */

export const SPARK_MIN = 0;
export const SPARK_MAX = 4;
export const SPARK_START = 2;
/** While the learner is active, mood never drops below this. A low tier means calm or sleepy, never sad. */
export const SPARK_ACTIVE_FLOOR = 1;
export const SPARK_HALF_LIFE_MS = 90_000;
/** Per-event change, all within the ±2 bound. Events not listed here contribute 0. */
const DELTA: Partial<Record<CompanionEvent, number>> = {
  correct: 1,
  correctFast: 1,
  cardGood: 0.5,
  setDone: 2,
  missionComplete: 2
};

/** Mistakes and neutral events never lower mood. `wrong`, `blindspot`, `cardMiss`, `stall`, `hintOpened` contribute 0. */
export const MOOD_EVENTS_NEUTRAL: readonly CompanionEvent[] = ["wrong", "blindspot", "cardMiss", "stall", "hintOpened"];

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

/** Pulls spark toward its resting value. Active learners rest at SPARK_START; idle learners drift toward 0 (sleepy). */
function decay(spark: number, dtMs: number, idleMs: number): number {
  if (dtMs <= 0) return spark;
  const target = idleMs >= SLEEP_AFTER_MS ? SPARK_MIN : SPARK_START;
  const keep = Math.pow(0.5, dtMs / SPARK_HALF_LIFE_MS);
  return target + (spark - target) * keep;
}

/**
 * Pure step: decays spark over `dtMs`, then applies one committed event (or none).
 * `idleMs` is time since the learner last acted. `sessionReturn` resets to the start value.
 * Deterministic for a given input, so it can be tested at any frame rate.
 */
export function nextSpark(spark: number, event: CompanionEvent | null, dtMs: number, idleMs = 0): number {
  const active = idleMs < SLEEP_AFTER_MS;
  let next = clamp(spark, SPARK_MIN, SPARK_MAX);
  if (event === "sessionReturn") return SPARK_START;
  next = decay(next, dtMs, idleMs);
  if (event) {
    const delta = clamp(DELTA[event] ?? 0, -2, 2);
    next = next + delta;
  }
  next = clamp(next, SPARK_MIN, SPARK_MAX);
  return active ? Math.max(next, SPARK_ACTIVE_FLOOR) : next;
}

/** Five tiers, as in MOOD_METER.md: 0 Cozy, 1 Calm, 2 Sunny, 3 Bouncy, 4 Sparkling. */
export function moodTier(spark: number): 0 | 1 | 2 | 3 | 4 {
  return clamp(Math.round(spark), 0, 4) as 0 | 1 | 2 | 3 | 4;
}
