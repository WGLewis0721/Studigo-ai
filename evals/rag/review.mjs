/** E1 review slice: a balanced subset of the candidate cases that a named human checks. Pure functions, no network. */
import { hash } from './score.mjs';
import { isHumanReviewer } from '../grading/labels.mjs';

export const REVIEW_SCENARIOS = ['plain', 'table', 'unsupported', 'conflict', 'injection', 'foreign-user'];
export const SLICE_SIZE = 50;

const BLANK_REVIEW = { status: 'pending', reviewer: null, expectedCorrect: null, scopeCorrect: null, notes: null };

/** Excludes the review block, so recording a review does not invalidate the row it was recorded on. */
export const caseHash = c => hash({ ...c, review: undefined });

const topicOf = c => c.id.split(':')[0];

export function buildReviewSlice(cases, size = SLICE_SIZE) {
  const byId = new Map(cases.map(c => [c.id, c]));
  const bands = [...new Set(cases.map(c => c.band))];
  const topicsByBand = bands.map(band => [...new Set(cases.filter(c => c.band === band).map(topicOf))]);
  // Alternating grade bands keeps every scenario's window of topics balanced across them.
  const topics = [];
  for (let i = 0; topicsByBand.some(group => i < group.length); i++) {
    for (const group of topicsByBand) if (i < group.length) topics.push(group[i]);
  }
  const base = Math.floor(size / REVIEW_SCENARIOS.length);
  const extra = size % REVIEW_SCENARIOS.length;
  return REVIEW_SCENARIOS.flatMap((scenario, s) => {
    const take = Math.min(topics.length, base + (s < extra ? 1 : 0));
    return Array.from({ length: take }, (_, i) => byId.get(`${topics[(s * 2 + i) % topics.length]}:${scenario}`));
  }).map(c => ({
    id: c.id,
    review: { ...BLANK_REVIEW },
    caseHash: caseHash(c),
    scenario: c.scenario,
    band: c.band,
    subject: c.subject,
    question: c.question,
    expected: c.expected,
    permitted: c.permitted,
    chunks: c.chunks
  }));
}

export function parseReviewJsonl(text) {
  const rows = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      rows.push(JSON.parse(line));
    } catch {
      throw new Error(`review line ${index + 1} is not valid JSON`);
    }
  });
  return rows;
}

export const toReviewJsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';

const isBlank = review => Object.keys(BLANK_REVIEW).every(key => (review?.[key] ?? null) === BLANK_REVIEW[key]);

/** Returns a list of problems. An empty list means every row is either untouched or fully reviewed by a named human. */
export function validateReviewRows(rows, cases) {
  const problems = [];
  const byId = new Map(cases.map(c => [c.id, c]));
  const seen = new Set();
  if (!rows.length) problems.push('no review rows');
  rows.forEach((row, index) => {
    const where = `row ${index + 1}${row?.id ? ` (${row.id})` : ''}`;
    const current = byId.get(row?.id);
    if (!current) return problems.push(`${where}: id is not a case in cases.mjs`);
    if (seen.has(row.id)) problems.push(`${where}: duplicate id`);
    seen.add(row.id);
    if (row.caseHash !== caseHash(current)) problems.push(`${where}: the case changed after this row was written; regenerate the slice and review it again`);
    const review = row.review;
    if (review?.status === 'pending') {
      if (!isBlank(review)) problems.push(`${where}: status is pending but review fields are filled; set status to "reviewed" or clear them`);
      return;
    }
    if (review?.status !== 'reviewed') return problems.push(`${where}: review.status must be "pending" or "reviewed"`);
    if (!isHumanReviewer(review.reviewer)) problems.push(`${where}: reviewer "${review.reviewer}" is empty, a fixture, or model-like; a named human must review`);
    for (const field of ['expectedCorrect', 'scopeCorrect']) {
      if (typeof review[field] !== 'boolean') problems.push(`${where}: review.${field} must be true or false`);
    }
    if (review.notes !== null && typeof review.notes !== 'string') problems.push(`${where}: review.notes must be text or null`);
    if ((review.expectedCorrect === false || review.scopeCorrect === false) && !String(review.notes ?? '').trim()) {
      problems.push(`${where}: a case marked wrong needs a note saying what is wrong`);
    }
  });
  return problems;
}

const isAccepted = row => row.review?.status === 'reviewed' && row.review.expectedCorrect === true && row.review.scopeCorrect === true;

export function summarizeReview(rows) {
  const summary = { total: rows.length, reviewed: 0, accepted: 0, needsFix: 0, pending: 0, reviewers: [], byScenario: {} };
  const reviewers = new Set();
  for (const row of rows) {
    const scenario = summary.byScenario[row.scenario] ??= { total: 0, reviewed: 0 };
    scenario.total++;
    if (row.review?.status !== 'reviewed') { summary.pending++; continue; }
    summary.reviewed++;
    scenario.reviewed++;
    reviewers.add(String(row.review.reviewer).trim());
    if (isAccepted(row)) summary.accepted++; else summary.needsFix++;
  }
  summary.reviewers = [...reviewers].sort();
  return summary;
}

/** The corpus a scored run may use: only cases a human accepted, each carrying that human's name. */
export function reviewedCases(cases, rows) {
  const problems = validateReviewRows(rows, cases);
  if (problems.length) throw new Error(`Review file is not valid:\n${problems.join('\n')}`);
  const accepted = new Map(rows.filter(isAccepted).map(row => [row.id, row.review.reviewer.trim()]));
  return cases.filter(c => accepted.has(c.id)).map(c => ({ ...c, review: { status: 'reviewed', reviewer: accepted.get(c.id) } }));
}
