import assert from "node:assert/strict";
import { test } from "node:test";
import { predictCorrectness, updateMastery } from "./bkt.js";
import { expectedScore, updateAbility, updateDifficulty } from "./elo.js";
import {
  initialMasteryState,
  recommendNextPractice,
  recordAttempt,
} from "./recommendation.js";
import { isDueForReview, nextIntervalDays, retrievability, updateStability } from "./scheduler.js";
import { DEFAULT_BKT_PARAMS, MASTERY_THRESHOLD } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// --- Bayesian Knowledge Tracing -------------------------------------------------

test("BKT: mastery converges toward 1 after repeated correct answers", () => {
  let pLearned = DEFAULT_BKT_PARAMS.pInit;
  for (let i = 0; i < 12; i += 1) {
    pLearned = updateMastery(pLearned, true, DEFAULT_BKT_PARAMS);
  }
  assert.ok(pLearned > 0.95, `expected convergence near 1, got ${pLearned}`);
});

test("BKT: mastery falls after a wrong answer even from a high prior", () => {
  const prior = 0.9;
  const posterior = updateMastery(prior, false, DEFAULT_BKT_PARAMS);
  assert.ok(posterior < prior, `expected posterior (${posterior}) < prior (${prior})`);
});

test("BKT: mastery never leaves the closed interval [0, 1]", () => {
  let pLearned = 0.5;
  for (let i = 0; i < 50; i += 1) {
    pLearned = updateMastery(pLearned, i % 2 === 0, DEFAULT_BKT_PARAMS);
    assert.ok(pLearned >= 0 && pLearned <= 1, `pLearned out of bounds: ${pLearned}`);
  }
});

test("BKT: predicted correctness rises monotonically with mastery", () => {
  const low = predictCorrectness(0.1, DEFAULT_BKT_PARAMS);
  const high = predictCorrectness(0.9, DEFAULT_BKT_PARAMS);
  assert.ok(high > low);
});

// --- Elo ability / item difficulty -----------------------------------------------

test("Elo: expectedScore is 0.5 when ability equals difficulty", () => {
  assert.ok(Math.abs(expectedScore(1500, 1500) - 0.5) < 1e-9);
});

test("Elo: a correct answer on a harder item raises ability more than on an easier item", () => {
  const gainVsHard = updateAbility(1500, 1700, true) - 1500;
  const gainVsEasy = updateAbility(1500, 1300, true) - 1500;
  assert.ok(gainVsHard > gainVsEasy);
});

test("Elo: an unexpected correct answer lowers item difficulty rating", () => {
  const newDifficulty = updateDifficulty(1200, 1800, true);
  assert.ok(newDifficulty < 1800);
});

test("Elo: repeated correct answers monotonically raise ability", () => {
  let ability = 1500;
  const observed: number[] = [ability];
  for (let i = 0; i < 5; i += 1) {
    ability = updateAbility(ability, 1500, true);
    observed.push(ability);
  }
  for (let i = 1; i < observed.length; i += 1) {
    assert.ok(observed[i] > observed[i - 1]);
  }
});

// --- Spaced repetition scheduler --------------------------------------------------

test("Scheduler: retrievability decays toward 0 as elapsed time grows", () => {
  const soon = retrievability(10, 1);
  const later = retrievability(10, 100);
  assert.ok(soon > later);
  assert.ok(later >= 0 && later <= 1);
});

test("Scheduler: a successful review grows stability; a failed review shrinks it", () => {
  const base = 5;
  const grown = updateStability(base, 5, true);
  const shrunk = updateStability(base, 5, false);
  assert.ok(grown > base);
  assert.ok(shrunk < base);
});

test("Scheduler: isDueForReview is true before any practice has occurred", () => {
  assert.equal(isDueForReview(5, null, Date.now()), true);
});

test("Scheduler: isDueForReview is false immediately after practicing", () => {
  const now = Date.now();
  assert.equal(isDueForReview(10, now, now), false);
});

test("Scheduler: isDueForReview becomes true once the target interval has elapsed", () => {
  const stability = 10;
  const interval = nextIntervalDays(stability);
  const lastPracticedAt = Date.now() - Math.ceil(interval + 1) * DAY_MS;
  assert.equal(isDueForReview(stability, lastPracticedAt, Date.now()), true);
});

// --- Recommendation / coaching-loop policy ---------------------------------------

test("Recommendation: an unpracticed skill outranks every other reason", () => {
  const now = Date.now();
  const practiced = recordAttempt(
    initialMasteryState("weak-skill"),
    { itemId: "i1", skillId: "weak-skill", correct: false, at: now },
    { difficulty: 1500 },
    now,
  ).state;
  const unpracticed = initialMasteryState("new-skill");

  const ranked = recommendNextPractice([practiced, unpracticed], now);
  assert.equal(ranked[0].skillId, "new-skill");
  assert.equal(ranked[0].reason, "never_practiced");
});

test("Recommendation: repeated correct attempts move a skill from below-threshold to review-only", () => {
  const now = Date.now();
  let state = initialMasteryState("skill-a");
  for (let i = 0; i < 15; i += 1) {
    state = recordAttempt(
      state,
      { itemId: `i${i}`, skillId: "skill-a", correct: true, at: now },
      { difficulty: state.ability },
      now,
    ).state;
  }
  assert.ok(state.pLearned >= MASTERY_THRESHOLD, `expected mastered, got pLearned=${state.pLearned}`);

  const [assignment] = recommendNextPractice([state], now);
  assert.equal(assignment.reason, "due_for_review");
});

test("Recommendation: target difficulty always tracks the learner's current ability", () => {
  const now = Date.now();
  let state = initialMasteryState("skill-b");
  state = recordAttempt(
    state,
    { itemId: "i1", skillId: "skill-b", correct: true, at: now },
    { difficulty: 1500 },
    now,
  ).state;

  const [assignment] = recommendNextPractice([state], now);
  assert.equal(assignment.targetDifficulty, state.ability);
});

test("Recommendation: diagnosis is per-skill — a wrong answer on one skill does not affect another", () => {
  const now = Date.now();
  const untouched = initialMasteryState("skill-untouched");
  const failed = recordAttempt(
    initialMasteryState("skill-failed"),
    { itemId: "i1", skillId: "skill-failed", correct: false, at: now },
    { difficulty: 1500 },
    now,
  ).state;

  assert.equal(untouched.pLearned, DEFAULT_BKT_PARAMS.pInit);
  assert.ok(failed.pLearned < DEFAULT_BKT_PARAMS.pInit);
});
