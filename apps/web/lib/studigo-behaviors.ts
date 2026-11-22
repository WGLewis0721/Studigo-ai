import type { CompanionEvent } from "./companion-logic";

export const STUDIGO_INTENT = {
  idle: 0, left: 1, right: 2, up: 3, down: 4,
  listening: 5, thinking: 6, reading: 7, happy: 8, celebrating: 9,
  encouraging: 10, correct: 11, incorrect: 12, curious: 13, sleepy: 14,
  wake: 15, petting: 16, surprised: 17, proud: 18, annoyed: 19, excited: 20,
  tailChase: 21, sitWag: 22, sniff: 23, doubleTake: 24, stretch: 25,
  bellyPoke: 26, tailTug: 27,
} as const;

export type StudigoIntent = keyof typeof STUDIGO_INTENT;
export type StudigoState = "idle" | "listening" | "thinking" | "reading" | "sleepy";
export type StudigoDirection = "left" | "right" | "up" | "down";
export type StudigoReaction = Exclude<StudigoIntent, StudigoState | StudigoDirection>;
export type StudigoGaze = { x: number; y: number };
export const STUDIGO_EMOTES = ["spark", "heart", "thought"] as const;
export type StudigoEmote = (typeof STUDIGO_EMOTES)[number];
export const STUDIGO_TRICKS = ["tailChase", "sitWag", "sniff", "doubleTake", "stretch"] as const;
export type StudigoTrick = (typeof STUDIGO_TRICKS)[number];

export const STUDIGO_REACTIONS = {
  happy: { priority: 2, durationMs: 900 },
  celebrating: { priority: 5, durationMs: 1200 },
  encouraging: { priority: 2, durationMs: 1150 },
  correct: { priority: 3, durationMs: 800 },
  incorrect: { priority: 3, durationMs: 1200 },
  curious: { priority: 1, durationMs: 1000 },
  wake: { priority: 2, durationMs: 900 },
  petting: { priority: 4, durationMs: 1450 },
  surprised: { priority: 3, durationMs: 660 },
  proud: { priority: 4, durationMs: 1100 },
  annoyed: { priority: 2, durationMs: 700 },
  bellyPoke: { priority: 3, durationMs: 1600 },
  tailTug: { priority: 3, durationMs: 2200 },
  excited: { priority: 5, durationMs: 1220 },
  tailChase: { priority: 0, durationMs: 1700 },
  sitWag: { priority: 0, durationMs: 1920 },
  sniff: { priority: 0, durationMs: 1080 },
  doubleTake: { priority: 0, durationMs: 1280 },
  stretch: { priority: 0, durationMs: 1900 },
} as const satisfies Record<StudigoReaction, { priority: number; durationMs: number }>;

export const STUDIGO_EVENT_REACTION = {
  correct: "correct", wrong: "incorrect", blindspot: "curious",
  setDone: "proud", cardGood: "correct", cardMiss: "incorrect",
  correctFast: "correct", stall: "encouraging", hintOpened: "curious",
  missionComplete: "excited", sessionReturn: "wake",
} as const satisfies Record<CompanionEvent, StudigoReaction>;

export const STUDIGO_EXPRESSION_EMOTE: Partial<Record<StudigoIntent, StudigoEmote>> = {
  proud: "spark", celebrating: "spark", excited: "spark", petting: "heart", curious: "thought",
};

export type StudigoBehavior = {
  state: StudigoState;
  reaction: { name: StudigoReaction; expiresAt: number } | null;
};

export const STUDIGO_INITIAL_BEHAVIOR: StudigoBehavior = {
  state: "idle", reaction: null,
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

export function normalizeStudigoGaze({ x, y }: StudigoGaze): StudigoGaze {
  const clamp = (value: number) => Number.isFinite(value) ? Math.round(Math.max(-1, Math.min(1, value)) * 1000) / 1000 : 0;
  return { x: clamp(x), y: clamp(y) };
}

export function resolveStudigoIntent(behavior: StudigoBehavior): StudigoIntent {
  return behavior.reaction?.name ?? behavior.state;
}
