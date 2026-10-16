import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEARN_MISSION_WRITES_MASTERY, type LearningMissionPlan } from './mission';
import {
  buildLearningMissionPlan, missionPlanIsCurrent,
  type MissionPlanBlock, type MissionPlanRequest
} from './mission-plan';

const govDoc = 'doc-government';
const physDoc = 'doc-physics';

function block(partial: MissionPlanBlock): MissionPlanBlock {
  return partial;
}

const government: MissionPlanRequest = {
  guidedLearn: true,
  roomId: 'room-government',
  selectedTopicIds: ['voting', 'branches', 'branches', 'oath', 'not-a-topic'],
  topics: [
    { topicId: 'cities', orderIndex: 3, title: 'City council', objective: 'Name who passes local ordinances.' },
    { topicId: 'oath', orderIndex: 2, title: 'Oath of office', objective: 'Say when the oath of office is administered.' },
    { topicId: 'voting', orderIndex: 1, title: 'Voting', objective: 'Tell how a citizen\'s vote chooses representatives.' },
    { topicId: 'branches', orderIndex: 0, title: 'Branches', objective: 'Name the three branches of government.' },
    { topicId: 'branches', orderIndex: 5, title: 'Branches duplicate', objective: 'A later row must not create a second concept.' }
  ],
  blocks: [
    block({
      documentId: govDoc, blockKey: 'p1-branches', revision: 1, pageNumber: 1, topicId: 'branches', pageState: 'readable'
    }),
    block({
      documentId: govDoc, blockKey: 'p2-voting', revision: 1, pageNumber: 2, topicId: 'voting', pageState: 'readable'
    }),
    block({
      documentId: govDoc, blockKey: 'p3-oath', revision: 1, pageNumber: 3, topicId: 'oath', pageState: 'unreadable'
    }),
    block({
      documentId: govDoc, blockKey: 'p4-cities', revision: 1, pageNumber: 4, topicId: 'cities', pageState: 'readable'
    })
  ],
  guideRefs: [
    { topicId: 'branches', documentId: govDoc, blockKey: 'p1-branches', revision: 1 },
    { topicId: 'branches', documentId: govDoc, blockKey: 'outside-fact', revision: 1 }
  ],
  familiarity: 'new',
  explanationLevel: 'simpler',
  sourceRevisionKey: 'room-government@corpus-1',
  topicScopeRevision: 'topics@1',
  prerequisites: [
    { prerequisiteId: 'constitution', topicId: 'branches' },
    { prerequisiteId: ' constitution ', topicId: 'branches', learnerPermitsGeneralBackground: false },
    { prerequisiteId: 'ordinance', topicId: 'cities' }
  ]
};

const physics: MissionPlanRequest = {
  guidedLearn: true,
  roomId: 'room-physics',
  selectedTopicIds: ['newton-2'],
  topics: [
    {
      topicId: 'newton-2',
      orderIndex: 0,
      title: 'Newton\'s second law',
      objective: 'Use Newton\'s second law to relate force, mass, and acceleration.'
    }
  ],
  blocks: [
    block({
      documentId: physDoc, blockKey: 'p2-example', revision: 4, pageNumber: 2, topicId: 'newton-2', pageState: 'readable'
    }),
    block({
      documentId: physDoc, blockKey: 'p1-law', revision: 4, pageNumber: 1, topicId: 'newton-2', pageState: 'readable'
    }),
    block({
      documentId: physDoc, blockKey: 'p3-diagram', revision: 4, pageNumber: 3, topicId: 'newton-2', pageState: 'uncertain'
    })
  ],
  familiarity: 'new',
  explanationLevel: 'deeper',
  sourceRevisionKey: 'room-physics@corpus-4',
  topicScopeRevision: 'topics@4',
  prerequisites: [
    { prerequisiteId: 'vectors', topicId: 'newton-2', learnerPermitsGeneralBackground: false },
    { prerequisiteId: 'vectors', topicId: 'newton-2', learnerPermitsGeneralBackground: true }
  ]
};

function ready(input: MissionPlanRequest, previous?: LearningMissionPlan | null) {
  const result = buildLearningMissionPlan(input, previous);
  assert.equal(result.status, 'ready');
  if (result.status !== 'ready') throw new Error('expected a plan');
  return result.plan;
}

function shuffled<T>(items: readonly T[]): T[] {
  return [...items].reverse();
}

