import { gradeBlankAnswer, gradeShortAnswer } from "@studigo/ai";
import { checkMathAnswer, type MathProblem, type UnreadableReason } from "@/lib/learning";
import { readMathKey } from "@/lib/math-practice";

/** The answer-key shape both the quiz and the practice test grade against. */
export type GradableQuestion = {
  kind: string;
  prompt: string;
  choices: string[] | null;
  correct_choice: number | null;
  expected_answer: string | null;
  accepted_answers: string[] | null;
  explanation: string | null;
};

export type GradedAnswer = {
  score: number;
  isCorrect: boolean;
  feedback: string;
};

export const UNANSWERED_FEEDBACK =
  "Unanswered. Review the explanation and try this concept again.";

const UNREADABLE_MATH: Record<UnreadableReason, string> = {
  not_a_number: "I couldn't read that as a number. Try an answer like 3/4.",
  whole_number: "Type just the missing number.",
  needs_fraction: "Write this one as a fraction, like 1/3. A decimal can't show it exactly."
};

/**
 * Code-generated math is graded by exact value, with no model call. An answer
 * that cannot be read is sent back to the learner instead of being marked wrong.
 */
function gradeMathAnswer(problem: MathProblem, response: string, allowUnanswered?: boolean): GradedAnswer {
  const check = checkMathAnswer(problem, response);
  if (check.status === "unreadable") {
    // A whole practice test is graded in one pass and cannot hand one answer back.
    if (allowUnanswered) return { score: 0, isCorrect: false, feedback: UNANSWERED_FEEDBACK };
    throw new GradingError(UNREADABLE_MATH[check.reason]);
  }
  if (check.status === "incorrect") {
    return { score: 0, isCorrect: false, feedback: `Not quite. The answer is ${check.answer}.` };
  }
  return {
    score: 100,
    isCorrect: true,
    feedback: check.simplest ? "Correct." : `Correct. In simplest form that is ${check.answer}.`
  };
}

/**
 * One grader for every question type, shared by single-question quizzes and
 * whole practice tests so the same answer is never scored two different ways.
 *
 * Only short answers cost a model call; the other three kinds are decided
 * locally, which keeps a 20-question test fast and cheap. A fill-in row that
 * carries a math key is graded by exact arithmetic instead of by spelling.
 */
export async function gradeAnswer(args: {
  question: GradableQuestion;
  response: string;
  selectedChoice: number | null;
  /** Practice tests score a blank answer as a miss instead of rejecting it. */
  allowUnanswered?: boolean;
}): Promise<GradedAnswer> {
  const { question } = args;
  const response = args.response.trim();

  switch (question.kind) {
    case "multiple_choice":
    case "true_false": {
      if (args.selectedChoice === null) {
        if (args.allowUnanswered) {
          return { score: 0, isCorrect: false, feedback: UNANSWERED_FEEDBACK };
        }
        throw new GradingError("Choose an answer first.");
      }
      const isCorrect = args.selectedChoice === question.correct_choice;
      return {
        score: isCorrect ? 100 : 0,
        isCorrect,
        feedback: question.explanation ?? (isCorrect ? "Correct." : "Not quite.")
      };
    }

    case "fill_blank": {
      if (!response) {
        if (args.allowUnanswered) {
          return { score: 0, isCorrect: false, feedback: UNANSWERED_FEEDBACK };
        }
        throw new GradingError("Type an answer first.");
      }
      const math = readMathKey(question.accepted_answers);
      if (math === "invalid") {
        // One unreadable key must not sink a whole practice test, and it is never graded by spelling instead.
        if (args.allowUnanswered) return { score: 0, isCorrect: false, feedback: UNANSWERED_FEEDBACK };
        throw new GradingError("Studigo can't check this question. Build a new quiz to keep practicing.");
      }
      if (math) return gradeMathAnswer(math, response, args.allowUnanswered);
      const accepted = question.accepted_answers?.length
        ? question.accepted_answers
        : [question.expected_answer ?? ""];
      const grade = gradeBlankAnswer({ learnerAnswer: response, acceptedAnswers: accepted });

      return {
        score: grade.score,
        isCorrect: grade.isCorrect,
        feedback: grade.isCorrect
          ? grade.score === 100
            ? "Correct."
            : `Correct. The material spells it “${grade.matched}”.`
          : `Not quite. The answer is “${question.expected_answer}”.`
      };
    }

    default: {
      if (!response) {
        if (args.allowUnanswered) {
          return { score: 0, isCorrect: false, feedback: UNANSWERED_FEEDBACK };
        }
        throw new GradingError("Write an answer first.");
      }
      const grade = await gradeShortAnswer({
        question: question.prompt,
        expectedAnswer: question.expected_answer ?? "",
        learnerAnswer: response
      });
      return { score: grade.score, isCorrect: grade.isCorrect, feedback: grade.feedback };
    }
  }
}

/** A problem with what the learner submitted, not with the server. */
export class GradingError extends Error {}

/** Normalizes a submitted choice against the question that was actually asked. */
export function readSelectedChoice(
  value: unknown,
  question: Pick<GradableQuestion, "choices">
): number | null {
  const choiceCount = question.choices?.length ?? 0;
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < choiceCount
    ? (value as number)
    : null;
}

/** 1 guessing, 2 unsure, 3 confident; anything else means "not reported". */
export function readConfidence(value: unknown): number | null {
  return typeof value === "number" && [1, 2, 3].includes(value) ? value : null;
}
