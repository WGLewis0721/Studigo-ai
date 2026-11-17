/**
 * The Studigo companion's decisions, with no DOM in them: where he looks, which
 * corner he takes, how he reacts to an event, and what the learner has switched
 * on. The window engine (components/companion/engine.ts) and the full-body
 * stage draw from these; the iOS app can reuse them unchanged.
 *
 * He never changes mastery. Nothing here, or in the engine, talks to the
 * network or to practice state: he only reacts to what already happened.
 */

export type Dock = "br" | "bl" | "tr" | "tl";
export type Rect = { left: number; top: number; right: number; bottom: number };
/** Where his window may sit. `inRow` means its bottom edge lines up with the message field. */
export type Area = Rect & { inRow: boolean };

/** His window at its default size, in CSS pixels. */
export const WINDOW = { w: 116, h: 138 } as const;
export type Size = { w: number; h: number };

/** The learner can make his window smaller or larger: a drag handle on desktop, a pinch on a phone. */
export const MIN_SCALE = 0.75;
export const MAX_SCALE = 2;
export function clampScale(value: unknown): number {
  const scale = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.round(Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) * 100) / 100;
}
export function sizeAt(scale: number): Size {
  return { w: WINDOW.w * scale, h: WINDOW.h * scale };
}

export type GazePose = "center" | "left" | "right" | "up" | "down" | "up-right" | "up-left" | "down-right" | "down-left";
export type WindowPose = GazePose | "celebrate" | "support" | "pet" | "poke" | "lean" | "sleep";
export type StagePose = GazePose | "wave" | "leap" | "celebrate" | "read";

export const WINDOW_POSES: readonly WindowPose[] = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "celebrate", "support", "pet", "poke", "lean", "sleep"];
export const STAGE_POSES: readonly StagePose[] = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "wave", "leap", "celebrate", "read"];
/** The left-facing diagonals are the right-facing art, flipped. */
export const MIRRORED: Partial<Record<GazePose, GazePose>> = { "up-left": "up-right", "down-left": "down-right" };

const BY_OCTANT: Record<string, GazePose> = { "0": "right", "1": "down-right", "2": "down", "3": "down-left", "4": "left", "-4": "left", "-3": "up-left", "-2": "up", "-1": "up-right" };

/** Which way he looks, given a point relative to his eyes. Close points read as "at you". */
export function dirPose(dx: number, dy: number, dead = 54): GazePose {
  if (Math.hypot(dx, dy) < dead) return "center";
  return BY_OCTANT[String(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)))] ?? "center";
}

/** Beside the field he is reading, he peers down into it rather than straight across. */
export function readingPose(dx: number, dy: number): GazePose {
  const pose = dirPose(dx, dy);
  return pose === "left" ? "down-left" : pose === "right" ? "down-right" : pose === "center" ? "down" : pose;
}

export function spot(dock: Dock, area: Rect, size: Size = WINDOW): { x: number; y: number } {
  return { x: dock[1] === "r" ? area.right - size.w : area.left, y: dock[0] === "b" ? area.bottom - size.h : area.top };
}

function overlap(x: number, y: number, rect: Rect, size: Size) {
  return Math.max(0, Math.min(x + size.w, rect.right) - Math.max(x, rect.left)) * Math.max(0, Math.min(y + size.h, rect.bottom) - Math.max(y, rect.top));
}

/** More than this share of his window over a control counts as sitting on it. */
const COVERED_SHARE = 0.075;

/** True when more than a sliver of his window, with its top-left at `at`, sits over one of these controls. */
export function coversControl(at: { x: number; y: number }, controls: Rect[], size: Size = WINDOW): boolean {
  const limit = size.w * size.h * COVERED_SHARE;
  return controls.some((rect) => overlap(at.x, at.y, rect, size) > limit);
}

