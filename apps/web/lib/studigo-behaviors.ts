import type { CompanionEvent } from "./companion-logic";

export const STUDIGO_INTENT = {
  idle: 0, left: 1, right: 2, up: 3, down: 4,
  listening: 5, thinking: 6, reading: 7, happy: 8, celebrating: 9,
  encouraging: 10, correct: 11, incorrect: 12, curious: 13, sleepy: 14,
  wake: 15, petting: 16,
} as const;

export type StudigoIntent = keyof typeof STUDIGO_INTENT;
export type StudigoState = "idle" | "listening" | "thinking" | "reading" | "sleepy";
export type StudigoDirection = "left" | "right" | "up" | "down";
export type StudigoReaction = Exclude<StudigoIntent, StudigoState | StudigoDirection>;
export type StudigoGaze = { x: number; y: number };

export const STUDIGO_REACTIONS = {
  happy: { priority: 2, durationMs: 900 },
  celebrating: { priority: 5, durationMs: 1200 },
  encouraging: { priority: 2, durationMs: 1150 },
  correct: { priority: 3, durationMs: 800 },
  incorrect: { priority: 3, durationMs: 1200 },
  curious: { priority: 1, durationMs: 1000 },
  wake: { priority: 2, durationMs: 900 },
  petting: { priority: 4, durationMs: 1450 },
} as const satisfies Record<StudigoReaction, { priority: number; durationMs: number }>;

export const STUDIGO_EVENT_REACTION = {
  correct: "correct", wrong: "incorrect", blindspot: "curious",
  setDone: "celebrating", cardGood: "correct", cardMiss: "incorrect",
  correctFast: "correct", stall: "encouraging", hintOpened: "curious",
  missionComplete: "celebrating", sessionReturn: "wake",
} as const satisfies Record<CompanionEvent, StudigoReaction>;

export type StudigoBehavior = {
  state: StudigoState;
  direction: StudigoDirection | null;
  reaction: { name: StudigoReaction; expiresAt: number } | null;
};

export const STUDIGO_INITIAL_BEHAVIOR: StudigoBehavior = {
  state: "idle", direction: null, reaction: null,
};

export function expireStudigoReaction(behavior: StudigoBehavior, now: number): StudigoBehavior {
  return behavior.reaction && now >= behavior.reaction.expiresAt
    ? { ...behavior, reaction: null }
    : behavior;
}

export function requestStudigoReaction(
  behavior: StudigoBehavior, name: StudigoReaction, now: number,
): StudigoBehavior {
  const current = expireStudigoReaction(behavior, now);
  const next = STUDIGO_REACTIONS[name];
  if (current.reaction && STUDIGO_REACTIONS[current.reaction.name].priority > next.priority) return current;
  return {
    ...current,
    state: current.state === "sleepy" && (name === "wake" || name === "petting") ? "idle" : current.state,
    reaction: { name, expiresAt: now + next.durationMs },
  };
}

export function studigoDirection({ x, y }: StudigoGaze): StudigoDirection | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.max(Math.abs(x), Math.abs(y)) < 0.18) return null;
  return Math.abs(x) >= Math.abs(y) ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");
}

export function resolveStudigoIntent(behavior: StudigoBehavior): StudigoIntent {
  return behavior.reaction?.name ?? (behavior.state === "idle" ? behavior.direction ?? "idle" : behavior.state);
}
