import { generateMathProblems, type MathProblem } from "@/lib/learning";
import { mathPrompt } from "@/lib/math-copy";
import { mathFamilyForTopic, mathPracticeEnabled, mathPresentation, mathSolution, type MathPresentation, type MathSolutionStep } from "@/lib/math-practice";

/**
 * One worked example drawn by code for a topic Learn explains. It is Studigo's
 * own made-up problem, not a passage from the learner's materials, so it
 * carries no citation. Looking at it is not an attempt: nothing here is stored.
 * The caption is the problem with the blank marker where the answer goes; the
 * answer appears only in the last step.
 */
export type MathExample = {
  caption: string;
  presentation: MathPresentation;
  steps: MathSolutionStep[];
};

export function mathExampleFor(problem: MathProblem): MathExample {
  return { caption: mathPrompt(problem), presentation: mathPresentation(problem), steps: mathSolution(problem) };
}

/** Null when the topic has no math family or STUDIGO_MATH_PRACTICE=0, which leaves Learn exactly as it was. */
export function mathExampleForTopic(
  topic: Parameters<typeof mathFamilyForTopic>[0],
  room: Parameters<typeof mathFamilyForTopic>[1] = {},
  random?: () => number
): MathExample | null {
  if (!mathPracticeEnabled()) return null;
  const family = mathFamilyForTopic(topic, room);
  if (!family) return null;
  const [problem] = generateMathProblems(family, 1, random);
  return problem ? mathExampleFor(problem) : null;
}
