/** Policy vocabulary, independent of rendering, grading providers and storage. */
export const REASONING_LADDER = [
  'recognize', 'recall', 'explain', 'compare', 'predict', 'apply', 'transfer',
  'novel_problem', 'defend', 'teach_back'
] as const;
export type ChallengeKind = typeof REASONING_LADDER[number];
export type ReasoningLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const SCAFFOLD_LADDER = [
  'independent', 'gentle_prompt', 'hint', 'concrete_example', 'constrained_choices', 'worked_example'
] as const;
export type ScaffoldLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const ACTIVITIES = ['learn', 'coach', 'flashcard', 'quiz', 'practice_test', 'weak_area', 'cram'] as const;
export type LearningActivity = typeof ACTIVITIES[number];
/** One issued encounter. Omitted or "normal" keeps today's demand. "stretch" is a request, not evidence. */
export const CHALLENGE_REQUESTS = ['normal', 'stretch'] as const;
export type ChallengeRequest = typeof CHALLENGE_REQUESTS[number];
export const LEARNING_ROUTES = [
  'studigo_default', 'direct_instruction', 'socratic', 'deliberate_practice',
  'concrete_to_abstract', 'japanese_inspired', 'montessori_inspired',
  'swedish_inspired', 'singapore_math_inspired'
] as const;
export type LearningRoute = typeof LEARNING_ROUTES[number];
export type EncounterSignal = 'recurring_misconception' | 'hint_dependent' | 'recovered'
  | 'delayed_recall_pass' | 'transfer_pass' | 'transfer_fail' | 'reopened';
export type ConceptKey = { userId: string; roomId: string; topicId: string };

export type LearningEvent = ConceptKey & {
  /** Stable interaction ID, reused on transport retries. */
  id: string;
  /** Stable across retries, hints and reveals of the SAME question. */
  encounterId: string;
  activity: LearningActivity;
  challengeKind: ChallengeKind;
  result: 'correct' | 'partial' | 'incorrect' | 'skipped' | 'revealed' | 'help';
  /** Null means unknown, NOT independent. Track the maximum help actually used. */
  scaffoldUsed: ScaffoldLevel | null;
  evidence: 'assessed' | 'self_reported' | 'legacy';
  contextId: string | null;
  /** Set from the issued challenge, never inferred from learner prose. */
  newContext: boolean;
  /** Stable rubric concept ID; never a speculative learner label. */
  misconceptionId: string | null;
  createdAt: string;
};

export type Rematch = {
  reason: 'transfer_fail' | 'recurring_misconception';
  dueAt: string;
  encounterId: string;
  contextId: string | null;
  misconceptionId: string | null;
};

export type ConceptLearningState = ConceptKey & {
  policyVersion: 1;
  reasoningLevel: ReasoningLevel;
  scaffoldLevel: ScaffoldLevel;
  taskSize: 'whole' | 'single_step';
  correctStreak: number;
  partialStreak: number;
  incorrectStreak: number;
  independentSuccessCount: number;
  firstAttemptSuccessCount: number;
  independentRecallCount: number;
  successfulTransferCount: number;
  hintDependentSuccessCount: number;
  recoveryCount: number;
  masteryEvidence: 'not_demonstrated' | 'independent' | 'transfer' | 'reopened';
  lastResult: LearningEvent['result'] | null;
  lastPracticedAt: string | null;
  signals: EncounterSignal[];
  rematch: Rematch | null;
  /** Replay bookkeeping, not an additional persisted projection. */
  seen: Record<string, string>;
  encounters: Record<string, {
    revealed: boolean; scaffold: ScaffoldLevel | null; struggled: boolean;
    credited: boolean; recovered: boolean;
  }>;
  misconceptions: Record<string, string[]>;
};

export type ChallengeSpec = {
  policyVersion: 1;
  concept: ConceptKey & { objective: string };
  activity: LearningActivity;
  route: LearningRoute;
  routeRecord: string;
  reasoningLevel: ReasoningLevel;
  challengeKind: ChallengeKind;
  scaffoldLevel: ScaffoldLevel;
  taskSize: ConceptLearningState['taskSize'];
  action: 'practice' | 'retry' | 'variation' | 'rematch';
  reasons: string[];
  constraints: {
    oneConceptAtATime: true;
    plainLanguage: true;
    requireNewContext: boolean;
    avoidEncounterIds: string[];
    avoidContextId: string | null;
  };
};
