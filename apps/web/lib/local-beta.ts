import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {
  nextChallenge, projectConcept, planSession, deliverySupport, COACH_MODES,
  type CoachMode, type ExplainLevel, type ChallengeSpec, type LearningEvent, type LearningActivity,
  type SessionPlan, type SessionConcept, type ScaffoldLevel
} from '@studigo/learning';
import { FIXTURE_ROOMS, type FixtureRoom, type FixtureTopic, type FixtureTask } from './beta-fixtures';

export class BetaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Encounter = {
  id: string; spec: ChallengeSpec; task: FixtureTask; support: ScaffoldLevel;
  source: { documentId: string; page: number; revision: string };
  startedAt: string; attempts: number; completed: boolean;
  evaluatorVersion: 'fixture-exact-1'; generatorVersion: 'authored-1';
};
export type RoomState = {
  room: FixtureRoom; events: LearningEvent[]; pending: Encounter | null;
  explainLevel: ExplainLevel; coachMode: CoachMode; selectedTopicId: string | null;
  coachExplainLevel?: ExplainLevel | null; learnExplainLevel?: ExplainLevel | null;
  studyMode: 'study' | 'cram'; budgetMinutes: SessionPlan['budgetMinutes']; startedAt: string | null;
  issuedCount: number; sources: { id: string; name: string; text: string; page: number }[];
};
export type LocalBetaState = {
  revision: number; currentRoomId: string; rooms: Record<string, RoomState>;
  feedback: { result: string; text: string } | null;
  answer: { text: string; sourceId: string | null; page: number | null } | null;
};
export type BetaAction = {
  action: string; interactionId: string; revision: number; answer?: string; topicId?: string;
  roomId?: string; title?: string; mode?: string; level?: string; minutes?: number;
  activity?: string; name?: string; text?: string; rating?: number;
};