/**
 * He never sits on a control the learner needs. If his corner covers one and
 * the page cannot scroll it clear, he takes the nearest free corner: the other
 * side first, then the top. With nowhere free he stays where the learner put him.
 */
export function chooseDock(preferred: Dock, area: Area, controls: Rect[], canScrollClear: boolean, size: Size = WINDOW): Dock {
  if (area.inRow || canScrollClear) return preferred;
  const blocked = (dock: Dock) => coversControl(spot(dock, area, size), controls, size);
  const side = preferred[1], otherSide = side === "r" ? "l" : "r";
  const row = preferred[0], otherRow = row === "b" ? "t" : "b";
  const order = [preferred, `${row}${otherSide}`, `${otherRow}${side}`, `${otherRow}${otherSide}`] as Dock[];
  return order.find((dock) => !blocked(dock)) ?? preferred;
}

/**
 * Phase 3 non-chat rooms keep every visible control clear even on scrollable
 * pages. Null means there is no safe window position: use the existing header
 * seat for now, without changing the learner's saved dock or seated preference.
 * Chat keeps its reserved composer geometry through the existing dock policy.
 */
export function controlSafeDock(preferred: Dock, area: Area, controls: Rect[], size: Size = WINDOW): Dock | null {
  if (area.inRow) return preferred;
  if (area.right - area.left < size.w || area.bottom - area.top < size.h) return null;
  const side = preferred[1], otherSide = side === "r" ? "l" : "r";
  const row = preferred[0], otherRow = row === "b" ? "t" : "b";
  const order = [preferred, `${row}${otherSide}`, `${otherRow}${side}`, `${otherRow}${otherSide}`] as Dock[];
  return order.find((dock) => {
    const at = spot(dock, area, size);
    return controls.every((rect) => overlap(at.x, at.y, {
      left: rect.left - 8, right: rect.right + 8, top: rect.top - 8, bottom: rect.bottom + 8
    }, size) === 0);
  }) ?? null;
}

