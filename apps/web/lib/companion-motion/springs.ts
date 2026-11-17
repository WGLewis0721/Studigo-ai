/* Named springs from STUDIGO_EXPRESSIVENESS_SPEC.md §11. Values not taken from
   Coucou are starting guesses, tuned against the rig. Pure numbers, no DOM. */

export type SpringSpec = { k: number; c: number };
export type Spring = { x: number; v: number };

const MOUTH_W = (2 * Math.PI) / 0.25;

export const SPRINGS = {
  GAZE_SNAP: { k: 300, c: 24 },
  GAZE_DRIFT: { k: 40, c: 9 },
  GAZE_LOOK: { k: 120, c: 16 },
  /** The head trails the eyes, and the body trails the head. */
  HEAD_FOLLOW: { k: 70, c: 13 },
  BODY_FOLLOW: { k: 34, c: 9 },
  SOFT_PART: { k: 60, c: 9 },
  MOUTH: { k: MOUTH_W * MOUTH_W, c: 2 * 0.6 * MOUTH_W }
} as const satisfies Record<string, SpringSpec>;

/** The director integrates at a fixed rate, so 30, 60 and 120 Hz displays see the same motion. */
export const STEP_S = 1 / 120;

export const spring = (x = 0): Spring => ({ x, v: 0 });

/** One semi-implicit Euler step toward `target`. Stable for every spring above at STEP_S. */
export function stepSpring(s: Spring, target: number, spec: SpringSpec, dt: number = STEP_S): void {
  s.v += (spec.k * (target - s.x) - spec.c * s.v) * dt;
  s.x += s.v * dt;
}
