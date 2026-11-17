import type { CompanionEvent } from "../companion-logic";
import type { ExpressionName } from "./expressions";

/* Choreographed reactions (spec §4, §6). A beat is data: faces over time, a few
   body moves, and particles. Every move is a closed curve that starts and ends
   at zero, so a beat always hands him back at REST. */

export type MoveKind = "hop" | "land" | "spin" | "dash" | "shiver" | "nod" | "sway" | "pop" | "wag" | "peek";
export type Move = { at: number; ms: number; kind: MoveKind; amount: number };
export type ParticleKind = "spark" | "heart" | "zzz";
export type Fx = { at: number; kind: ParticleKind; count: number };
export type GazeMode = "snap" | "look" | "drift";
export type GazeCue = { at: number; x: number; y: number; mode: GazeMode; ms: number };

export type BeatDef = {
  /** celebration 5 > hit/miss 4 > streak/stall 3 > touch 2 > idle vignette 1 */
  priority: number;
  ms: number;
  faces: { at: number; face: ExpressionName }[];
  moves?: Move[];
  fx?: Fx[];
  gaze?: GazeCue[];
};

/** Calm mode drops these (spec §12). What is left: faces, blinks, small nods. */
export const CALM_DROPS: readonly MoveKind[] = ["hop", "spin", "dash", "shiver", "land"];
export const CALM_PARTICLE_CAP = 4;