/** The corner nearest to where the learner let go of him. */
export function dockFromDrop(centerX: number, centerY: number, area: Rect): Dock {
  return `${centerY > (area.top + area.bottom) / 2 ? "b" : "t"}${centerX > (area.left + area.right) / 2 ? "r" : "l"}` as Dock;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The top-left point of his window as a share of the room he has to slide:
 * 0 at the left or top edge, 1 at the right or bottom. No room to slide reads as the middle.
 */
export function posFromPoint(x: number, y: number, area: Rect, size: Size = WINDOW): { x: number; y: number } {
  const freeX = area.right - area.left - size.w, freeY = area.bottom - area.top - size.h;
  return {
    x: freeX > 0 ? clamp01((x - area.left) / freeX) : 0.5,
    y: freeY > 0 ? clamp01((y - area.top) / freeY) : 0.5
  };
}

/** The inverse of posFromPoint. The window stays inside the area, even when the area has shrunk since the position was saved. */
export function pointFromPos(pos: { x: number; y: number }, area: Rect, size: Size = WINDOW): { x: number; y: number } {
  const freeX = Math.max(0, area.right - area.left - size.w), freeY = Math.max(0, area.bottom - area.top - size.h);
  return { x: area.left + clamp01(pos.x) * freeX, y: area.top + clamp01(pos.y) * freeY };
}

/** The corner nearest to where his window sits in the area. */
export function dockForPos(pos: { x: number; y: number }, area: Rect, size: Size = WINDOW): Dock {
  const at = pointFromPos(pos, area, size);
  return dockFromDrop(at.x + size.w / 2, at.y + size.h / 2, area);
}

/** Moves a saved position by a few pixels (arrow keys), clamped to the free room. */
export function nudgePos(pos: { x: number; y: number }, dxPx: number, dyPx: number, area: Rect, size: Size = WINDOW): { x: number; y: number } {
  const at = pointFromPos(pos, area, size);
  return posFromPoint(at.x + dxPx, at.y + dyPx, area, size);
}

/** How much the page has to move aside for him, per dock. All in CSS pixels. */
export function roomFor(dock: Dock, area: Area, rowHeight: number, size: Size = WINDOW): { right: number; left: number; thread: number; page: number } {
  const bottom = dock[0] === "b", right = dock[1] === "r";
  const row = area.inRow && bottom;
  return {
    right: row && right ? size.w + 8 : 0,
    left: row && !right ? size.w + 8 : 0,
    thread: row ? Math.max(0, size.h - rowHeight) + 8 : 0,
    page: !area.inRow && bottom ? size.h - 16 : 0
  };
}

/**
 * The size that puts the corner opposite his dock under the pointer: the dock
 * corner stays put and the window grows or shrinks away from it.
 */
export function scaleFromDrag(anchorX: number, anchorY: number, pointerX: number, pointerY: number): number {
  return clampScale(Math.max(Math.abs(pointerX - anchorX) / WINDOW.w, Math.abs(pointerY - anchorY) / WINDOW.h));
}

/* ---------- what the room tells him ---------- */

/** Events the room can send. The first six exist on main. The rest are the LC v1 additions from SHARED_COMPANION_EVENTS.md (LC-7 wires their reactions; until then they use placeholder reactions below). */
export type CompanionEvent = "correct" | "wrong" | "blindspot" | "setDone" | "cardGood" | "cardMiss" | "correctFast" | "stall" | "hintOpened" | "missionComplete" | "sessionReturn";
export const COMPANION_EVENTS: readonly CompanionEvent[] = ["correct", "wrong", "blindspot", "setDone", "cardGood", "cardMiss", "correctFast", "stall", "hintOpened", "missionComplete", "sessionReturn"];

/** Short, rare, and only when the learner has switched speech on. No em dashes (PLAIN_PUNCTUATION_RULE). */
export const LINES = {
  wrong: ["That's okay. Try the next one.", "Close. We'll get it.", "Good try. Keep going."],
  blindspot: ["Worth a second look."],
  correct: ["Yes!", "Nice."],
  streak: ["Three in a row!"],
  setDone: ["Set done. Nice work."],
  lean: ["Ready when you are.", "Take your time."],
  wake: ["I'm up."],
  tickle: ["Hey, that tickles."]
} as const;

export type Reaction = { pose: WindowPose; ms: number; sparks: number; lines?: readonly string[]; always?: boolean };

/** How he reacts to something that already happened. `streak` counts right answers in a row, this one included. */
export function reactionFor(event: CompanionEvent, streak: number): Reaction {
  switch (event) {
    case "correct": return streak === 3
      ? { pose: "celebrate", ms: 2300, sparks: 10, lines: LINES.streak, always: true }
      : { pose: "celebrate", ms: 2300, sparks: 10, lines: LINES.correct };
    case "wrong": return { pose: "support", ms: 2800, sparks: 0, lines: LINES.wrong, always: true };
    case "blindspot": return { pose: "support", ms: 2800, sparks: 0, lines: LINES.blindspot, always: true };
    case "setDone": return { pose: "celebrate", ms: 3000, sparks: 16, lines: LINES.setDone, always: true };
    case "cardGood": return { pose: "celebrate", ms: 1300, sparks: 5 };
    case "cardMiss": return { pose: "support", ms: 1500, sparks: 0 };
    // Placeholders for LC v1 events. LC-7 replaces these with the reactions in SHARED_COMPANION_EVENTS.md.
    case "correctFast": return { pose: "celebrate", ms: 1000, sparks: 6 };
    case "stall": return { pose: "lean", ms: 2000, sparks: 0, lines: LINES.lean };
    case "hintOpened": return { pose: "center", ms: 600, sparks: 0 };
    case "missionComplete": return { pose: "celebrate", ms: 2500, sparks: 16, lines: LINES.setDone, always: true };
    case "sessionReturn": return { pose: "center", ms: 1500, sparks: 0 };
  }
}

/** Waiting on the learner: he leans after a long pause and dozes after a much longer one. */
export const LEAN_AFTER_MS = 60_000;
export const SLEEP_AFTER_MS = 180_000;
export function idleStage(idleMs: number): "awake" | "lean" | "sleep" {
  return idleMs > SLEEP_AFTER_MS ? "sleep" : idleMs > LEAN_AFTER_MS ? "lean" : "awake";
}

/* ---------- what the learner has switched on ---------- */

/** Cosmetic outfits he can wear. A saved id that is not in this list reads back as no outfit. */
export const OUTFITS = ["goggles", "explorer", "visor", "reader", "beret", "headphones", "sash"] as const;
export type Outfit = typeof OUTFITS[number];
/** The names in the menu. Plain text: no dashes, nothing a child would need explained. */
export const OUTFIT_LABELS: Record<Outfit, string> = {
  goggles: "Science goggles", explorer: "Explorer hat", visor: "Math visor", reader: "Reading glasses",
  beret: "Art beret", headphones: "Music headphones", sash: "Civics sash"
};

/** Where he is out: his floating window, or the fixed strip under the room menu. */
export type CompanionHost = "float" | "strip";

export type CompanionPrefs = {
  /** Format version, written as 2 on every save. Older builds ignore the new fields and still read the rest. */
  v: 2;
  /** Speech bubbles. Off unless the learner turns them on in Room Settings. */
  speech: boolean;
  /** True when the learner sent him back to his seat; he stays there until called. */
  seated: boolean;
  /** He turns see-through while the page scrolls, so nothing under him is hidden. */
  tuck: boolean;
  dock: Dock;
  /** Where the learner moved him, as shares of his free room (see posFromPoint). Null means he sits in his dock corner. */
  pos: { x: number; y: number } | null;
  /** Floating window or the strip. A value that is neither reads as float. */
  host: CompanionHost;
  /** A cosmetic outfit from OUTFITS, or null for none. */
  outfit: Outfit | null;
  /** The learner's in-app Calm mode (reduced motion). Off unless they turn it on. */
  calm: boolean;
  /** 1 is his default size. Saved for the device, not per room. */
  scale: number;
};

export const DEFAULT_PREFS: CompanionPrefs = { v: 2, speech: false, seated: false, tuck: true, dock: "br", pos: null, host: "float", outfit: null, calm: false, scale: 1 };
const DOCKS: readonly string[] = ["br", "bl", "tr", "tl"];

function parsePos(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clamp01(x), y: clamp01(y) };
}

