/**
 * Shared, subject-agnostic vocabulary for the deterministic mastery/recommendation
 * engine. No subject (AFOQT, fifth-grade science, calculus, ...) is named here —
 * everything is expressed as skill/item/attempt so the same engine serves any
 * course, grade, or exam per the "make Studigo subject-agnostic" requirement.
 */

/** A single assessable unit of knowledge (a "knowledge component" in the BKT literature). */
export interface Skill {
  id: string;
  label: string;
}

/** One practice item bound to a skill, with a difficulty on the same Elo-style scale as learner ability. */
export interface Item {
  id: string;
  skillId: string;
  /** Elo-style difficulty rating. 1500 is the calibration midpoint, matching the learner default rating. */
  difficulty: number;
}

/** One observed learner response to an item. */
export interface Attempt {
  itemId: string;
  skillId: string;
  correct: boolean;
  /** Attempt timestamp in epoch milliseconds. */
  at: number;
}

/** The four canonical Bayesian Knowledge Tracing parameters for one skill (Corbett & Anderson, 1994). */
export interface BktParams {
  /** P(L0): prior probability the learner already knows the skill before any evidence. */
  pInit: number;
  /** P(T): probability of transitioning from unlearned to learned after one practice opportunity. */
  pTransit: number;
  /** P(S): probability of an incorrect response despite having learned the skill. */
  pSlip: number;
  /** P(G): probability of a correct response despite not having learned the skill. */
  pGuess: number;
}

/** Per-skill mastery state tracked over time. */
export interface MasteryState {
  skillId: string;
  /** Current P(L): probability the skill is learned, in [0, 1]. */
  pLearned: number;
  /** Learner's Elo-style ability rating for this skill. */
  ability: number;
  /** Spaced-repetition memory strength in days (higher = slower forgetting). */
  stability: number;
  /** Epoch ms of the last practice opportunity on this skill, or null if never practiced. */
  lastPracticedAt: number | null;
  attemptCount: number;
  correctCount: number;
}

export interface PracticeAssignment {
  skillId: string;
  reason: "due_for_review" | "below_mastery_threshold" | "never_practiced";
  /** Target difficulty for the next item, expressed on the same Elo-style scale as ability. */
  targetDifficulty: number;
  priority: number;
}

export const DEFAULT_BKT_PARAMS: BktParams = {
  pInit: 0.3,
  pTransit: 0.2,
  pSlip: 0.1,
  pGuess: 0.25,
};

export const DEFAULT_ABILITY = 1500;
export const MASTERY_THRESHOLD = 0.85;
