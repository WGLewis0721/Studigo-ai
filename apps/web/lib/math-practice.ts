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

const MATH_SUBJECT = /\b(maths?|mathematics|arithmetic|numeracy|pre-?algebra|algebra|geometry)\b/;
const OTHER_DENOMINATORS = /\b(unlike|different|common|least common) denominators?\b|\bunlike fractions?\b/;
const UNCOVERED_FRACTION_SKILL =
  /\b(add|subtract|multipl|divid|division|mixed numbers?|improper|decimals?|percent|compar|order|simplif|reduc|reciprocal|number lines?|word problems?|common denominators?)/;
const NOT_SIMPLE_RATIO = /\b(percent|rates?|slope|similar|trigonometr|probabilit|statistic|moles?\b|stoichiometr|financ|odds|genotyp|phenotyp|gear)/;

/** "Unit 3: Equivalent Fractions." becomes "equivalent fractions". */
function bareTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\s*(chapter|unit|lesson|section|topic|part|module|week)\s+[\w.]+\s*[:.\-–—]\s*/, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which problem family, if any, practises this topic. The topic came from the
 * learner's own material; this only decides whether code can write practice
 * for it. A wrong match swaps source-grounded questions for arithmetic the
 * learner never asked for, so the rule is narrow on purpose: the whole title
 * must be one of a few elementary phrasings ("Financial Ratios" and "Ejection
 * Fraction" are not), the objective and key terms can only rule a topic out,
 * and a room whose subject is set to something other than math gets nothing.
 * Null leaves the topic on the existing question path.
 */
export function mathFamilyForTopic(topic: TopicText, room: { subject?: string | null } = {}): MathFamily | null {
  const subject = room.subject?.trim().toLowerCase();
  if (subject && !MATH_SUBJECT.test(subject)) return null;

  const title = bareTitle(topic.title);
  const text = [topic.title, topic.objective ?? "", ...(topic.key_terms ?? [])].join(" ").toLowerCase();

  if (/^(?:introduction to |intro to |understanding |identifying |naming |what is a |what are )?fractions?(?: basics| as parts of a whole)?$/.test(title)) {
    return UNCOVERED_FRACTION_SKILL.test(text) ? null : "fraction_name";
  }
  if (/^(?:finding |identifying |making |recognizing |recognising )?equivalent fractions?$/.test(title)) return "fraction_equivalent";
  if (/^(?:adding|addition of|add) (?:like |unlike )?fractions?(?: with (?:like|unlike|the same|same|different|common) denominators?)?$/.test(title)) {
    return OTHER_DENOMINATORS.test(text) ? "fraction_add_unlike" : "fraction_add_like";
  }
  if (/^(?:subtracting|subtraction of|subtract) (?:like )?fractions?(?: with (?:like|the same|same) denominators?)?$/.test(title)) {
    return OTHER_DENOMINATORS.test(text) ? null : "fraction_subtract_like";
  }
  if (/^(?:finding |calculating )?(?:the )?area of (?:a |an )?(?:rectangles?|rectangles? and squares?|squares? and rectangles?)$|^rectangle area$/.test(title)) {
    return "rect_area";
  }
  if (/^(?:introduction to |intro to |understanding )?(?:ratios?|equivalent ratios?|ratio tables?|ratios? and ratio tables?|scaling ratios?)$/.test(title)) {
    return NOT_SIMPLE_RATIO.test(text) ? null : "ratio_scale";
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
