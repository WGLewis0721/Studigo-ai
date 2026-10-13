import type { CaseFacts, ExpectedConcept } from "@studigo/ai";
import { SCAFFOLD_LADDER } from "@/lib/learning";

/** Assessed attempts on one pending question, with none correct, before the Coach offers a summary. Provisional. */
export const STUCK_ATTEMPT_THRESHOLD = 3;

export const MAX_CLARIFY_CANDIDATES = 4;
const MAX_TITLE_CHARS = 60;
const MAX_CONCEPT_CHARS = 120;
const MAX_LISTED_CONCEPTS = 5;

const WORKED_EXAMPLE_LEVEL = SCAFFOLD_LADDER.indexOf("worked_example");

/** Plain-language names for the support levels, indexed like SCAFFOLD_LADDER. */
const SUPPORT_PHRASES = ["none so far", "a gentle prompt", "a hint", "an example", "answer choices", "a worked example"] as const;

/**
 * Titles and concept descriptions were written by a model from uploaded files, so they are shown as
 * plain text only: one line, no emphasis or citation markers for the renderer to act on, bounded length.
 */
function plainLine(text: string, max: number): string {
  const clean = text.replace(/[*_`[\]]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** The one question asked when a message fits several topics. Nothing is chosen for the learner. */
export function renderTopicClarification(candidates: ReadonlyArray<{ title: string }>): string {
  const listed = candidates.slice(0, MAX_CLARIFY_CANDIDATES).map((topic) => `- ${plainLine(topic.title, MAX_TITLE_CHARS) || "Untitled topic"}`);
  return [
    "More than one of your topics fits that. Which one do you mean?",
    "",
    ...listed,
    ...(candidates.length > MAX_CLARIFY_CANDIDATES ? ["", "A few more fit as well."] : []),
    "",
    "Tell me the title and I'll start there."
  ].join("\n");
}

export type CoachHandoffNextStep = "combine_ideas" | "ask_for_worked_example" | "switch_topic";

/** Built only from what the Coach already holds for the pending question. Never lists a concept the learner has not shown. */
export type CoachHandoff = {
  topicTitle: string | null;
  attempts: number;
  conceptsShown: number;
  conceptsExpected: number;
  shownDescriptions: string[];
  /** Highest support given on this question, on the scaffold scale; null when not tracked. */
  supportLevel: number | null;
  nextStep: CoachHandoffNextStep;
};

/**
 * True on the reply whose assessed attempt takes the ledger to the threshold or to a later multiple
 * of it. `attemptsBefore` is the ledger count before that reply, so a reply that adds no attempt
 * (or one past the ledger's cap) never repeats the summary.
 */
export function handoffDue(facts: CaseFacts, attemptsBefore: number): boolean {
  return (
    facts.attempts > attemptsBefore &&
    facts.attempts >= STUCK_ATTEMPT_THRESHOLD &&
    facts.attempts % STUCK_ATTEMPT_THRESHOLD === 0 &&
    !facts.outcomes.includes("correct")
  );
}

/**
 * A fixed rule over the support level. Until a worked example has been given, ask for one with words
 * the Coach already recognises ("show me the answer"). After that, set the question aside with
 * "next" and name another topic.
 */
function nextStepFor(supportLevel: number | null): CoachHandoffNextStep {
  return supportLevel !== null && supportLevel >= WORKED_EXAMPLE_LEVEL ? "switch_topic" : "ask_for_worked_example";
}

export function buildCoachHandoff(args: {
  topicTitle: string | null | undefined;
  caseFacts: CaseFacts;
  expectedConcepts: ExpectedConcept[];
  supportLevel: number | null;
}): CoachHandoff {
  // Concept ids are model-written and can repeat. A shared id cannot say which of its concepts was
  // shown, so neither is counted or printed: printing both would reveal one the learner never gave.
  const idUses = new Map<string, number>();
  for (const concept of args.expectedConcepts) idUses.set(concept.id, (idUses.get(concept.id) ?? 0) + 1);
  const shown = args.expectedConcepts.filter((concept) => idUses.get(concept.id) === 1 && args.caseFacts.demonstrated.includes(concept.id));
  const title = args.topicTitle ? plainLine(args.topicTitle, MAX_TITLE_CHARS) : "";
  // Every idea was shown, but never in one reply, which is what a correct grade needs.
  const allShownSeparately = args.expectedConcepts.length > 0 && shown.length === args.expectedConcepts.length;
  return {
    topicTitle: title || null,
    attempts: args.caseFacts.attempts,
    conceptsShown: shown.length,
    conceptsExpected: args.expectedConcepts.length,
    shownDescriptions: shown
      .slice(0, MAX_LISTED_CONCEPTS)
      .map((concept) => plainLine(concept.description, MAX_CONCEPT_CHARS))
      .filter(Boolean),
    supportLevel: args.supportLevel,
    nextStep: allShownSeparately ? "combine_ideas" : nextStepFor(args.supportLevel)
  };
}

const NEXT_STEP_TEXT: Record<CoachHandoffNextStep, string> = {
  combine_ideas: "You have given each idea, just not in the same answer. Try putting them together in one reply.",
  ask_for_worked_example: 'Say "show me the answer" and I\'ll go through it with you.',
  switch_topic: 'Say "next" to set this one aside, then name another topic. You can ask for this one again later.'
};

/** Light markdown the chat renderer already handles: a bold line and a nested list. */
export function renderCoachHandoff(handoff: CoachHandoff): string {
  const support = handoff.supportLevel === null ? undefined : SUPPORT_PHRASES[handoff.supportLevel];
  return [
    "**Where you are on this question**",
    "",
    ...(handoff.topicTitle ? [`- Topic: ${handoff.topicTitle}`] : []),
    `- Attempts so far: ${handoff.attempts}`,
    `- Ideas shown so far: ${handoff.conceptsShown} of ${handoff.conceptsExpected}`,
    ...handoff.shownDescriptions.map((description) => `  - ${description}`),
    ...(support ? [`- Help used so far: ${support}`] : []),
    `- Suggested next step: ${NEXT_STEP_TEXT[handoff.nextStep]}`,
    "",
    "You can show this to someone who is helping you."
  ].join("\n");
}
