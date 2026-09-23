import type { BktParams } from "./types.js";

/**
 * Bayesian Knowledge Tracing (Corbett & Anderson, 1994): a two-state Hidden
 * Markov Model per skill. Given the current P(learned) and one observed
 * attempt, this computes the posterior P(learned | evidence) via Bayes' rule,
 * then applies the fixed transition probability P(T) to account for the
 * chance the learner mastered the skill during this practice opportunity.
 *
 * This is a pure function over floats — no external state, no model calls,
 * O(1) per update. It is the standard formulation used by Carnegie Mellon's
 * Cognitive Tutors and by most intelligent-tutoring-system literature since.
 */
export function updateMastery(
  priorPLearned: number,
  correct: boolean,
  params: BktParams,
): number {
  const pL = clamp01(priorPLearned);
  const { pSlip, pGuess, pTransit } = params;

  const posterior = correct
    ? bayesPosteriorCorrect(pL, pSlip, pGuess)
    : bayesPosteriorIncorrect(pL, pSlip, pGuess);

  const withLearning = posterior + (1 - posterior) * pTransit;
  return clamp01(withLearning);
}

function bayesPosteriorCorrect(pL: number, pSlip: number, pGuess: number): number {
  const numerator = pL * (1 - pSlip);
  const denominator = numerator + (1 - pL) * pGuess;
  if (denominator <= 0) return pL;
  return numerator / denominator;
}

function bayesPosteriorIncorrect(pL: number, pSlip: number, pGuess: number): number {
  const numerator = pL * pSlip;
  const denominator = numerator + (1 - pL) * (1 - pGuess);
  if (denominator <= 0) return pL;
  return numerator / denominator;
}

/** Predicted probability of a correct response given the current mastery estimate, before observing it. */
export function predictCorrectness(pLearned: number, params: BktParams): number {
  const pL = clamp01(pLearned);
  return pL * (1 - params.pSlip) + (1 - pL) * params.pGuess;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