function roomState(room: FixtureRoom): RoomState {
  return { room: structuredClone(room), events: [], pending: null, explainLevel: 'standard', coachMode: 'coach',
    selectedTopicId: null, studyMode: 'study', budgetMinutes: 30, startedAt: null, issuedCount: 0,
    sources: room.topics.map(t => ({ id: t.documentId + ':' + t.page, name: room.title + ' study guide', text: t.source, page: t.page })) };
}
export function initialBetaState(): LocalBetaState {
  return { revision: 0, currentRoomId: 'math', rooms: Object.fromEntries(FIXTURE_ROOMS.map(r => [r.id, roomState(r)])), feedback: null, answer: null };
}
const learnerId = 'synthetic-local-learner';
function concepts(room: RoomState): SessionConcept[] {
  return room.room.topics.map(t => {
    const key = { userId: learnerId, roomId: room.room.id, topicId: t.id };
    return { key, title: t.title, objective: t.objective, priority: t.priority, order: t.order,
      active: t.active, supported: Boolean(t.source && Object.keys(t.tasks).length), teacherScoped: true,
      projection: projectConcept(key, room.events.filter(e => e.topicId === t.id)) };
  });
}
export function recommendation(room: RoomState, now: string) {
  return planSession({ concepts: concepts(room), mode: room.studyMode, budgetMinutes: room.budgetMinutes,
    elapsedSeconds: room.startedAt ? Math.max(0, (Date.parse(now)-Date.parse(room.startedAt))/1000) : 0,
    now, selectedTopicId: room.selectedTopicId, pendingTopicId: room.pending?.spec.concept.topicId });
}
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}
/** Conservative, authored fixture rubric. No keyword-based semantic grading. */
export function gradeFixture(task: FixtureTask, answer: string): 'correct' | 'incorrect' | 'uncertain' {
  const normalized = normalize(answer);
  // Letters accept familiar input forms, but never arbitrary sentences containing a letter.
  const choice = normalized.match(/^(?:option\s+)?([ab])\)?$/)?.[1];
  if (task.answers.some(a => normalize(a) === normalized || (choice && normalize(a) === choice))) return 'correct';
  if (task.answers.every(a => /^[ab]$/i.test(a)) && choice) return 'incorrect';
  if (task.answers.every(a => /^\d+$/.test(a)) && /^\d+$/.test(normalized)) return 'incorrect';
  return 'uncertain';
}
function sourceRevision(topic: FixtureTopic) {
  return createHash('sha256').update(topic.source).digest('hex');
}
function assertSources(room: RoomState, pending: Encounter) {
  const topic = room.room.topics.find(t => t.id === pending.spec.concept.topicId && t.active);
  if (!topic || sourceRevision(topic) !== pending.source.revision) throw new BetaError('This question’s source changed. Skip it and choose another topic.', 409);
  return topic;
}
export function record(room: RoomState, pending: Encounter, input: BetaAction, now: string, result: LearningEvent['result'], evidence: LearningEvent['evidence'] = 'assessed') {
  room.events.push({ ...pending.spec.concept, id: input.interactionId, encounterId: pending.id,
    activity: pending.spec.activity, challengeKind: pending.spec.challengeKind, result,
    scaffoldUsed: pending.support, evidence, contextId: pending.task.context,
    newContext: pending.spec.constraints.requireNewContext, misconceptionId: null, createdAt: now });
}
export function issue(room: RoomState, now: string, activity: LearningActivity, stretch = false) {
  if (room.pending) throw new BetaError('Finish or skip your current question first.', 409);
  const plan = recommendation(room, now);
  if (plan.status === 'complete') throw new BetaError('Your session is complete. Continue when you are ready.', 409);
  if (!plan.topicId) throw new BetaError('This room needs supported practice topics. You can still read your materials.');
  const concept = concepts(room).find(c => c.key.topicId === plan.topicId)!;
  const topic = room.room.topics.find(t => t.id === plan.topicId)!;
  const reviewDue = concept.projection.review.dueAt && Date.parse(concept.projection.review.dueAt) <= Date.parse(now);
  const spec = nextChallenge({ concept: { ...concept.key, objective: topic.objective },
    learnerState: concept.projection.state, recentEvents: room.events.filter(e => e.topicId === topic.id),
    activity, route: 'studigo_default', now, challengeRequest: stretch ? 'stretch' : 'normal' });
  // Session-level recall review is an explicit issued task, not a state promotion.
  if (reviewDue && !concept.projection.state.rematch) {
    spec.reasoningLevel = 1; spec.challengeKind = 'recall'; spec.reasons.push('scheduled_independent_recall');
  }
  const candidates = topic.tasks[spec.challengeKind];
  const task = candidates[room.issuedCount % candidates.length];
  if (spec.constraints.requireNewContext && room.events.some(e => e.topicId === topic.id && e.contextId === task.context)) {
    throw new BetaError('This demo has no unused context at this rung. Choose another topic; live generation is not configured.', 409);
  }
  room.issuedCount++;
  room.pending = { id: randomUUID(), spec, task, support: activity === 'practice_test' ? 0
    : Math.max(spec.scaffoldLevel, deliverySupport(room.coachMode)) as ScaffoldLevel,
    source: { documentId: topic.documentId, page: topic.page, revision: sourceRevision(topic) },
    startedAt: now, attempts: 0, completed: false, evaluatorVersion: 'fixture-exact-1', generatorVersion: 'authored-1' };
  room.startedAt ??= now;
}

