/**
 * Names for learner state. Do not use them as synonyms.
 * This module does not change director decisions.
 *
 * CanonicalEvidenceName is the vocabulary in ADAPTIVE_LEARNING_CORE.
 * session.ts EvidenceStage is the current projection label
 * (not_checked | practicing | independent | transfer). Those are not the same type.
 */
export const EVIDENCE_STAGES = [
  "unseen",
  "introduced",
  "assisted",
  "independent",
  "transfer",
  "retained"
] as const;

export type CanonicalEvidenceName = (typeof EVIDENCE_STAGES)[number];

/** Observed behavior. Not a probability and not a product ranking. */
export const EVIDENCE_STAGE = "evidence stage";

/** Deterministic product priority. Not a probability. */
export const READINESS_INDEX = "readiness index";

/** A statistical estimate. Valid only after calibration. Not an evidence stage. */
export const MASTERY_PROBABILITY = "mastery probability";
