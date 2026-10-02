import type { ExplainLevel } from "@studigo/learning";

export const LEARN_MODES = ["overview", "step_by_step", "examples_first"] as const;
export type LearnMode = typeof LEARN_MODES[number];

export type LearnPreferences = {
  mode: LearnMode;
};

export const DEFAULT_LEARN_PREFERENCES: LearnPreferences = { mode: "step_by_step" };

export const LEARN_MODE_OPTIONS: ReadonlyArray<{
  id: LearnMode;
  name: string;
  expect: string;
}> = [
  {
    id: "overview",
    name: "Big picture",
    expect: "Start with the main idea, then the key facts that matter."
  },
  {
    id: "step_by_step",
    name: "Step by step",
    expect: "Build the idea in small connected pieces, one part at a time."
  },
  {
    id: "examples_first",
    name: "Examples first",
    expect: "Start with a concrete example from my materials, then explain the idea."
  }
];

export function isLearnMode(value: unknown): value is LearnMode {
  return typeof value === "string" && (LEARN_MODES as readonly string[]).includes(value);
}

export function normalizeLearnPreferences(input: unknown): LearnPreferences {
  if (!input || typeof input !== "object") return DEFAULT_LEARN_PREFERENCES;
  const mode = (input as Partial<LearnPreferences>).mode;
  return { mode: isLearnMode(mode) ? mode : DEFAULT_LEARN_PREFERENCES.mode };
}

export function validLearnPreferences(input: unknown): input is LearnPreferences {
  return Boolean(input) && typeof input === "object" && isLearnMode((input as Partial<LearnPreferences>).mode);
}

export function describeLearning(preferences: LearnPreferences) {
  const option = LEARN_MODE_OPTIONS.find((item) => item.id === preferences.mode) ?? LEARN_MODE_OPTIONS[1];
  return { mode: option.id, label: option.name, expect: option.expect };
}

export function compileLearnPreferences(preferences: LearnPreferences, explainLevel: ExplainLevel) {
  const mode = normalizeLearnPreferences(preferences).mode;
  const instruction = mode === "overview"
    ? "mode=overview. Start with one concise main idea, then the most important grounded facts in a scannable outline. Preserve source order when it matters. Do not quiz, grade, or change mastery."
    : mode === "examples_first"
      ? "mode=examples_first. When the retrieved material contains a concrete example, begin with that example, then name and explain the concept it demonstrates. Never invent an example that the room materials do not support. Do not quiz, grade, or change mastery."
      : "mode=step_by_step. Build the explanation in small connected steps, one idea at a time, using the material's own sequence and terminology. Do not quiz, grade, or change mastery.";

  return {
    mode,
    directives: [
      { name: "Learn mode", instruction },
      {
        name: "Learn guardrail",
        instruction: "This preference changes presentation order only. It never changes source scope, factual truth, reasoning demand, grading, mastery, challenge progression, or the adaptive game director."
      },
      {
        name: "Explanation level source",
        instruction: `Use the Study Room's global explanation level (${explainLevel}). Do not create or infer a separate Learn explanation level.`
      }
    ]
  };
}