/** Runs only on trusted server state. The caller must hold the store transaction. */
export function applyBetaAction(current: LocalBetaState, input: BetaAction, now: string): LocalBetaState {
  if (input.revision !== current.revision) throw new BetaError('Your session changed. Reload and retry.', 409);
  if (!Number.isFinite(Date.parse(now))) throw new BetaError('Invalid server time');
  const state = structuredClone(current);
  let room = state.rooms[state.currentRoomId];
  const lastTime = Math.max(0, ...room.events.map(e => Date.parse(e.createdAt)));
  if (Date.parse(now) <= lastTime) now = new Date(lastTime + 1).toISOString();
  state.feedback = null; state.answer = null;
  switch (input.action) {
    case 'start': case 'next': case 'stretch': {
      const activity = input.activity ?? 'coach';
      if (!['coach','quiz','flashcard','practice_test','cram','weak_area'].includes(activity)) throw new BetaError('Unknown practice activity');
      issue(room, now, activity as LearningActivity, input.action === 'stretch');
      break;
    }
    case 'submit': case 'card': {
      const pending = room.pending;
      if (!pending) throw new BetaError('There is no question to answer.', 409);
      assertSources(room, pending);
      const answer = input.answer?.trim() ?? '';
      if (input.action === 'card') {
        if (pending.spec.activity !== 'flashcard' || ![1,2,3].includes(input.rating ?? 0)) throw new BetaError('Choose a card rating');
        record(room, pending, input, now, input.rating === 3 ? 'correct' : 'incorrect', 'self_reported');
        room.pending = null;
        state.feedback = { result: 'self_reported', text: 'Recall recorded. A self-rating does not prove independent mastery.' };
      } else {
        if (pending.spec.activity === 'flashcard') throw new BetaError('Use the flashcard recall buttons');
        if (!answer || answer.length > 3000) throw new BetaError('Write a short answer first.');
        const result = gradeFixture(pending.task, answer);
        if (result === 'uncertain') {
          // A limited fixture grader cannot turn unrecognized prose into an assessed failure.
          state.feedback = { result: 'uncertain', text: 'The local exact-answer checker could not verify that. No mastery change. Try a concise answer or ask for help.' };
          pending.attempts++;
        } else {
          record(room, pending, input, now, result);
          pending.attempts++;
          if (result === 'correct') {
            room.pending = null;
            state.feedback = { result: 'correct', text: pending.support ? 'You got it with support. Try a fresh question on your own next.' : 'You got it independently. Your next question follows this evidence.' };
          } else {
            pending.support = Math.max(pending.support, 2) as ScaffoldLevel;
            // Feedback is actual support and must be durable before the next answer.
            record(room, pending, { ...input, interactionId: input.interactionId + ':support' }, new Date(Date.parse(now)+1).toISOString(), 'help');
            state.feedback = { result: 'incorrect', text: 'Not quite. ' + pending.task.hint };
          }
        }
      }
      break;
    }
    case 'hint': case 'reveal': case 'skip': {
      const pending = room.pending;
      if (!pending) throw new BetaError('There is no pending question.', 409);
      assertSources(room, pending);
      if (pending.spec.activity === 'practice_test' && input.action !== 'skip') throw new BetaError('Practice Test is independent. Skip to leave this question.');
      if (input.action === 'skip') {
        record(room, pending, input, now, 'skipped'); room.pending = null;
        state.feedback = { result: 'skipped', text: 'Skipped. This does not count as a wrong answer.' };
      } else {
        pending.support = Math.max(pending.support, input.action === 'reveal' ? 5 : 2) as ScaffoldLevel;
        record(room, pending, input, now, input.action === 'reveal' ? 'revealed' : 'help');
        state.feedback = { result: input.action, text: input.action === 'hint' ? pending.task.hint : pending.task.answer };
        if (input.action === 'reveal' && pending.spec.activity !== 'flashcard') room.pending = null;
      }
      break;
    }
    case 'preferences': {
      if (!COACH_MODES.includes(input.mode as CoachMode) || !['simpler','standard','deeper'].includes(input.level ?? '')) throw new BetaError('Choose valid room settings');
      room.coachMode = input.mode as CoachMode; room.explainLevel = input.level as ExplainLevel;
      state.feedback = { result: 'settings', text: 'Room settings saved. A pending question keeps its original task and support.' };
      break;
    }
    case 'select': {
      if (room.pending) throw new BetaError('Finish or skip this question before switching topics.', 409);
      if (input.topicId && !room.room.topics.some(t => t.id === input.topicId && t.active)) throw new BetaError('Topic is unavailable');
      room.selectedTopicId = input.topicId || null; break;
    }
    case 'session': {
      if (!['study','cram'].includes(input.mode ?? '') || ![15,30,60,120].includes(input.minutes ?? 0)) throw new BetaError('Choose a study mode and time budget');
      room.studyMode = input.mode as RoomState['studyMode']; room.budgetMinutes = input.minutes as RoomState['budgetMinutes']; break;
    }
    case 'continue': room.startedAt = now; break;
    case 'switchRoom': {
      if (!input.roomId || !state.rooms[input.roomId]) throw new BetaError('Room not found');
      state.currentRoomId = input.roomId; break;
    }
    case 'createRoom': {
      const title = input.title?.trim();
      if (!title || title.length > 100 || Object.keys(state.rooms).length >= 10) throw new BetaError('Use a short room title (maximum 10 rooms).');
      const id = randomUUID();
      state.rooms[id] = roomState({ id, title, subject: 'Your local materials', topics: [] }); state.currentRoomId = id; break;
    }
    case 'upload': {
      if (!input.text?.trim() || input.text.length > 50000 || !input.name?.trim() || input.name.length > 100) throw new BetaError('Add a text or Markdown document under 50,000 characters.');
      if (room.sources.length >= 20) throw new BetaError('This local beta supports up to 20 sources per room.');
      const id = randomUUID(); room.sources.push({ id, name: input.name, text: input.text, page: 1 });
      // Imported content is available for reading, never promoted into an authored grading rubric.
      room.room.topics.push({ id, title: input.name.replace(/\.(txt|md)$/i, ''), objective: 'Read and review this source.', priority: 90,
        order: room.room.topics.length, active: true, documentId: id, page: 1, source: input.text,
        explanations: { simpler: input.text, standard: input.text, deeper: input.text }, tasks: {} as FixtureTopic['tasks'] });
      state.feedback = { result: 'uploaded', text: 'Material saved locally. Source reading is ready; generated practice for imported files requires the live AI path.' }; break;
    }
    case 'removeTopic': {
      if (room.pending?.spec.concept.topicId === input.topicId) throw new BetaError('Skip the pending question before removing its topic.', 409);
      const topic = room.room.topics.find(t => t.id === input.topicId);
      if (!topic) throw new BetaError('Topic not found');
      topic.active = false; if (room.selectedTopicId === topic.id) room.selectedTopicId = null; break;
    }
    case 'ask': {
      const query = (input.answer ?? '').toLowerCase();
      if (!query.trim() || query.length > 1000) throw new BetaError('Ask a short question');
      const words = new Set(query.match(/[a-z]{4,}/g) ?? []);
      const stop = new Set(['what','which','does','that','this','with','from','about','explain','please','would','could','should','have']);
      const ranked = room.sources.map(source => ({ source, score: [...words].filter(w => !stop.has(w) && new RegExp('\\b' + w + '\\b', 'i').test(source.text)).length })).sort((a,b) => b.score-a.score);
      const hit = ranked[0]?.score ? ranked[0].source : null;
      state.answer = hit ? { text: hit.text, sourceId: hit.id, page: hit.page }
        : { text: 'I could not find supporting material in this room. Add a relevant source or choose a topic from your guide.', sourceId: null, page: null };
      break;
    }
    case 'reset': return { ...initialBetaState(), revision: current.revision + 1 };
    default: throw new BetaError('Unknown action');
  }
  state.revision++; return state;
}