function evidenceKeys(plan: LearningMissionPlan): string[] {
  return plan.steps.flatMap((step) => step.evidence.map((ref) => `${step.stepId}:${ref.blockKey}:${ref.quoteSpan}`));
}

test('plan generation stays off unless Guided Learn is on', () => {
  const previous = ready(government);
  for (const guidedLearn of [false, undefined, '1', 1] as Array<MissionPlanRequest['guidedLearn']>) {
    const result = buildLearningMissionPlan(
      { ...government, guidedLearn: guidedLearn as MissionPlanRequest['guidedLearn'], roomId: '' },
      previous
    );
    assert.deepEqual(result, { status: 'disabled', plan: null });
  }
  assert.throws(() => buildLearningMissionPlan({ ...government, roomId: ' ' }), /Invalid mission plan request/);
  assert.equal(LEARN_MISSION_WRITES_MASTERY, false);
});

test('the same inputs rebuild the same plan and reuse it', () => {
  const first = ready(government);
  const second = ready(government);
  assert.deepEqual(second, first);
  const reused = buildLearningMissionPlan(government, first);
  assert.equal(reused.status, 'ready');
  if (reused.status === 'ready') assert.equal(reused.plan, first);

  const reversed = ready({
    ...government,
    selectedTopicIds: shuffled(government.selectedTopicIds),
    topics: shuffled(government.topics),
    blocks: shuffled(government.blocks),
    guideRefs: shuffled(government.guideRefs ?? []),
    prerequisites: shuffled(government.prerequisites ?? [])
  });
  assert.deepEqual(reversed, first);

  const withoutGuide = ready({ ...government, guideRefs: undefined });
  assert.deepEqual(withoutGuide, first);

  const physicsPlan = ready(physics);
  const physicsShuffled = ready({
    ...physics,
    blocks: shuffled(physics.blocks),
    prerequisites: shuffled(physics.prerequisites ?? [])
  });
  assert.deepEqual(physicsShuffled, physicsPlan);
  assert.notEqual(physicsPlan.planId, first.planId);

  const deeperGovernment = ready({ ...government, explanationLevel: 'deeper' });
  assert.equal(deeperGovernment.explanationLevel, 'deeper');
  assert.equal(deeperGovernment.familiarity, 'new');
  assert.deepEqual(deeperGovernment.steps.map((step) => ({
    role: step.role, coverage: step.coverage, evidence: step.evidence, labeled: step.labeledGeneralBackground
  })), first.steps.map((step) => ({
    role: step.role, coverage: step.coverage, evidence: step.evidence, labeled: step.labeledGeneralBackground
  })));
  assert.notEqual(deeperGovernment.planId, first.planId);

  const familiar = ready({ ...government, familiarity: 'some' });
  assert.equal(familiar.familiarity, 'some');
  assert.equal(familiar.explanationLevel, 'simpler');
  assert.deepEqual(evidenceKeys(familiar), evidenceKeys(first));
  assert.notEqual(familiar.planId, first.planId);

  const simplerPhysics = ready({ ...physics, explanationLevel: 'simpler' });
  assert.equal(simplerPhysics.familiarity, 'new');
  assert.equal(simplerPhysics.explanationLevel, 'simpler');
  assert.deepEqual(evidenceKeys(simplerPhysics), evidenceKeys(physicsPlan));

  const branchesBlock = government.blocks[0];
  const conflicted = {
    ...government,
    blocks: [
      { ...branchesBlock, pageState: 'readable' as const },
      { ...branchesBlock, pageState: 'uncertain' as const },
      ...government.blocks
    ]
  };
  const conflictPlan = ready(conflicted);
  const conflictReversed = ready({ ...conflicted, blocks: shuffled(conflicted.blocks) });
  assert.deepEqual(conflictReversed, conflictPlan);
  const demonstration = conflictPlan.steps.find((step) => step.stepId === 'step:branches:demonstration');
  assert.equal(demonstration?.coverage, 'partial_coverage');
  assert.deepEqual(demonstration?.evidence, []);
  assert.equal(conflictPlan.objectives.filter((objective) => objective.topicId === 'branches').length, 1);
  assert.equal(conflictPlan.objectives.find((objective) => objective.topicId === 'branches')?.statement, 'Name the three branches of government.');
});

