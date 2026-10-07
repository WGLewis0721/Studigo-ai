import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./tokens";

export const clampX = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const out3 = Easing.out(Easing.cubic);
export const inOut = Easing.inOut(Easing.cubic);
export const snap = Easing.bezier(0.2, 0.8, 0.2, 1);          // the app's --ease-out
export const boing = Easing.bezier(0.34, 1.4, 0.5, 1);        // the app's --ease-spring
/** 0→1 over [a,b] with an easing */
export const P = (f: number, a: number, b: number, e: (t: number) => number = snap) => interpolate(f, [a, b], [0, 1], { ...clampX, easing: e });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Damped oscillation that starts at 1 and rings out: use for landing squash, impact wobble, settle. */
export const ring = (t: number, hz = 2.2, decay = 6) => (t < 0 ? 0 : Math.exp(-decay * t) * Math.cos(2 * Math.PI * hz * t));
/** Deterministic spring 0→1 (overshoots). */
export const sp = (f: number, delay = 0, damping = 11, stiffness = 140, mass = 0.8) =>
  spring({ frame: f - delay, fps: FPS, config: { damping, stiffness, mass } });
/** Volume-preserving squash/stretch from a stretch amount s (+ = taller). */
export const squash = (s: number) => ({ sy: 1 + s, sx: 1 / Math.pow(1 + s, 0.85) });
/** Spring follower (semi-implicit) over a target track. Gives overshoot + lag for secondary motion. Deterministic. */
export const follow = (target: (g: number) => number, f: number, k = 0.16, c = 0.24, window = 54) => {
  let g = Math.max(-20, f - window);
  let p = target(g), v = 0;
  for (g += 1; g <= f; g++) { const a = -k * (p - target(g)) - c * v; v += a; p += v; }
  return p;
};