/** Never send fixture rubrics or future correct answers in a pending API response. */
export function publicBetaState(state: LocalBetaState, now: string) {
  const room = state.rooms[state.currentRoomId];
  const projected = concepts(room);
  const pending = room.pending;
  const topic = room.room.topics.find(t => t.id === pending?.spec.concept.topicId);
  return {
    revision: state.revision, currentRoomId: state.currentRoomId,
    rooms: Object.values(state.rooms).map(r => ({ id: r.room.id, title: r.room.title, subject: r.room.subject })),
    settings: { explainLevel: room.explainLevel, coachMode: room.coachMode, studyMode: room.studyMode, budgetMinutes: room.budgetMinutes },
    selectedTopicId: room.selectedTopicId, plan: recommendation(room, now),
    topics: projected.filter(c => c.active).map(c => ({ id: c.key.topicId, title: c.title, objective: c.objective, supported: c.supported,
      stage: c.projection.stage, needsCheck: c.projection.needsCheck, reviewDue: Boolean(c.projection.review.dueAt && Date.parse(c.projection.review.dueAt) <= Date.parse(now)),
      reviewAt: c.projection.review.dueAt, reasoningLevel: c.projection.state.reasoningLevel, independentSuccesses: c.projection.state.independentSuccessCount,
      explanation: room.room.topics.find(t => t.id === c.key.topicId)!.explanations[room.explainLevel],
      sourceId: room.sources.find(s => s.id === room.room.topics.find(t => t.id === c.key.topicId)!.documentId)?.id
        ?? room.room.topics.find(t => t.id === c.key.topicId)!.documentId + ':' + room.room.topics.find(t => t.id === c.key.topicId)!.page })),
    pending: pending ? { id: pending.id, prompt: pending.task.prompt, kind: pending.spec.challengeKind,
      activity: pending.spec.activity, topicId: pending.spec.concept.topicId, support: pending.support,
      sourceId: pending.source.documentId + ':' + pending.source.page, page: pending.source.page,
      initialExample: pending.support >= 3 && pending.spec.activity !== 'practice_test' ? topic?.explanations[room.explainLevel] : null,
      offerTopicChange: pending.attempts >= 2, reasons: pending.spec.reasons } : null,
    sources: room.sources, feedback: state.feedback, answer: state.answer,
    eventCount: room.events.length,
    recentEvents: room.events.slice(-8).reverse().map(e => ({ activity: e.activity, result: e.result, topicId: e.topicId, createdAt: e.createdAt, assistance: e.scaffoldUsed, evidence: e.evidence }))
  };
}
export type PublicBetaState = ReturnType<typeof publicBetaState>;

