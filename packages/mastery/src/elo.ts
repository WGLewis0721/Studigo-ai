/**
 * Elo rating applied to education (Pelánek, "Applications of the Elo Rating
 * System in Adaptive Educational Systems", 2016). Learner ability and item
 * difficulty live on the same rating scale; each attempt is treated as a
 * "match" between the learner and the item. This gives item-vs-learner
 * difficulty matching with the same closed-form update used for chess
 * ratings — no training data, no model, O(1) per update.
 */

/** Ability update rate. Higher = ability reacts faster to recent evidence. */
export const ABILITY_K = 32;
/** Item difficulty update rate. Lower than ability's K because a well-calibrated
 * item is shared across many learners and should drift slowly. */
export const ITEM_K = 8;

/** Probability the learner answers an item of the given difficulty correctly, under the Elo logistic model. */
export function expectedScore(ability: number, difficulty: number): number {
  return 1 / (1 + Math.pow(10, (difficulty - ability) / 400));
}

export function updateAbility(ability: number, difficulty: number, correct: boolean): number {
  const expected = expectedScore(ability, difficulty);
  const actual = correct ? 1 : 0;
  return ability + ABILITY_K * (actual - expected);
}

export function updateDifficulty(ability: number, difficulty: number, correct: boolean): number {
  const expected = expectedScore(ability, difficulty);
  const actual = correct ? 1 : 0;
  // Difficulty moves opposite the learner: an unexpected correct answer means the item was easier than rated.
  return difficulty + ITEM_K * (expected - actual);
}
