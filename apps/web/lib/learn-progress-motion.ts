import type { LearnPhase } from "./learning-mission-stages";

/**
 * The existing five persisted Guided Learn phases, not an estimate of mastery.
 * Every successful phase advance increases the visibly filled lane by >= 22%.
 * Reviewing an answer alone does not advance the phase or the meter.
 */
export const LEARN_PROGRESS_PERCENT: Readonly<Record<LearnPhase, number>> = {
  brief: 12,
  show: 34,
  try: 56,
  check: 78,
  done: 100
};

/** Brand tokens, never a new room/mode palette. */
export const LEARN_PROGRESS_HEAT: Readonly<Record<LearnPhase, string>> = {
  brief: "var(--tangerine)",
  show: "color-mix(in oklab, var(--tangerine) 65%, var(--dandelion))",
  try: "var(--dandelion)",
  check: "color-mix(in oklab, var(--kiwi) 78%, var(--dandelion))",
  done: "var(--kiwi)"
};

export function learnPhaseProgress(phase: LearnPhase): number {
  return LEARN_PROGRESS_PERCENT[phase];
}
export function isForwardLearnAdvance(
  previous: { topicId: string; phase: LearnPhase } | null,
  next: { topicId: string; phase: LearnPhase }
): boolean {
  return Boolean(previous && previous.topicId === next.topicId &&
    learnPhaseProgress(next.phase) > learnPhaseProgress(previous.phase));
}
