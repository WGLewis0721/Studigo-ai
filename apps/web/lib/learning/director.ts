import { LEARNING_ROUTES, REASONING_LADDER, ACTIVITIES, CHALLENGE_REQUESTS, type ChallengeRequest, type ChallengeSpec, type ConceptKey,
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
  /**
   * One issued encounter only. "stretch" asks for one harder rung than persisted
   * demand. It is not evidence and must not be stored as learner state.
   * Omitted means "normal".
   */
  challengeRequest?: ChallengeRequest;
}): ChallengeSpec {
  const { concept, learnerState: state, activity, route } = args;
  const challengeRequest = args.challengeRequest ?? 'normal';
  if (!sameConcept(concept, state) || args.recentEvents.some(e => !sameConcept(concept, e))) throw new Error('Challenge scope mismatch');
  if (!ACTIVITIES.includes(activity) || !LEARNING_ROUTES.includes(route) || !Number.isFinite(Date.parse(args.now))
    || !CHALLENGE_REQUESTS.includes(challengeRequest)) throw new Error('Invalid challenge request');
  const rematchDue = state.rematch !== null && Date.parse(args.now) >= Date.parse(state.rematch.dueAt);
  // Cards support recognition/recall, not transfer or teaching back. Their results
  // still enter the same state, but cannot manufacture higher-order evidence.
  const canRematch = rematchDue && activity !== 'flashcard';
  const persistedDemand = (activity === 'flashcard' ? Math.min(1, state.reasoningLevel)
    : canRematch && state.rematch?.reason === 'transfer_fail' ? 6 : state.reasoningLevel) as ReasoningLevel;
  // Precedence for this one spec: a due rematch that this activity can serve,
  // then the activity's existing contract, then a one-shot stretch.
  // Stretch is always persisted demand + 1, never the previous temporary spec.
  // Coach may take that rung. Cards may take it only up to recall.
  // Practice tests and the other activities keep today's demand exactly:
  // a stretch must not turn an independent test into coached support, and it
  // must not invent a second ladder for Quiz, Learn, Weak Areas, or Cram.
  const stretchHonored = challengeRequest === 'stretch' && !canRematch
    && (activity === 'coach' || activity === 'flashcard');
  const ceiling = activity === 'flashcard' ? 1 : 9;
  const reasoningLevel = (stretchHonored ? Math.min(ceiling, persistedDemand + 1) : persistedDemand) as ReasoningLevel;
  const action = canRematch ? 'rematch' : state.lastResult === 'correct' ? 'variation'
    : state.lastResult && ['partial', 'incorrect', 'help', 'revealed'].includes(state.lastResult) ? 'retry' : 'practice';
  const reasons = [canRematch ? `due_${state.rematch!.reason}` : `last_${state.lastResult ?? 'unpracticed'}`];
  if (state.taskSize === 'single_step') reasons.push('repeated_failure_split_task');
  if (activity === 'flashcard' && state.reasoningLevel > 1) reasons.push('flashcard_recall_only');
  if (activity === 'practice_test') reasons.push('independent_assessment');
  if (stretchHonored) reasons.push('learner_requested_stretch');
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