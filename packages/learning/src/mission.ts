/**
 * Guided Learn shared contracts. Types and closed vocabularies only.
 * No director, persistence, provider call, or mastery write lives here.
 * Software later decides sequence. A model may only fill schema-validated text.
 */

export const LEARNING_MISSION_PLAN_VERSION = 1 as const;

/** Learn formative activity never writes official mastery. */
export const LEARN_MISSION_WRITES_MASTERY = false as const;

/** Topic familiarity. Independent of the room explanation level. */
export const MISSION_FAMILIARITY = ['new', 'some', 'try'] as const;
export type MissionFamiliarity = typeof MISSION_FAMILIARITY[number];

export const MISSION_EXPLANATION_LEVELS = ['simpler', 'standard', 'deeper'] as const;
export type MissionExplanationLevel = typeof MISSION_EXPLANATION_LEVELS[number];

export const MISSION_COVERAGE = ['supported', 'partial_coverage', 'unsupported_prerequisite'] as const;
export type MissionCoverage = typeof MISSION_COVERAGE[number];

/** GL02 director states, including foundation. The view uses the same lesson position. */
export const MISSION_VIEW_STAGES = [
  'entry', 'briefing', 'foundation', 'demonstration', 'action', 'checkpoint', 'complete', 'blocked'
] as const;
export type MissionViewStage = typeof MISSION_VIEW_STAGES[number];

export const MISSION_ACTION_KINDS = [
  'start', 'continue', 'show_me', 'my_turn', 'find_it', 'hint', 'show_again',
  'explain_differently', 'read_aloud', 'skip', 'back', 'pause', 'resume',
  'restart', 'ask', 'handoff_coach', 'handoff_practice'
] as const;
export type MissionActionKind = typeof MISSION_ACTION_KINDS[number];

export const ANSWER_MODALITIES = ['tap', 'choice', 'order', 'evidence', 'speech', 'type'] as const;
export type AnswerModality = typeof ANSWER_MODALITIES[number];

export const ASSISTANCE_LEVELS = ['none', 'hinted', 'demonstrated'] as const;
export type AssistanceLevel = typeof ASSISTANCE_LEVELS[number];

/** A permitted source location. A null quote span means the page is known and the words are not. */
export type MissionEvidenceRef = {
  documentId: string;
  blockKey: string;
  revision: number;
  pageNumber: number | null;
  quoteSpan: { start: number; end: number } | null;
};

export type MissionObjective = {
  objectiveId: string;
  topicId: string;
  statement: string;
};

export type MissionConceptStep = {
  stepId: string;
  topicId: string;
  role: 'foundation' | 'demonstration' | 'learner_action' | 'formative_check';
  objectiveId: string;
  evidence: MissionEvidenceRef[];
  coverage: MissionCoverage;
  /** True only for learner-permitted general background. Never course evidence. */
  labeledGeneralBackground: boolean;
};

export type LearningMissionPlan = {
  version: typeof LEARNING_MISSION_PLAN_VERSION;
  planId: string;
  roomId: string;
  /** Teacher-scope topic ids in navigation order. */
  topicIds: string[];
  familiarity: MissionFamiliarity;
  explanationLevel: MissionExplanationLevel;
  sourceRevisionKey: string;
  topicScopeRevision: string;
  objectives: MissionObjective[];
  steps: MissionConceptStep[];
};

export type MissionAction = {
  kind: MissionActionKind;
  /** Stable id. Retries reuse it so a receipt can reject a duplicate progression. */
  actionId: string;
};

export type MissionView = {
  missionId: string;
  planId: string;
  sourceRevisionKey: string;
  topicId: string;
  stage: MissionViewStage;
  position: { lessonIndex: number; lessonCount: number };
  objective: string | null;
  permittedActions: MissionAction[];
  assistance: AssistanceLevel;
  sourceStatus: 'ready' | 'partial' | 'stale' | 'missing';
  /** Formative display. This view is not a mastery projection. */
  formative: true;
};

/**
 * One reviewed learner response, shared by Learn and Coach.
 * `authority: 'formative'` is an ungraded Learn action.
 * `authority: 'assessed'` may enter the existing Coach or Practice grader only.
 */
export type AnswerEnvelope = {
  questionId: string;
  modality: AnswerModality;
  /** Reviewed text. Speech is the transcript the learner accepted. */
  response: string;
  sourceSnapshot: {
    sourceRevisionKey: string;
    blockKeys: string[];
  };
  assistance: AssistanceLevel;
  attempt: {
    attemptId: string;
    authority: 'formative' | 'assessed';
  };
};
