/** The database owns the phase; UI step selection must never be an
 * independent cursor. Learn transitions are formative, not mastery writes. */
export const LEARN_PHASES = ["brief", "show", "try", "check", "done"] as const;
export type LearnPhase = typeof LEARN_PHASES[number];
export function lessonBeatIndex(phase: LearnPhase, numberOfBeats: number): number | null {
  if (phase === "done" || numberOfBeats < 1) return null;
  const index = LEARN_PHASES.indexOf(phase);
  return Math.min(index, numberOfBeats - 1);
}
export function formativeReflection(phase: LearnPhase, answerReviewed: boolean, correct: boolean): "ready" | "review" | null {
  if (phase !== "try") return null;
  if (!answerReviewed) return null;
  return correct ? "ready" : "review";
}
export function canAdvanceLesson(phase: LearnPhase, paused: boolean, answered: boolean, revealed: boolean, beatIsReading: boolean): boolean {
  if (paused || phase === "done") return false;
  return beatIsReading || (answered && revealed);
}
