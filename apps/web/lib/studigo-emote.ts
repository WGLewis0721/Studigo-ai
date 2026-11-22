/* Emote pop for the Rive character. The rig scales an emote from its centre (0 hidden, 1 full),
   so the app supplies the spring. Pure: time comes in from the caller. */

export const EMOTE_IN_MS = 120;
export const EMOTE_SETTLE_MS = 200;
export const EMOTE_OUT_MS = 140;
export const EMOTE_OVERSHOOT = 1.25;

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** 0 to 1.25 over 120 ms with an ease-out, then 1.25 to 1 over 200 ms, then it holds at 1. */
export function emoteIn(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < EMOTE_IN_MS) {
    const x = elapsedMs / EMOTE_IN_MS;
    return EMOTE_OVERSHOOT * (1 - (1 - x) ** 3);
  }
  const x = clamp((elapsedMs - EMOTE_IN_MS) / EMOTE_SETTLE_MS);
  const eased = x * x * (3 - 2 * x);
  return EMOTE_OVERSHOOT + (1 - EMOTE_OVERSHOOT) * eased;
}

/** From wherever it is down to 0 over 140 ms with an ease-in. */
export function emoteOut(from: number, elapsedMs: number): number {
  const x = clamp(elapsedMs / EMOTE_OUT_MS);
  return from * (1 - x * x * x);
}

export function emoteDone(direction: "in" | "out", elapsedMs: number): boolean {
  return direction === "in" ? elapsedMs >= EMOTE_IN_MS + EMOTE_SETTLE_MS : elapsedMs >= EMOTE_OUT_MS;
}
