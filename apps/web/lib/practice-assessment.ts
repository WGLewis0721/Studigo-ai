/** Learner-selectable question types shared by Quiz and full Practice Test. */
export const ASSESSMENT_MODES = ["multiple_choice", "fill_blank", "true_false"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];
export const QUIZ_QUESTION_COUNTS = [3, 5, 10] as const;
export const TEST_QUESTION_COUNTS = [6, 10, 15, 20] as const;

export const ASSESSMENT_LABELS: Record<AssessmentMode, string> = {
  multiple_choice: "Multiple Choice",
  fill_blank: "Fill in the Blank",
  true_false: "True or False"
};

/** Nothing is inferred about an answer: speech gets only the question and its visible choices. */
export function spokenQuestion(question: {
  kind: string;
  prompt: string;
  choices: string[];
}): string {
  const prompt = question.prompt.replace(/____/g, "blank").replace(/\s+/g, " ").trim();
  if (question.kind !== "multiple_choice" && question.kind !== "true_false") return prompt;
  const options = question.choices.map((choice, index) =>
    `Option ${String.fromCharCode(65 + index)}: ${choice}.`
  ).join(" ");
  return `${prompt} ${options}`.trim();
}
