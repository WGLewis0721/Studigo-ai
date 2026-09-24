import type { LearningRoute } from "./coach-challenge";

// ---------------------------------------------------------------------------
// Learning routes as policy objects (ADAPTIVE_LEARNING_ENGINE.md §12).
//
// A route changes HOW the learner reaches mastery: attempt-before-explanation,
// examples-before-rules, how fast Coach intervenes. It never changes source
// truth, grading, concept scope, or mastery thresholds — which is enforced
// structurally: route guidance is only ever passed to phrasing calls
// (question, feedback, support), never to the semantic evaluator or
// `decideOutcome`.
//
// The rules below are condensed from each record's "Recommended coaching
// rules" section in knowledge/teaching-coaching/, which stays the canonical
// source; `kbRecord` names the file so the two can be kept in sync.
// ---------------------------------------------------------------------------

export type RoutePolicy = {
  label: string;
  kbRecord: string;
  /** The route's turn-by-turn shape, spread across conversational turns. */
  sequence: readonly string[];
  rules: readonly string[];
};

export const ROUTE_POLICIES: Record<LearningRoute, RoutePolicy> = {
  studigo_default: {
    label: "Studigo default",
    kbRecord: "knowledge/teaching-coaching/coaching-style-default.md",
    sequence: ["brief explanation", "one example", "learner attempt", "diagnose", "next practice"],
    rules: [
      "Keep your explanation shorter than the learner's practice.",
      "Use one representative example before asking for an attempt.",
      "If the learner is missing a prerequisite, teach the prerequisite."
    ]
  },
  direct_instruction: {
    label: "Direct instruction",
    kbRecord: "knowledge/teaching-coaching/coaching-style-direct.md",
    sequence: ["model", "worked example", "guided attempt", "correction", "independent attempt"],
    rules: [
      "Model one clear example, then ask the learner to do the next step rather than watch another example.",
      "Give one precise correction tied to the learner's exact error."
    ]
  },
  socratic: {
    label: "Socratic",
    kbRecord: "knowledge/teaching-coaching/coaching-style-socratic.md",
    sequence: ["question", "learner reasoning", "targeted probe", "identify the gap", "revised reasoning"],
    rules: [
      "Ask one meaningful question at a time and make the learner's reasoning visible.",
      "Probe the gap instead of stating the answer; after two failed probes on the same gap, give a hint.",
      "Participation alone is not understanding."
    ]
  },
  deliberate_practice: {
    label: "Deliberate practice",
    kbRecord: "knowledge/teaching-coaching/coaching-style-deliberate-practice.md",
    sequence: ["target one weakness", "focused attempt", "specific feedback", "repeat with variation"],
    rules: [
      "Target one observable weakness at a time.",
      "Keep feedback specific enough to change the next attempt; reteach if the same error repeats."
    ]
  },
  concrete_to_abstract: {
    label: "Concrete to abstract",
    kbRecord: "knowledge/teaching-coaching/coaching-style-concrete-to-abstract.md",
    sequence: ["concrete situation", "model or picture", "abstract idea", "application"],
    rules: [
      "Start from something the learner can picture, and say what it represents.",
      "Ask the learner to connect the concrete case to the idea before moving to abstract wording.",
      "Keep the teacher's vocabulary once it is introduced."
    ]
  },
  japanese_inspired: {
    label: "Japanese-inspired",
    kbRecord: "knowledge/teaching-coaching/tradition-japanese-inspired.md",
    sequence: ["one carefully chosen problem", "learner attempt", "compare approaches", "the important idea", "small variation", "refinement"],
    rules: [
      "Pose a worthwhile problem before giving the method, and let the learner attempt it.",
      "Where the material allows, compare two plausible approaches and ask what they share.",
      "Use a worked model only if the learner is blocked; treat errors as information."
    ]
  },
  montessori_inspired: {
    label: "Montessori-inspired",
    kbRecord: "knowledge/teaching-coaching/tradition-montessori-inspired.md",
    sequence: ["concrete representation", "independent attempt", "self-correction", "minimal intervention", "abstraction"],
    rules: [
      "Use minimal prompts once the task is understood.",
      "Let the learner check and repair their own error before you correct it; step in if self-correction stalls."
    ]
  },
  swedish_inspired: {
    label: "Swedish-inspired",
    kbRecord: "knowledge/teaching-coaching/tradition-swedish-inspired.md",
    sequence: ["learner agency", "prediction", "discussion", "evidence", "alternatives", "reflection"],
    rules: [
      "Invite a prediction or a bounded choice, and ask for reasons before affirming.",
      "Ask the learner to weigh the evidence for their answer.",
      "Teach directly when agency would only force guessing."
    ]
  },
  singapore_math_inspired: {
    label: "Singapore Math-inspired",
    kbRecord: "knowledge/teaching-coaching/tradition-singapore-math.md",
    sequence: ["concrete situation", "visual or model representation", "symbolic abstraction", "application"],
    rules: [
      "Make the step from picture or model to words or symbols explicit.",
      "Ask the learner to explain the representation; return to it if the abstract step loses meaning."
    ]
  }
};

/**
 * Renders a route as phrasing guidance. Always carries the invariant that the
 * route shapes delivery only, so the model is told the same boundary the code
 * enforces.
 */
export function routeGuidance(route: LearningRoute): string[] {
  const policy = ROUTE_POLICIES[route];
  return [
    `Teaching route: ${policy.label}. Its shape across turns: ${policy.sequence.join(" -> ")}. Play only the current step of that shape in this turn.`,
    ...policy.rules,
    "The route changes how you teach, never what is correct: keep the same facts, the same concepts, and the same standard for a correct answer."
  ];
}
