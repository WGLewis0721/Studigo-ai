/**
 * GL01 source-grounded mission blueprint.
 *
 * Builds one LearningMissionPlan from the selected topic ids, teacher scope,
 * current source blocks, and optional guide refs. The same inputs always
 * produce the same plan, ids, and order. Passing the previous plan back
 * returns that object when it still matches.
 *
 * There is no prerequisite graph. A supplied prerequisite is recorded as
 * unsupported_prerequisite with empty evidence. Learner permission only sets
 * labeledGeneralBackground. It does not turn that step into course evidence.
 *
 * The Guided Learn flag is an input. When it is off, this returns no plan.
 * Learn checkpoints stay formative. This module does not write mastery.
 */

import {
  LEARNING_MISSION_PLAN_VERSION,
  MISSION_EXPLANATION_LEVELS,
  MISSION_FAMILIARITY,
  type LearningMissionPlan,
  type MissionConceptStep,
  type MissionCoverage,
  type MissionEvidenceRef,
  type MissionExplanationLevel,
  type MissionFamiliarity,
  type MissionObjective
} from './mission';

export type MissionPlanTopic = {
  topicId: string;
  orderIndex: number;
  title: string;
  objective: string | null;
};

export type MissionPlanPageState = 'readable' | 'uncertain' | 'unreadable' | 'partial';

export type MissionPlanBlock = {
  documentId: string;
  blockKey: string;
  revision: number;
  pageNumber: number | null;
  topicId: string;
  /** Readable pages can be cited. Other states are coverage gaps. */
  pageState: MissionPlanPageState;
};

/** A foundation claim. Nothing in storage supplies these edges. */
export type MissionPlanPrerequisite = {
  prerequisiteId: string;
  topicId: string;
  /** Explicit permission to teach this as labeled general background. */
  learnerPermitsGeneralBackground?: boolean;
};

/**
 * A guide edition ref already tied to a topic.
 * It becomes course evidence only when the same readable source block is present.
 */
export type MissionPlanGuideRef = {
  topicId: string;
  documentId: string;
  blockKey: string;
  revision: number;
};

export type MissionPlanRequest = {
  /** Result of the Guided Learn flag. Only `true` builds a plan. */
  guidedLearn: boolean;
  roomId: string;
  selectedTopicIds: readonly string[];
  topics: readonly MissionPlanTopic[];
  blocks: readonly MissionPlanBlock[];
  guideRefs?: readonly MissionPlanGuideRef[];
  familiarity: MissionFamiliarity;
  explanationLevel: MissionExplanationLevel;
  sourceRevisionKey: string;
  topicScopeRevision: string;
  prerequisites?: readonly MissionPlanPrerequisite[];
};

export type MissionPlanBuild =
  | { status: 'disabled'; plan: null }
  | { status: 'ready'; plan: LearningMissionPlan };

const PAGE_STATES = new Set<MissionPlanPageState>(['readable', 'uncertain', 'unreadable', 'partial']);
const TEACHING_ROLES = ['demonstration', 'learner_action', 'formative_check'] as const;

function invalid(): never {
  throw new Error('Invalid mission plan request');
}