export class LocalBetaStore {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS interactions (session_id TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(session_id,id));');
  }
  read(id: string): LocalBetaState {
    const row = this.db.prepare('SELECT state FROM sessions WHERE id=?').get(id) as { state: string } | undefined;
    if (row) return JSON.parse(row.state);
    const state = initialBetaState(); this.db.prepare('INSERT INTO sessions VALUES (?,?)').run(id, JSON.stringify(state)); return state;
  }
  commit(id: string, input: BetaAction, now: string): LocalBetaState {
    const fingerprint = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b]) => a.localeCompare(b))))).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT fingerprint,response FROM interactions WHERE session_id=? AND id=?').get(id, input.interactionId) as { fingerprint: string; response: string } | undefined;
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new BetaError('Conflicting retry. Use the original interaction.', 409);
        this.db.exec('COMMIT'); return JSON.parse(prior.response);
      }
      const next = applyBetaAction(this.read(id), input, now);
      this.db.prepare('UPDATE sessions SET state=? WHERE id=?').run(JSON.stringify(next), id);
      this.db.prepare('INSERT INTO interactions VALUES (?,?,?,?)').run(id, input.interactionId, fingerprint, JSON.stringify(next));
      this.db.exec('COMMIT'); return next;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  /** Compatibility operations commit their evidence and response in the same transaction. */
  transact<T>(id: string, operationId: string, input: unknown,
    update: (state: LocalBetaState) => { state: LocalBetaState; response: T }): T {
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,canonical(item)])) : value;
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT fingerprint,response FROM interactions WHERE session_id=? AND id=?').get(id, operationId) as {fingerprint:string;response:string}|undefined;
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new BetaError('Conflicting retry.',409);
        this.db.exec('COMMIT'); return JSON.parse(prior.response) as T;
      }
      const current = this.read(id);
      const result = update(structuredClone(current));
      result.state.revision = current.revision + 1;
      this.db.prepare('UPDATE sessions SET state=? WHERE id=?').run(JSON.stringify(result.state),id);
      this.db.prepare('INSERT INTO interactions VALUES (?,?,?,?)').run(id,operationId,fingerprint,JSON.stringify(result.response));
      this.db.exec('COMMIT'); return result.response;
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
let store: LocalBetaStore | undefined;
export function betaStore() {
  if (!store) {
    const directory = join(process.cwd(), '.local-beta');
    mkdirSync(directory, { recursive: true });
    store = new LocalBetaStore(join(directory, 'study.sqlite'));
  }
  return store;
}