export function parseOutfit(value: unknown): Outfit | null {
  return OUTFITS.find((outfit) => outfit === value) ?? null;
}

/**
 * Reads saved preferences. Anything missing or malformed falls back to the default,
 * so speech can only be on if it was saved on. A save from before v2 has none of the
 * newer fields, so they read as their defaults.
 */
export function parsePrefs(raw: string | null | undefined, savedScale?: string | null): CompanionPrefs {
  const scale = savedScale ? clampScale(savedScale) : DEFAULT_PREFS.scale;
  const base = scale === DEFAULT_PREFS.scale ? DEFAULT_PREFS : { ...DEFAULT_PREFS, scale };
  if (!raw) return base;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof CompanionPrefs, unknown>> | null;
    if (!value || typeof value !== "object") return base;
    return {
      v: 2,
      speech: value.speech === true,
      seated: value.seated === true,
      tuck: value.tuck !== false,
      dock: typeof value.dock === "string" && DOCKS.includes(value.dock) ? (value.dock as Dock) : DEFAULT_PREFS.dock,
      pos: parsePos(value.pos),
      host: value.host === "strip" ? "strip" : "float",
      outfit: parseOutfit(value.outfit),
      calm: value.calm === true,
      scale
    };
  } catch {
    return base;
  }
}