function fnv1a(text: string): string {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fingerprint(parts: readonly string[]): string {
  const body = parts.join('\n');
  return `${fnv1a(body)}${fnv1a(`~${body}`)}`;
}

function stepToken(value: string): string {
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : fnv1a(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** True when the plan was built for this source revision and topic scope. */
export function missionPlanIsCurrent(
  plan: LearningMissionPlan,
  current: { sourceRevisionKey: string; topicScopeRevision: string }
): boolean {
  return plan.version === LEARNING_MISSION_PLAN_VERSION
    && plan.sourceRevisionKey === current.sourceRevisionKey
    && plan.topicScopeRevision === current.topicScopeRevision;
}

function topicStatement(topic: MissionPlanTopic): string {
  const objective = topic.objective?.trim() ?? '';
  if (objective) return objective;
  return topic.title.trim();
}

function assertRequest(input: MissionPlanRequest) {
  if (!nonEmpty(input.roomId)) invalid();
  if (!(MISSION_FAMILIARITY as readonly string[]).includes(input.familiarity)) invalid();
  if (!(MISSION_EXPLANATION_LEVELS as readonly string[]).includes(input.explanationLevel)) invalid();
  if (!nonEmpty(input.sourceRevisionKey) || !nonEmpty(input.topicScopeRevision)) invalid();
  if (!Array.isArray(input.selectedTopicIds) || !Array.isArray(input.topics) || !Array.isArray(input.blocks)) invalid();
  if (input.prerequisites != null && !Array.isArray(input.prerequisites)) invalid();
  if (input.guideRefs != null && !Array.isArray(input.guideRefs)) invalid();
  for (const id of input.selectedTopicIds) if (typeof id !== 'string') invalid();
  for (const topic of input.topics) {
    if (!topic || !nonEmpty(topic.topicId) || !integer(topic.orderIndex)) invalid();
    if (typeof topic.title !== 'string' || (topic.objective != null && typeof topic.objective !== 'string')) invalid();
  }
  for (const block of input.blocks) {
    if (!block || !nonEmpty(block.documentId) || !nonEmpty(block.blockKey) || !nonEmpty(block.topicId)) invalid();
    if (!integer(block.revision) || block.revision < 0) invalid();
    if (block.pageNumber != null && (!integer(block.pageNumber) || block.pageNumber < 0)) invalid();
    if (!PAGE_STATES.has(block.pageState)) invalid();
  }
  for (const item of input.prerequisites ?? []) {
    if (!item || !nonEmpty(item.prerequisiteId) || !nonEmpty(item.topicId)) invalid();
    if (item.learnerPermitsGeneralBackground != null && typeof item.learnerPermitsGeneralBackground !== 'boolean') invalid();
  }
  for (const ref of input.guideRefs ?? []) {
    if (!ref || !nonEmpty(ref.topicId) || !nonEmpty(ref.documentId) || !nonEmpty(ref.blockKey)) invalid();
    if (!integer(ref.revision) || ref.revision < 0) invalid();
  }
}

type RankedTopic = MissionPlanTopic & { statement: string };

function rankedTopics(input: MissionPlanRequest): RankedTopic[] {
  const byId = new Map<string, RankedTopic>();
  for (const topic of input.topics) {
    const statement = topicStatement(topic);
    if (!statement) continue;
    const ranked: RankedTopic = { ...topic, statement };
    const current = byId.get(topic.topicId);
    if (!current) {
      byId.set(topic.topicId, ranked);
      continue;
    }
    const order = ranked.orderIndex - current.orderIndex;
    if (order < 0 || (order === 0 && ranked.statement.localeCompare(current.statement) < 0)) {
      byId.set(topic.topicId, ranked);
    }
  }
  const selected = new Set<string>();
  for (const id of input.selectedTopicIds) {
    if (byId.has(id)) selected.add(id);
  }
  return [...byId.values()]
    .filter((topic) => selected.has(topic.topicId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.topicId.localeCompare(b.topicId));
}

const PAGE_STATE_RANK: Record<MissionPlanPageState, number> = {
  unreadable: 0,
  uncertain: 1,
  partial: 2,
  readable: 3
};

function blockIdentity(block: MissionPlanBlock): string {
  return `${block.topicId}\0${block.documentId}\0${block.blockKey}\0${block.revision}\0${block.pageNumber ?? ''}`;
}

function toEvidence(block: MissionPlanBlock): MissionEvidenceRef {
  return {
    documentId: block.documentId,
    blockKey: block.blockKey,
    revision: block.revision,
    pageNumber: block.pageNumber,
    quoteSpan: null
  };
}

function compareEvidence(a: MissionPlanBlock, b: MissionPlanBlock): number {
  const pageA = a.pageNumber ?? Number.MAX_SAFE_INTEGER;
  const pageB = b.pageNumber ?? Number.MAX_SAFE_INTEGER;
  if (pageA !== pageB) return pageA - pageB;
  if (a.blockKey !== b.blockKey) return a.blockKey.localeCompare(b.blockKey);
  if (a.documentId !== b.documentId) return a.documentId.localeCompare(b.documentId);
  return a.revision - b.revision;
}

function teachingEvidence(
  topicId: string,
  blocks: readonly MissionPlanBlock[],
  guideRefs: readonly MissionPlanGuideRef[]
): { evidence: MissionEvidenceRef[]; coverage: MissionCoverage } {
  const topicBlocks = blocks.filter((block) => block.topicId === topicId);
  const readable = topicBlocks.filter((block) => block.pageState === 'readable').sort(compareEvidence);
  const cited = new Map<string, MissionEvidenceRef>();
  for (const block of readable) cited.set(blockIdentity(block), toEvidence(block));
  for (const ref of guideRefs) {
    if (ref.topicId !== topicId) continue;
    const match = readable.find((block) =>
      block.documentId === ref.documentId && block.blockKey === ref.blockKey && block.revision === ref.revision);
    if (!match) continue;
    cited.set(blockIdentity(match), toEvidence(match));
  }
  const evidence = [...cited.values()];
  const hasGap = topicBlocks.some((block) => block.pageState !== 'readable');
  const coverage: MissionCoverage = topicBlocks.length > 0 && !hasGap && evidence.length > 0
    ? 'supported'
    : 'partial_coverage';
  return { evidence, coverage };
}

type Foundation = { prerequisiteId: string; topicId: string; labeledGeneralBackground: boolean };

function foundationsFor(input: MissionPlanRequest, topicIds: ReadonlySet<string>): Foundation[] {
  const byKey = new Map<string, Foundation>();
  for (const item of input.prerequisites ?? []) {
    const prerequisiteId = item.prerequisiteId.trim();
    const topicId = item.topicId;
    if (!topicIds.has(topicId)) continue;
    const key = `${topicId}\0${prerequisiteId}`;
    const permitted = item.learnerPermitsGeneralBackground === true;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, { prerequisiteId, topicId, labeledGeneralBackground: permitted });
    else if (permitted) existing.labeledGeneralBackground = true;
  }
  return [...byKey.values()].sort((a, b) => a.topicId.localeCompare(b.topicId) || a.prerequisiteId.localeCompare(b.prerequisiteId));
}

function assemble(input: MissionPlanRequest): LearningMissionPlan {
  const topics = rankedTopics(input);
  const topicIds = topics.map((topic) => topic.topicId);
  const selected = new Set(topicIds);
  const blocksByKey = new Map<string, MissionPlanBlock>();
  for (const block of input.blocks) {
    if (!selected.has(block.topicId)) continue;
    const key = blockIdentity(block);
    const current = blocksByKey.get(key);
    if (!current || PAGE_STATE_RANK[block.pageState] < PAGE_STATE_RANK[current.pageState]) {
      blocksByKey.set(key, block);
    }
  }
  const blocks = [...blocksByKey.values()];
  const guideRefs = input.guideRefs ?? [];
  const objectives: MissionObjective[] = topics.map((topic) => ({
    objectiveId: `obj:${topic.topicId}`,
    topicId: topic.topicId,
    statement: topic.statement
  }));
  const foundationByTopic = new Map<string, Foundation[]>();
  for (const foundation of foundationsFor(input, selected)) {
    const list = foundationByTopic.get(foundation.topicId) ?? [];
    list.push(foundation);
    foundationByTopic.set(foundation.topicId, list);
  }
  const steps: MissionConceptStep[] = [];
  for (const topic of topics) {
    const objectiveId = `obj:${topic.topicId}`;
    for (const foundation of foundationByTopic.get(topic.topicId) ?? []) {
      steps.push({
        stepId: `step:${topic.topicId}:foundation:${stepToken(foundation.prerequisiteId)}`,
        topicId: topic.topicId,
        role: 'foundation',
        objectiveId,
        evidence: [],
        coverage: 'unsupported_prerequisite',
        labeledGeneralBackground: foundation.labeledGeneralBackground
      });
    }
    const teaching = teachingEvidence(topic.topicId, blocks, guideRefs);
    for (const role of TEACHING_ROLES) {
      steps.push({
        stepId: `step:${topic.topicId}:${role}`,
        topicId: topic.topicId,
        role,
        objectiveId,
        evidence: teaching.evidence.map((ref) => ({ ...ref })),
        coverage: teaching.coverage,
        labeledGeneralBackground: false
      });
    }
  }
  const identity = [
    String(LEARNING_MISSION_PLAN_VERSION),
    input.roomId,
    input.sourceRevisionKey,
    input.topicScopeRevision,
    input.familiarity,
    input.explanationLevel,
    topicIds.join(','),
    ...objectives.map((objective) => `${objective.objectiveId}|${objective.statement}`),
    ...steps.map((step) => [
      step.stepId,
      step.role,
      step.coverage,
      step.labeledGeneralBackground ? '1' : '0',
      step.evidence.map((ref) => `${ref.documentId}|${ref.blockKey}|${ref.revision}|${ref.pageNumber ?? ''}`).join(',')
    ].join('|'))
  ];
  return {
    version: LEARNING_MISSION_PLAN_VERSION,
    planId: `plan:${fingerprint(identity)}`,
    roomId: input.roomId,
    topicIds,
    familiarity: input.familiarity,
    explanationLevel: input.explanationLevel,
    sourceRevisionKey: input.sourceRevisionKey,
    topicScopeRevision: input.topicScopeRevision,
    objectives,
    steps
  };
}

function samePlan(a: LearningMissionPlan, b: LearningMissionPlan): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Build the mission plan for these inputs.
 * `previous` is reused when a new build is identical, including after a retry.
 * A changed source or topic revision produces a new plan.
 * `guidedLearn: false` returns `{ status: 'disabled', plan: null }`.
 */
export function buildLearningMissionPlan(
  input: MissionPlanRequest,
  previous: LearningMissionPlan | null = null
): MissionPlanBuild {
  if (input?.guidedLearn !== true) return { status: 'disabled', plan: null };
  assertRequest(input);
  const plan = assemble(input);
  if (previous && samePlan(previous, plan)) return { status: 'ready', plan: previous };
  return { status: 'ready', plan };
}
