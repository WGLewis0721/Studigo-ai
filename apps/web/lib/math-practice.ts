import { generateMathProblems, mathAnswerText, mathVisual, validateMathProblem, type MathFamily, type MathProblem, type MathVisual } from "@/lib/learning";
import { describeMathVisual, mathPrompt, mathSteps } from "@/lib/math-copy";

/**
 * Marks a quiz row as code-generated math. It rides in accepted_answers, which
 * is answer-key data and never sent to the learner, and carries the problem's
 * integers so the grader can rebuild the key instead of trusting a stored one.
 */
const MATH_KEY_PREFIX = "studigo-math:v1:";

/** Rollback switch. Set STUDIGO_MATH_PRACTICE=0 to send every topic back to model-written questions. */
export function mathPracticeEnabled(): boolean {
  return process.env.STUDIGO_MATH_PRACTICE !== "0";
}

export function isMathKey(answer: string): boolean {
  return answer.startsWith(MATH_KEY_PREFIX);
}

function encodeMathKey(problem: MathProblem): string {
  return `${MATH_KEY_PREFIX}${JSON.stringify(problem)}`;
}

/**
 * The math problem behind a stored question. Null for an ordinary question.
 * "invalid" means the row is marked as math but does not hold a problem this
 * code would have written, so it must be refused, never graded another way.
 */
export function readMathKey(acceptedAnswers: readonly string[] | null | undefined): MathProblem | "invalid" | null {
  const key = acceptedAnswers?.find(isMathKey);
  if (key === undefined) return null;
  try {
    return validateMathProblem(JSON.parse(key.slice(MATH_KEY_PREFIX.length))) ?? "invalid";
  } catch {
    return "invalid";
  }
}

type TopicText = { title: string; objective?: string | null; key_terms?: string[] | null };

/**
 * Which problem family, if any, practises this topic. The topic came from the
 * learner's own material; this only decides whether code can write practice
 * for it. The rule is narrow on purpose: the skill word must be in the title,
 * and any sign of a skill no family covers returns null, which leaves the
 * topic on the existing source-grounded question path.
 */
export function mathFamilyForTopic(topic: TopicText): MathFamily | null {
  const title = topic.title.toLowerCase();
  const text = [topic.title, topic.objective ?? "", ...(topic.key_terms ?? [])].join(" ").toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);

  if (/\bfractions?\b/.test(title)) {
    if (has(/\b(multipl|divid|division|mixed numbers?|improper|decimals?|percent|compar|order|word problems?)/)) return null;
    if (has(/\bequivalent\b/)) return "fraction_equivalent";
    const adds = has(/\badd(s|ing|ition)?\b/);
    const subtracts = has(/\bsubtract(s|ing|ion)?\b/);
    if (has(/\b(unlike|different) denominators?\b/)) return adds && !subtracts ? "fraction_add_unlike" : null;
    if (adds && subtracts) return null;
    if (subtracts) return "fraction_subtract_like";
    if (adds) return "fraction_add_like";
    return "fraction_name";
  }
  if (/\barea\b/.test(title)) {
    if (has(/\b(triangles?|circles?|trapezoids?|parallelograms?|surface|volume|perimeter|composite|irregular)\b/)) return null;
    return has(/\brectang(le|les|ular)\b/) ? "rect_area" : null;
  }
  if (/\b(ratios?|proportions?)\b/.test(title)) {
    return has(/\b(percent|rates?|slope|similar|trigonometr|probabilit)/) ? null : "ratio_scale";
  }
  return null;
}

export type MathPresentation = { visual: MathVisual; description: string };
export type MathSolutionStep = { text: string; visual?: MathVisual; description?: string };

/** The question-time picture and its text equivalent. Neither shows the answer. */
export function mathPresentation(problem: MathProblem): MathPresentation {
  const visual = mathVisual(problem);
  return { visual, description: describeMathVisual(visual) };
}

/** The worked steps, sent only after the learner has answered. */
export function mathSolution(problem: MathProblem): MathSolutionStep[] {
  return mathSteps(problem).map((step) => (step.visual ? { ...step, description: describeMathVisual(step.visual) } : step));
}

/**
 * Quiz rows for a family, in the existing fill-in-the-blank shape so they need
 * no schema change and reach the same attempt and mastery path. They carry no
 * citations: the topic is the learner's, the numbers are Studigo's, and a
 * citation would claim the problem appears in their material.
 */
export function buildMathQuestions(family: MathFamily, count: number) {
  return generateMathProblems(family, count).map((problem) => ({
    problem,
    row: {
      id: crypto.randomUUID(),
      kind: "fill_blank" as const,
      prompt: mathPrompt(problem),
      choices: [] as string[],
      correct_choice: null,
      expected_answer: mathAnswerText(problem),
      accepted_answers: [encodeMathKey(problem)],
      explanation: mathSteps(problem)
        .map((step) => step.text)
        .join("\n"),
      difficulty: "core" as const,
      citations: [] as never[]
    }
  }));
}
