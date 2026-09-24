import { LEARNING_ROUTES, REASONING_LADDER, ACTIVITIES, type ChallengeSpec, type ConceptKey,
  type ConceptLearningState, type LearningActivity, type LearningEvent, type LearningRoute,
  type ReasoningLevel } from './types';
import { sameConcept } from './reducer';

/** References to the existing KB, not a second set of cultural/pedagogical claims. */
export const ROUTE_RECORDS: Record<LearningRoute, string> = {
  studigo_default: 'coaching-style-default', direct_instruction: 'coaching-style-direct',
  socratic: 'coaching-style-socratic', deliberate_practice: 'coaching-style-deliberate-practice',
  concrete_to_abstract: 'coaching-style-concrete-to-abstract', japanese_inspired: 'tradition-japanese-inspired',
  montessori_inspired: 'tradition-montessori-inspired', swedish_inspired: 'tradition-swedish-inspired',
  singapore_math_inspired: 'tradition-singapore-math'
};

export function nextChallenge(args: {
  concept: ConceptKey & { objective: string };
  learnerState: ConceptLearningState;
  /** Already folded into state. Used only for avoiding repeated prompts. */
  recentEvents: readonly LearningEvent[];
  activity: LearningActivity;
  route: LearningRoute;
  /** Explicit clock makes scheduling reproducible. */
  now: string;
}): ChallengeSpec {
  const { concept, learnerState: state, activity, route } = args;
  if (!sameConcept(concept, state) || args.recentEvents.some(e => !sameConcept(concept, e))) throw new Error('Challenge scope mismatch');
  if (!ACTIVITIES.includes(activity) || !LEARNING_ROUTES.includes(route) || !Number.isFinite(Date.parse(args.now))) throw new Error('Invalid challenge request');
  const rematchDue = state.rematch !== null && Date.parse(args.now) >= Date.parse(state.rematch.dueAt);
  // Cards support recognition/recall, not transfer or teaching back. Their results
  // still enter the same state, but cannot manufacture higher-order evidence.
  const canRematch = rematchDue && activity !== 'flashcard';
  const reasoningLevel = (activity === 'flashcard' ? Math.min(1, state.reasoningLevel)
    : canRematch && state.rematch?.reason === 'transfer_fail' ? 6 : state.reasoningLevel) as ReasoningLevel;
  const action = canRematch ? 'rematch' : state.lastResult === 'correct' ? 'variation'
    : state.lastResult && ['partial', 'incorrect', 'help', 'revealed'].includes(state.lastResult) ? 'retry' : 'practice';
  const reasons = [canRematch ? `due_${state.rematch!.reason}` : `last_${state.lastResult ?? 'unpracticed'}`];
  if (state.taskSize === 'single_step') reasons.push('repeated_failure_split_task');
  if (activity === 'flashcard' && state.reasoningLevel > 1) reasons.push('flashcard_recall_only');
  if (activity === 'practice_test') reasons.push('independent_assessment');
  return { policyVersion: 1, concept: { ...concept }, activity, route,
    routeRecord: `knowledge/teaching-coaching/${ROUTE_RECORDS[route]}.md`,
    reasoningLevel, challengeKind: REASONING_LADDER[reasoningLevel],
    scaffoldLevel: activity === 'practice_test' ? 0 : state.scaffoldLevel,
    taskSize: activity === 'practice_test' ? 'whole' : state.taskSize,
    action, reasons,
    constraints: { oneConceptAtATime: true, plainLanguage: true,
      requireNewContext: canRematch || reasoningLevel >= 6,
      avoidEncounterIds: [...new Set(args.recentEvents.map(e => e.encounterId))].sort(),
      avoidContextId: canRematch ? state.rematch!.contextId : null } };
}
