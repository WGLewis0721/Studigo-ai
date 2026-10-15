/** How much of a hint to give after this many presses in a row (1, 2, 3...). */
export function nextHint(consecutiveHints: number): "hint" | "stronger" | "reveal" {
  if (consecutiveHints >= 3) return "reveal";
  if (consecutiveHints === 2) return "stronger";
  return "hint";
}

/** A hint continues the streak. Any other action starts it over. */
export function hintStreak(previous: number, action: "hint" | "other"): number {
  return action === "hint" ? previous + 1 : 0;
}

/**
 * Shape of an acceptable answer, then the same question again.
 * The question string is not rewritten.
 */
export function exampleTurn(question: string, expectedShape: string): { example: string; question: string } {
  const shape = expectedShape.trim();
  return {
    example: shape
      ? `An acceptable answer has this shape: ${shape}`
      : "An acceptable answer names the idea and what it does.",
    question
  };
}
