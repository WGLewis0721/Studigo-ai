import { updateMastery } from "./bkt.js";
import { expectedScore, updateAbility, updateDifficulty } from "./elo.js";
import { daysSince, isDueForReview, retrievability, updateStability } from "./scheduler.js";
import {
  DEFAULT_ABILITY,
  DEFAULT_BKT_PARAMS,
  MASTERY_THRESHOLD,
  type Attempt,
  type BktParams,
  type Item,
  type MasteryState,
  type PracticeAssignment,
} from "./types.js";

/**
 * The deterministic coaching-loop decision layer: diagnose (via BKT mastery
 * per skill), adjust difficulty (via Elo ability/item matching), and assign
 * the next best practice (via mastery gap + spaced-repetition due-ness). No
 * language model is involved — this is the "what to practice next" policy,
 * kept separate from content generation so the recommendation itself is
 * deterministic, unit-testable, and reproducible across runs.
 */

export function initialMasteryState(skillId: string): MasteryState {
  return {
    skillId,
    pLearned: DEFAULT_BKT_PARAMS.pInit,
    ability: DEFAULT_ABILITY,
    stability: 1,
    lastPracticedAt: null,
    attemptCount: 0,
    correctCount: 0,
  };
}

export interface RecordAttemptResult {
  state: MasteryState;
  updatedItemDifficulty: number;
}

/**
 * Applies one attempt to a skill's mastery state: BKT posterior update for
 * P(learned), Elo update for ability and item difficulty, and spaced-
 * repetition stability update. All three models observe the same attempt
 * independently and are combined only at the recommendation stage.
 */
export function recordAttempt(
  state: MasteryState,
  attempt: Attempt,
  item: Pick<Item, "difficulty">,
  now: number,
  bktParams: BktParams = DEFAULT_BKT_PARAMS,
): RecordAttemptResult {
  const elapsedDays = daysSince(state.lastPracticedAt, now);
  const pLearned = updateMastery(state.pLearned, attempt.correct, bktParams);
  const ability = updateAbility(state.ability, item.difficulty, attempt.correct);
  const updatedItemDifficulty = updateDifficulty(state.ability, item.difficulty, attempt.correct);
  const stability = updateStability(
    state.stability,
    Number.isFinite(elapsedDays) ? elapsedDays : 0,
    attempt.correct,
  );

  return {
    state: {
      skillId: state.skillId,
      pLearned,
      ability,
      stability,
      lastPracticedAt: attempt.at,
      attemptCount: state.attemptCount + 1,
      correctCount: state.correctCount + (attempt.correct ? 1 : 0),
    },
    updatedItemDifficulty,
  };
}

/**
 * Ranks skills for the next practice assignment. Priority order matches the
 * coaching loop: skills never attempted first, then skills below the
 * mastery threshold (worse mastery ranks higher), then skills merely due for
 * spaced review. Target difficulty always matches the learner's current
 * ability for that skill, so the next item is neither trivial nor punishing.
 */
export function recommendNextPractice(
  states: MasteryState[],
  now: number,
  masteryThreshold: number = MASTERY_THRESHOLD,
): PracticeAssignment[] {
  const assignments = states.map((state): PracticeAssignment => {
    if (state.lastPracticedAt === null) {
      return {
        skillId: state.skillId,
        reason: "never_practiced",
        targetDifficulty: state.ability,
        priority: 100,
      };
    }

    if (state.pLearned < masteryThreshold) {
      const gap = masteryThreshold - state.pLearned;
      return {
        skillId: state.skillId,
        reason: "below_mastery_threshold",
        targetDifficulty: state.ability,
        priority: 50 + gap * 50,
      };
    }

    const forgetting = 1 - retrievability(state.stability, daysSince(state.lastPracticedAt, now));
    const due = isDueForReview(state.stability, state.lastPracticedAt, now);
    return {
      skillId: state.skillId,
      reason: "due_for_review",
      targetDifficulty: state.ability,
      priority: due ? 10 + forgetting * 10 : forgetting,
    };
  });

  return assignments.sort((a, b) => b.priority - a.priority);
}

export { expectedScore };
