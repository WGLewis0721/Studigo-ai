import type { LearningRoute } from "@studigo/ai";

// Maps the coach panel's style/tradition pickers to one learning-route id.
// Client-safe: type-only import, so no provider code reaches the browser.
// A non-default tradition is the more specific choice, so it wins.

const TRADITION_ROUTES: Record<string, LearningRoute> = {
  "tradition-japanese": "japanese_inspired",
  "tradition-swedish": "swedish_inspired",
  "tradition-singapore": "singapore_math_inspired",
  "tradition-montessori": "montessori_inspired"
};

const STYLE_ROUTES: Record<string, LearningRoute> = {
  default: "studigo_default",
  direct: "direct_instruction",
  drill: "deliberate_practice",
  socratic: "socratic",
  progression: "studigo_default",
  visual: "concrete_to_abstract"
};

export function selectLearningRoute(styleId: string, traditionId: string): LearningRoute {
  return TRADITION_ROUTES[traditionId] ?? STYLE_ROUTES[styleId] ?? "studigo_default";
}

/** The exact phrases the Coach control buttons send; detectTurnIntent routes them deterministically. */
export const COACH_CONTROL_COMMANDS = [
  { label: "Make it simpler", text: "Make it simpler" },
  { label: "Give me a hint", text: "Give me a hint" },
  { label: "Show me an example", text: "Show me an example" },
  { label: "Challenge me", text: "Challenge me" }
] as const;