test('missing foundations are unsupported prerequisites and revisions invalidate the map', () => {
  const gov = ready(government);
  const phys = ready(physics);

  assert.equal(gov.familiarity, 'new');
  assert.equal(gov.explanationLevel, 'simpler');
  assert.equal(phys.familiarity, 'new');
  assert.equal(phys.explanationLevel, 'deeper');
  assert.deepEqual(gov.topicIds, ['branches', 'voting', 'oath']);
  assert.equal(new Set(gov.topicIds).size, gov.topicIds.length);
  assert.equal(gov.topicIds.includes('cities'), false);
  assert.equal(JSON.stringify(gov).includes('p4-cities'), false);
  assert.equal(JSON.stringify(gov).includes('outside-fact'), false);

  const constitution = gov.steps.find((step) => step.stepId === 'step:branches:foundation:constitution');
  assert.ok(constitution);
  assert.equal(constitution?.coverage, 'unsupported_prerequisite');
  assert.deepEqual(constitution?.evidence, []);
  assert.equal(constitution?.labeledGeneralBackground, false);
  assert.equal(gov.steps.filter((step) => step.coverage === 'unsupported_prerequisite').length, 1);

  const branches = gov.steps.filter((step) => step.topicId === 'branches' && step.role !== 'foundation');
  assert.deepEqual(branches.map((step) => step.role), ['demonstration', 'learner_action', 'formative_check']);
  for (const step of branches) {
    assert.equal(step.coverage, 'supported');
    assert.equal(step.labeledGeneralBackground, false);
    assert.deepEqual(step.evidence, [{
      documentId: govDoc, blockKey: 'p1-branches', revision: 1, pageNumber: 1, quoteSpan: null
    }]);
  }
  const oath = gov.steps.filter((step) => step.topicId === 'oath' && step.role !== 'foundation');
  for (const step of oath) {
    assert.equal(step.coverage, 'partial_coverage');
    assert.deepEqual(step.evidence, []);
  }
  assert.equal(JSON.stringify(gov).includes('p3-oath'), false);

  const vectors = phys.steps.find((step) => step.stepId === 'step:newton-2:foundation:vectors');
  assert.ok(vectors);
  assert.equal(vectors?.coverage, 'unsupported_prerequisite');
  assert.deepEqual(vectors?.evidence, []);
  assert.equal(vectors?.labeledGeneralBackground, true);
  const law = phys.steps.filter((step) => step.role !== 'foundation');
  assert.deepEqual(law.map((step) => step.role), ['demonstration', 'learner_action', 'formative_check']);
  for (const step of law) {
    assert.equal(step.coverage, 'partial_coverage');
    assert.equal(step.labeledGeneralBackground, false);
    assert.deepEqual(step.evidence.map((ref) => ref.blockKey), ['p1-law', 'p2-example']);
    assert.equal(step.evidence.every((ref) => ref.quoteSpan === null), true);
  }
  assert.equal(JSON.stringify(phys).includes('p3-diagram'), false);

  assert.equal(missionPlanIsCurrent(gov, {
    sourceRevisionKey: gov.sourceRevisionKey,
    topicScopeRevision: gov.topicScopeRevision
  }), true);
  const replaced = ready({
    ...government,
    sourceRevisionKey: 'room-government@corpus-2',
    blocks: government.blocks.filter((item) => item.blockKey !== 'p2-voting')
  });
  assert.equal(missionPlanIsCurrent(gov, {
    sourceRevisionKey: replaced.sourceRevisionKey,
    topicScopeRevision: replaced.topicScopeRevision
  }), false);
  assert.notEqual(replaced.planId, gov.planId);
  assert.equal(JSON.stringify(replaced).includes('p2-voting'), false);
  const voting = replaced.steps.filter((step) => step.topicId === 'voting' && step.role !== 'foundation');
  for (const step of voting) {
    assert.equal(step.coverage, 'partial_coverage');
    assert.deepEqual(step.evidence, []);
  }
  assert.equal(buildLearningMissionPlan(government, gov).status === 'ready'
    && buildLearningMissionPlan(government, gov).plan === gov, true);
});

test('building a mission plan writes no mastery', () => {
  const source = readFileSync(new URL('./mission-plan.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('reduceLearningEvent'), false);
  assert.equal(source.includes('nextChallenge'), false);
  assert.equal(source.includes('record_learning_event'), false);
  assert.equal(source.includes("from './director'"), false);
  assert.equal(source.includes("from './reducer'"), false);
  const plan = ready(physics);
  assert.equal(LEARN_MISSION_WRITES_MASTERY, false);
  assert.equal(JSON.stringify(plan).includes('mastery'), false);
  assert.equal(plan.version, 1);
});
