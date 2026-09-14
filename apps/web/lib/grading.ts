import { gradeBlankAnswer, gradeShortAnswer } from "@studigo/ai";

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

/**
 * One grader for every question type, shared by single-question quizzes and
 * whole practice tests so the same answer is never scored two different ways.
 *
 * Only short answers cost a model call; the other three kinds are decided
 * locally, which keeps a 20-question test fast and cheap.
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
            : `Correct — the material spells it “${grade.matched}”.`
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