export const BEATS = {
  hello: { priority: 2, ms: 1500, faces: [{ at: 0, face: "Sunny" }, { at: 300, face: "Giggly" }, { at: 1100, face: "Sunny" }], moves: [{ at: 150, ms: 900, kind: "sway", amount: 0.5 }, { at: 0, ms: 1400, kind: "wag", amount: 0.9 }], gaze: [{ at: 0, x: 0, y: 0, mode: "snap", ms: 1200 }] },
  hit: { priority: 4, ms: 800, faces: [{ at: 0, face: "Giggly" }, { at: 520, face: "Sunny" }], moves: [{ at: 0, ms: 380, kind: "hop", amount: 0.11 }, { at: 380, ms: 340, kind: "land", amount: 0.12 }, { at: 0, ms: 760, kind: "wag", amount: 0.8 }], fx: [{ at: 120, kind: "spark", count: 3 }] },
  hitFast: { priority: 4, ms: 1000, faces: [{ at: 0, face: "Wow" }, { at: 300, face: "Proud" }, { at: 820, face: "Sunny" }], moves: [{ at: 0, ms: 620, kind: "dash", amount: 0.22 }, { at: 620, ms: 320, kind: "land", amount: 0.1 }, { at: 0, ms: 950, kind: "wag", amount: 1 }], fx: [{ at: 200, kind: "spark", count: 5 }] },
  miss: { priority: 4, ms: 1200, faces: [{ at: 0, face: "Oopsie" }, { at: 520, face: "Curious" }], moves: [{ at: 80, ms: 420, kind: "nod", amount: 0.3 }, { at: 560, ms: 600, kind: "peek", amount: 0.4 }] },
  blindspot: { priority: 4, ms: 1200, faces: [{ at: 0, face: "Curious" }], moves: [{ at: 0, ms: 1100, kind: "peek", amount: 0.6 }, { at: 200, ms: 500, kind: "nod", amount: 0.2 }] },
  cardGood: { priority: 4, ms: 700, faces: [{ at: 0, face: "Sunny" }], moves: [{ at: 0, ms: 300, kind: "hop", amount: 0.06 }, { at: 300, ms: 300, kind: "land", amount: 0.07 }, { at: 0, ms: 650, kind: "wag", amount: 0.6 }], fx: [{ at: 100, kind: "spark", count: 2 }] },
  cardMiss: { priority: 4, ms: 900, faces: [{ at: 0, face: "Hmm" }, { at: 600, face: "Sunny" }], moves: [{ at: 100, ms: 600, kind: "nod", amount: 0.25 }] },
  celebrate: { priority: 5, ms: 2500, faces: [{ at: 0, face: "Wow" }, { at: 350, face: "Giggly" }, { at: 1700, face: "Proud" }], moves: [{ at: 0, ms: 420, kind: "hop", amount: 0.13 }, { at: 420, ms: 300, kind: "land", amount: 0.13 }, { at: 700, ms: 700, kind: "spin", amount: 1 }, { at: 1400, ms: 420, kind: "hop", amount: 0.16 }, { at: 1820, ms: 420, kind: "land", amount: 0.16 }, { at: 0, ms: 2400, kind: "wag", amount: 1 }], fx: [{ at: 60, kind: "spark", count: 10 }, { at: 1450, kind: "spark", count: 8 }] },
  stall1: { priority: 3, ms: 2000, faces: [{ at: 0, face: "Thinking" }, { at: 1500, face: "Sunny" }], moves: [{ at: 400, ms: 1400, kind: "peek", amount: 0.5 }], gaze: [{ at: 300, x: -0.5, y: 0.2, mode: "drift", ms: 1300 }] },
  stall2: { priority: 3, ms: 2200, faces: [{ at: 0, face: "Curious" }, { at: 1700, face: "Sunny" }], moves: [{ at: 300, ms: 1600, kind: "peek", amount: 0.7 }, { at: 700, ms: 500, kind: "nod", amount: 0.25 }], gaze: [{ at: 200, x: -0.6, y: 0.5, mode: "look", ms: 1600 }] },
  hint: { priority: 3, ms: 600, faces: [{ at: 0, face: "Curious" }], moves: [{ at: 60, ms: 460, kind: "nod", amount: 0.3 }] },
  streak3: { priority: 3, ms: 1100, faces: [{ at: 0, face: "Sunny" }, { at: 200, face: "Giggly" }, { at: 850, face: "Sunny" }], moves: [{ at: 0, ms: 1050, kind: "wag", amount: 1 }, { at: 100, ms: 700, kind: "sway", amount: 0.35 }] },
  streak5: { priority: 3, ms: 1400, faces: [{ at: 0, face: "Proud" }, { at: 1100, face: "Sunny" }], moves: [{ at: 0, ms: 1300, kind: "wag", amount: 1 }, { at: 0, ms: 380, kind: "pop", amount: 0.25 }], fx: [{ at: 150, kind: "spark", count: 4 }] },
  streak10: { priority: 3, ms: 2000, faces: [{ at: 0, face: "Wow" }, { at: 420, face: "Brave" }, { at: 1650, face: "Proud" }], moves: [{ at: 0, ms: 440, kind: "hop", amount: 0.2 }, { at: 440, ms: 480, kind: "land", amount: 0.2 }, { at: 0, ms: 1900, kind: "wag", amount: 1 }], fx: [{ at: 440, kind: "spark", count: 10 }] },
  bound: { priority: 4, ms: 1500, faces: [{ at: 0, face: "Wow" }, { at: 420, face: "Giggly" }, { at: 1150, face: "Sunny" }], moves: [{ at: 0, ms: 460, kind: "dash", amount: 0.18 }, { at: 460, ms: 340, kind: "land", amount: 0.12 }, { at: 620, ms: 760, kind: "sway", amount: 0.45 }, { at: 0, ms: 1450, kind: "wag", amount: 1 }], gaze: [{ at: 0, x: 0, y: 0, mode: "snap", ms: 1300 }] },
  poke: { priority: 2, ms: 800, faces: [{ at: 0, face: "Wow" }, { at: 260, face: "Giggly" }, { at: 640, face: "Sunny" }], moves: [{ at: 0, ms: 420, kind: "land", amount: 0.13 }, { at: 0, ms: 300, kind: "pop", amount: 0.2 }] },
  petted: { priority: 2, ms: 900, faces: [{ at: 0, face: "HeartEyes" }, { at: 700, face: "Sunny" }], moves: [{ at: 0, ms: 850, kind: "sway", amount: 0.4 }, { at: 0, ms: 850, kind: "wag", amount: 0.9 }] },
  tickle: { priority: 2, ms: 1600, faces: [{ at: 0, face: "Giggly" }, { at: 1350, face: "Sunny" }], moves: [{ at: 0, ms: 280, kind: "shiver", amount: 1 }, { at: 200, ms: 1300, kind: "sway", amount: 0.7 }, { at: 0, ms: 1500, kind: "wag", amount: 1 }] },
  wake: { priority: 2, ms: 800, faces: [{ at: 0, face: "Wow" }, { at: 520, face: "Sunny" }], moves: [{ at: 0, ms: 360, kind: "pop", amount: 0.3 }, { at: 0, ms: 420, kind: "land", amount: 0.08 }] },
  land: { priority: 2, ms: 460, faces: [{ at: 0, face: "Sunny" }], moves: [{ at: 0, ms: 440, kind: "land", amount: 0.12 }] },
  support: { priority: 2, ms: 1200, faces: [{ at: 0, face: "Sunny" }, { at: 200, face: "Winky" }, { at: 900, face: "Sunny" }], moves: [{ at: 100, ms: 600, kind: "nod", amount: 0.25 }] },
  nod: { priority: 1, ms: 700, faces: [{ at: 0, face: "Sunny" }], moves: [{ at: 60, ms: 560, kind: "nod", amount: 0.3 }] },
  lean: { priority: 1, ms: 5400, faces: [{ at: 0, face: "Curious" }, { at: 4800, face: "Sunny" }], moves: [{ at: 0, ms: 5300, kind: "peek", amount: 0.8 }, { at: 1800, ms: 600, kind: "nod", amount: 0.15 }] },
  /* idle vignettes (spec §7) */
  tailChase: { priority: 1, ms: 2400, faces: [{ at: 0, face: "Curious" }, { at: 1500, face: "Giggly" }, { at: 2100, face: "Sunny" }], moves: [{ at: 300, ms: 1800, kind: "wag", amount: 1 }], gaze: [{ at: 0, x: -0.9, y: 0.7, mode: "look", ms: 1700 }] },
  stretch: { priority: 1, ms: 2200, faces: [{ at: 0, face: "Sleepy" }, { at: 900, face: "Wow" }, { at: 1500, face: "Cozy" }, { at: 2000, face: "Sunny" }], moves: [{ at: 700, ms: 900, kind: "pop", amount: -0.3 }, { at: 600, ms: 1200, kind: "sway", amount: 0.3 }] },
  sniff: { priority: 1, ms: 1800, faces: [{ at: 0, face: "Curious" }, { at: 1400, face: "Sunny" }], moves: [{ at: 100, ms: 1500, kind: "peek", amount: 0.7 }, { at: 400, ms: 300, kind: "nod", amount: 0.15 }, { at: 800, ms: 300, kind: "nod", amount: 0.15 }], gaze: [{ at: 0, x: -0.3, y: 0.8, mode: "look", ms: 1400 }] },
  sitWag: { priority: 1, ms: 2000, faces: [{ at: 0, face: "Cozy" }, { at: 1700, face: "Sunny" }], moves: [{ at: 0, ms: 1900, kind: "wag", amount: 0.9 }] },
  doubleTake: { priority: 1, ms: 1300, faces: [{ at: 0, face: "Sunny" }, { at: 560, face: "Wow" }, { at: 1050, face: "Sunny" }], moves: [{ at: 560, ms: 300, kind: "pop", amount: 0.2 }], gaze: [{ at: 0, x: 0.7, y: -0.1, mode: "look", ms: 380 }, { at: 380, x: 0, y: 0, mode: "look", ms: 180 }, { at: 560, x: 0.8, y: -0.1, mode: "snap", ms: 600 }] }
} as const satisfies Record<string, BeatDef>;

export type BeatName = keyof typeof BEATS;
export const VIGNETTES: readonly BeatName[] = ["tailChase", "stretch", "sniff", "sitWag", "doubleTake"];

/** The reaction for each committed event. `stall` picks its level from the payload. */
export const EVENT_BEAT: Record<Exclude<CompanionEvent, "stall">, BeatName> = {
  correct: "hit", correctFast: "hitFast", wrong: "miss", blindspot: "blindspot", cardGood: "cardGood", cardMiss: "cardMiss",
  setDone: "celebrate", missionComplete: "celebrate", hintOpened: "hint", sessionReturn: "bound"
};
export const STREAK_BEAT: Partial<Record<number, BeatName>> = { 3: "streak3", 5: "streak5", 10: "streak10" };
