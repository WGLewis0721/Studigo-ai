/**
 * Spaced-repetition scheduling, FSRS-style (Free Spaced Repetition Scheduler):
 * memory strength is modeled as "stability" in days under an exponential
 * forgetting curve R(t) = exp(-t / stability). A successful recall grows
 * stability more when the recall was harder (lower retrievability at review
 * time); a failure decays it. This is the same forgetting-curve family used
 * by Duolingo's half-life regression and by SuperMemo/FSRS — closed-form,
 * no training required.
 */

const MIN_STABILITY_DAYS = 1;
const SUCCESS_GROWTH = 1.3;
const FAILURE_DECAY = 0.5;
/** Interval scheduling targets this retrievability at the next review. */
const TARGET_RETRIEVABILITY = 0.9;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Retrievability: probability of successful recall right now, given elapsed time since last practice. */
export function retrievability(stabilityDays: number, elapsedDays: number): number {
  if (stabilityDays <= 0) return 0;
  return Math.exp(-elapsedDays / stabilityDays);
}

export function updateStability(
  stabilityDays: number,
  elapsedDays: number,
  correct: boolean,
): number {
  const r = retrievability(stabilityDays, Math.max(0, elapsedDays));
  if (correct) {
    // Recalling something you were more likely to have forgotten (low r) proves stronger retention gain.
    const grown = stabilityDays * (1 + SUCCESS_GROWTH * (1 - r));
    return Math.max(MIN_STABILITY_DAYS, grown);
  }
  return Math.max(MIN_STABILITY_DAYS, stabilityDays * FAILURE_DECAY);
}

/** Days until the item should be reviewed again to hold retrievability at the target. */
export function nextIntervalDays(stabilityDays: number): number {
  return stabilityDays * -Math.log(TARGET_RETRIEVABILITY);
}

export function daysSince(lastPracticedAt: number | null, now: number): number {
  if (lastPracticedAt === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - lastPracticedAt) / DAY_MS);
}

export function isDueForReview(
  stabilityDays: number,
  lastPracticedAt: number | null,
  now: number,
): boolean {
  if (lastPracticedAt === null) return true;
  return daysSince(lastPracticedAt, now) >= nextIntervalDays(stabilityDays);
}
