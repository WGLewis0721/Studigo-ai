import type { LearningRoute } from "@/lib/learning";

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
  { label: "Try a harder question", text: "Try a harder question" }
] as const;

/**
 * The four starters above the Learn input. They are there to show what Learn is for and how it
 * differs from Coach, so each one demonstrates a different thing Learn does. The first is answered
 * on the spot with fixed product copy (it is about the app, not the course, so it is never sent
 * to the model and never shown as coming from the learner's materials). The rest are ordinary
 * Learn questions that the materials answer.
 */
export type LearnStarter = { id: string; label: string; text: string; local: boolean };

export function learnStarters(topicTitle: string): LearnStarter[] {
  return [
    { id: "how", label: "How Learn works", text: "How does Learn work?", local: true },
    { id: "explain", label: "Explain this topic", text: `Explain ${topicTitle} simply.`, local: false },
    { id: "guide", label: "What's in my guide?", text: "What does the study guide say I need to know?", local: false },
    { id: "terms", label: "Key terms", text: "What are the key terms I need to know? Give each one a short definition.", local: false }
  ];
}

/** What the first starter answers. Markdown outline, rendered like every other Learn answer. */
export const LEARN_GUIDE_TEXT = [
  "**Learn answers your questions from your own materials.**",
  "",
  "## What Learn does",
  "- Answers from your study guide and notes, and shows the page each answer came from",
  "- Explains ideas and key terms until they make sense",
  "- Says so when something is not in your materials, instead of guessing",
  "- Never grades you and never changes your mastery",
  "",
  "## How Coach is different",
  "- Coach asks you questions and checks your answers",
  "- Coach is where your mastery is earned",
  "- Learn first when a term is unclear, then Coach to practice it"
].join("\n");
