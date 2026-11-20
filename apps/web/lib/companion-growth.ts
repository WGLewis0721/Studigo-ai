import { OUTFITS, type CompanionEvent, type Outfit } from "./companion-logic";

/* Studigo grows as the learner works (LC-DEC-033 to 035). Points come from study events the
   app has already committed, plus a room return. Growth never goes down. It unlocks cosmetic
   outfits, idle tricks, a livelier flame and new stages. Presentation only: scoring and the
   learning record never read it, and this module touches neither. The caller keeps the Growth
   on the device. */

/** The one table to tune growth. Every event the app can send is listed. */
export const GROWTH_POINTS: Record<CompanionEvent, number> = {
  correct: 1,
  correctFast: 1,
  cardGood: 1,
  blindspot: 1,
  hintOpened: 0,
  wrong: 1,
  cardMiss: 1,
  setDone: 5,
  missionComplete: 8,
  stall: 0,
  sessionReturn: 2
};

/** Child-facing task counts assume about two points per study action. */
export const POINTS_PER_TASK = 2;

/** Far above any real use, so a corrupt save cannot overflow the display. */
export const GROWTH_MAX = 100_000;

export type Growth = { v: 1; points: number; seen: string[] };
export const EMPTY_GROWTH: Growth = { v: 1, points: 0, seen: [] };

export type FlameStage = "warm" | "bright" | "blazing";
export type UnlockKind = "outfit" | "trick" | "flame";
export type Unlock = { id: string; at: number; kind: UnlockKind; value: string };

export const STARTER_TRICKS: readonly string[] = ["tailChase", "sitWag"];

/* What growth unlocks, in the order it arrives; `at` is the points needed. The gaps never
   shrink, so something new comes often at first and less often later. */
export const UNLOCKS: readonly Unlock[] = [
  { id: "flame:warm", at: 0, kind: "flame", value: "warm" },
  { id: "outfit:goggles", at: 5, kind: "outfit", value: "goggles" },
  { id: "trick:sniff", at: 15, kind: "trick", value: "sniff" },
  { id: "outfit:explorer", at: 30, kind: "outfit", value: "explorer" },
  { id: "trick:doubleTake", at: 55, kind: "trick", value: "doubleTake" },
  { id: "outfit:visor", at: 90, kind: "outfit", value: "visor" },
  { id: "outfit:reader", at: 135, kind: "outfit", value: "reader" },
  { id: "flame:bright", at: 195, kind: "flame", value: "bright" },
  { id: "trick:stretch", at: 275, kind: "trick", value: "stretch" },
  { id: "outfit:beret", at: 385, kind: "outfit", value: "beret" },
  { id: "outfit:sash", at: 530, kind: "outfit", value: "sash" },
  { id: "outfit:headphones", at: 715, kind: "outfit", value: "headphones" },
  { id: "flame:blazing", at: 945, kind: "flame", value: "blazing" }
];

const UNLOCK_IDS: ReadonlySet<string> = new Set(UNLOCKS.map((item) => item.id));

function unlockAt(id: string): number {
  const unlock = UNLOCKS.find((item) => item.id === id);
  if (!unlock) throw new Error(`Growth stage starts on an unknown unlock: ${id}`);
  return unlock.at;
}

/* Each stage starts on an unlock, so a stage-up always arrives with something new. */
export const GROWTH_STAGES: readonly { name: string; at: number }[] = [
  { name: "Hatchling", at: unlockAt("flame:warm") },
  { name: "Sprout", at: unlockAt("trick:sniff") },
  { name: "Explorer", at: unlockAt("trick:doubleTake") },
  { name: "Scholar", at: unlockAt("outfit:reader") },
  { name: "Adventurer", at: unlockAt("trick:stretch") },
  { name: "Champion", at: unlockAt("outfit:sash") },
  { name: "Legend", at: unlockAt("flame:blazing") }
];

export function stage(points: number): number {
  return GROWTH_STAGES.reduce((index, item, i) => (points >= item.at ? i : index), 0);
}

/** Returns the same object when the event earns nothing or growth is already at its maximum. */
export function addGrowth(growth: Growth, event: CompanionEvent): Growth {
  const points = Math.min(GROWTH_MAX, growth.points + (GROWTH_POINTS[event] ?? 0));
  return points === growth.points ? growth : { ...growth, points };
}

/** Ids of the unlocks these points have reached, in unlock order. */
export function unlocked(points: number): string[] {
  return UNLOCKS.filter((item) => item.at <= points).map((item) => item.id);
}

/** Starter tricks are always unlocked. */
export function isUnlocked(points: number, id: string): boolean {
  return STARTER_TRICKS.some((trick) => id === `trick:${trick}`) || unlocked(points).includes(id);
}

/** The next unlock, its distance in points and in child-facing tasks. Null once everything is unlocked. */
export function nextUnlock(points: number): { unlock: Unlock; remainingPoints: number; remainingTasks: number } | null {
  const unlock = UNLOCKS.find((item) => item.at > points);
  if (!unlock) return null;
  const remainingPoints = unlock.at - points;
  return { unlock, remainingPoints, remainingTasks: Math.ceil(remainingPoints / POINTS_PER_TASK) };
}

/** Reached unlocks the learner has not been shown yet. Starting items are never new: they are there from the first visit. */
export function newlyUnlocked(growth: Growth): string[] {
  return UNLOCKS.filter((item) => item.at > 0 && item.at <= growth.points && !growth.seen.includes(item.id)).map((item) => item.id);
}

export function markSeen(growth: Growth, ids: readonly string[]): Growth {
  const fresh = Array.from(new Set(ids)).filter((id) => UNLOCK_IDS.has(id) && !growth.seen.includes(id));
  return fresh.length === 0 ? growth : { ...growth, seen: [...growth.seen, ...fresh] };
}

export function availableOutfits(points: number): Outfit[] {
  return OUTFITS.filter((outfit) => isUnlocked(points, `outfit:${outfit}`));
}

/** The starter tricks, then the earned ones in unlock order. */
export function availableTricks(points: number): string[] {
  return [...STARTER_TRICKS, ...UNLOCKS.filter((item) => item.kind === "trick" && item.at <= points).map((item) => item.value)];
}

export function flameStage(points: number): FlameStage {
  return UNLOCKS.reduce<FlameStage>((flame, item) => (item.kind === "flame" && item.at <= points ? (item.value as FlameStage) : flame), "warm");
}

function cleanPoints(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(GROWTH_MAX, Math.floor(value)) : 0;
}

/**
 * Reads a saved Growth, leniently. Anything missing or malformed reads as empty. A save from
 * another version keeps its valid points but forgets what was seen, so nothing is lost.
 */
export function parseGrowth(raw: string | null | undefined): Growth {
  if (!raw) return EMPTY_GROWTH;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Growth, unknown>> | null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_GROWTH;
    const points = cleanPoints(value.points);
    if (value.v !== 1) return { v: 1, points, seen: [] };
    const saved: unknown[] = Array.isArray(value.seen) ? value.seen : [];
    const seen = Array.from(new Set(saved.filter((id): id is string => typeof id === "string" && UNLOCK_IDS.has(id))));
    return { v: 1, points, seen };
  } catch {
    return EMPTY_GROWTH;
  }
}
