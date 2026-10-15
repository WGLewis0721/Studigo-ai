/** First Study Room: a labeled sample, then optional corrections. No required blanks. */

export const FIRST_RUN_STEPS = ["material", "correction", "goal", "lesson", "optional"] as const;

export type FirstRunStep = (typeof FIRST_RUN_STEPS)[number];

export const SAMPLE_LABEL = "Sample";

/**
 * Short civics sample. Facts only: the executive enforces laws, the legislative
 * makes laws, and the judicial checks that laws are fair.
 * Goal ids are understand / prepare / practice. No test date is invented.
 */
export const SAMPLE = {
  labeled: true,
  subject: "Community government",
  topic: "Three branches",
  goalChoices: ["understand", "prepare", "practice"],
  question: "Who enforces the laws?",
  acceptable: "The executive branch.",
  mastery: 0,
  facts: [
    "The executive branch enforces laws.",
    "The legislative branch makes laws.",
    "The judicial branch checks that laws are fair."
  ]
} as const;

export type SampleGoal = (typeof SAMPLE.goalChoices)[number];

/** A title is never required to leave the material step. */
export function canLeaveMaterial(title: string): boolean {
  const named = title.trim();
  return named.length === 0 || named.length > 0;
}

export function nextFirstRunStep(step: FirstRunStep): FirstRunStep | null {
  const index = FIRST_RUN_STEPS.indexOf(step);
  if (index < 0 || index >= FIRST_RUN_STEPS.length - 1) return null;
  return FIRST_RUN_STEPS[index + 1] ?? null;
}

export function resumeFirstRun(saved: string | null): FirstRunStep {
  if (saved && (FIRST_RUN_STEPS as readonly string[]).includes(saved)) return saved as FirstRunStep;
  return "material";
}

/** Subject, else topic, else a fixed name. Never a made-up test date. */
export function roomTitleFromGuess(subject: string, topic: string): string {
  const fromSubject = subject.trim();
  if (fromSubject) return fromSubject;
  const fromTopic = topic.trim();
  if (fromTopic) return fromTopic;
  return "My first Study Room";
}

export function sampleMastery(): 0 {
  return SAMPLE.mastery;
}
