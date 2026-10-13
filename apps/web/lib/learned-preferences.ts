import { COACH_MODES, isExplainLevel, migrateCoachMode, type CoachMode, type ExplainLevel } from "@studigo/learning";
import { isLearnMode, type LearnMode } from "./learn-preferences";

export type LearnedPreferenceId = "explanation-level" | "coach-mode" | "learn-mode";

export type LearnedPreference = {
  id: LearnedPreferenceId;
  title: string;
  sentence: string;
  applies: string;
  origin: string;
};

export type StoredStudyPreferences = {
  coach: unknown;
  learn: unknown;
  explainLevel: unknown;
};

/**
 * A mode with no sentence here is the standard one, or one this file does not
 * know. Either way nothing is said about it: a default is not something the
 * learner chose, and an unknown value is not worth a guess.
 */
const COACH_SENTENCES: Partial<Record<CoachMode, string>> = {
  show: "Coach explains it first, shows an example, then lets you try.",
  challenge: "Coach starts with less help and asks you to use what you know."
};

const LEARN_SENTENCES: Partial<Record<LearnMode, string>> = {
  overview: "Learn starts with the main idea, then the key facts.",
  examples_first: "Learn starts with an example from your materials when there is one, then explains the idea."
};

const LEVEL_SENTENCES: Partial<Record<ExplainLevel, string>> = {
  simpler: "Explanations use plain words, short sentences and everyday examples.",
  deeper: "Explanations use the subject's own terms and go further into how ideas connect."
};

/** Only the learner writes these settings; nothing records a value Studigo worked out on its own. */
const CHOSEN_BY_YOU = "You chose this.";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function storedCoachMode(value: unknown): CoachMode | null {
  const raw = record(value);
  if (!raw) return null;
  if (raw.coach_mode === undefined) return migrateCoachMode(raw);
  return COACH_MODES.includes(raw.coach_mode as CoachMode) ? (raw.coach_mode as CoachMode) : null;
}

/** What is stored for this room, in plain sentences. Defaults and unreadable values produce nothing. */
export function describeStoredPreferences(stored: StoredStudyPreferences): LearnedPreference[] {
  const items: LearnedPreference[] = [];

  const level = isExplainLevel(stored.explainLevel) ? LEVEL_SENTENCES[stored.explainLevel] : undefined;
  if (level) {
    items.push({
      id: "explanation-level",
      title: "Explanation level",
      sentence: level,
      applies: "Used by Coach and Learn in this room.",
      origin: CHOSEN_BY_YOU
    });
  }

  const coachMode = storedCoachMode(stored.coach);
  const coach = coachMode ? COACH_SENTENCES[coachMode] : undefined;
  if (coach) {
    items.push({
      id: "coach-mode",
      title: "Coach mode",
      sentence: coach,
      applies: "Used by Coach in this room.",
      origin: CHOSEN_BY_YOU
    });
  }

  const learnMode = record(stored.learn)?.mode;
  const learn = isLearnMode(learnMode) ? LEARN_SENTENCES[learnMode] : undefined;
  if (learn) {
    items.push({
      id: "learn-mode",
      title: "Learn mode",
      sentence: learn,
      applies: "Used by Learn in this room.",
      origin: CHOSEN_BY_YOU
    });
  }

  return items;
}
