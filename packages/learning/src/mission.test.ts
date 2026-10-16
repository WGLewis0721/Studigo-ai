import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_MODALITIES, ASSISTANCE_LEVELS, LEARNING_MISSION_PLAN_VERSION, LEARN_MISSION_WRITES_MASTERY,
  MISSION_ACTION_KINDS, MISSION_COVERAGE, MISSION_EXPLANATION_LEVELS, MISSION_FAMILIARITY, MISSION_VIEW_STAGES,
  type AnswerEnvelope, type LearningMissionPlan, type MissionView
} from './mission';

const plan: LearningMissionPlan = {
  version: LEARNING_MISSION_PLAN_VERSION,
  planId: 'plan-1',
  roomId: 'room-1',
  topicIds: ['voting'],
  familiarity: 'new',
  explanationLevel: 'deeper',
  sourceRevisionKey: 'room-1@corpus-4',
  topicScopeRevision: 'topics@3',
  objectives: [{ objectiveId: 'obj-1', topicId: 'voting', statement: 'Who chooses representatives?' }],
  steps: [
    {
      stepId: 'step-foundation',
      topicId: 'voting',
      role: 'foundation',
      objectiveId: 'obj-1',
      evidence: [],
      coverage: 'unsupported_prerequisite',
      labeledGeneralBackground: false
    },
    {
      stepId: 'step-show',
      topicId: 'voting',
      role: 'demonstration',
      objectiveId: 'obj-1',
      evidence: [{ documentId: 'doc-1', blockKey: 'p3-o1-abc', revision: 4, pageNumber: 3, quoteSpan: null }],
      coverage: 'supported',
      labeledGeneralBackground: false
    }
  ]
};

test('mission vocabulary stays closed and Learn writes no mastery', () => {
  assert.equal(LEARN_MISSION_WRITES_MASTERY, false);
  assert.equal(LEARNING_MISSION_PLAN_VERSION, 1);
  assert.deepEqual(MISSION_FAMILIARITY, ['new', 'some', 'try']);
  assert.deepEqual(MISSION_EXPLANATION_LEVELS, ['simpler', 'standard', 'deeper']);
  assert.deepEqual(MISSION_COVERAGE, ['supported', 'partial_coverage', 'unsupported_prerequisite']);
  assert.deepEqual(MISSION_VIEW_STAGES, ['entry', 'briefing', 'foundation', 'demonstration', 'action', 'checkpoint', 'complete', 'blocked']);
  assert.ok(MISSION_ACTION_KINDS.includes('find_it'));
  assert.ok(MISSION_ACTION_KINDS.includes('handoff_practice'));
  assert.deepEqual(ANSWER_MODALITIES, ['tap', 'choice', 'order', 'evidence', 'speech', 'type']);
  assert.deepEqual(ASSISTANCE_LEVELS, ['none', 'hinted', 'demonstrated']);
});

test('a novice plan keeps familiarity apart from explanation level and labels a missing foundation', () => {
  assert.equal(plan.familiarity, 'new');
  assert.equal(plan.explanationLevel, 'deeper');
  assert.equal(plan.steps[0].coverage, 'unsupported_prerequisite');
  assert.equal(plan.steps[0].evidence.length, 0);
  assert.equal(plan.steps[0].labeledGeneralBackground, false);
  assert.equal(plan.steps[1].evidence[0].quoteSpan, null);
  assert.equal(plan.topicIds.length, 1);
});

test('the shared answer envelope can be formative or assessed without becoming a mastery event', () => {
  const formative: AnswerEnvelope = {
    questionId: 'q-1',
    modality: 'choice',
    response: 'People choose representatives.',
    sourceSnapshot: { sourceRevisionKey: plan.sourceRevisionKey, blockKeys: ['p3-o1-abc'] },
    assistance: 'none',
    attempt: { attemptId: 'attempt-1', authority: 'formative' }
  };
  const view: MissionView = {
    missionId: 'mission-1',
    planId: plan.planId,
    sourceRevisionKey: plan.sourceRevisionKey,
    topicId: 'voting',
    stage: 'action',
    position: { lessonIndex: 1, lessonCount: 2 },
    objective: plan.objectives[0].statement,
    permittedActions: [{ kind: 'my_turn', actionId: 'act-1' }],
    assistance: formative.assistance,
    sourceStatus: 'ready',
    formative: true
  };
  assert.equal(formative.attempt.authority, 'formative');
  assert.equal(view.formative, true);
  assert.equal(LEARN_MISSION_WRITES_MASTERY, false);
  const assessed: AnswerEnvelope['attempt']['authority'] = 'assessed';
  assert.equal(assessed, 'assessed');
});
