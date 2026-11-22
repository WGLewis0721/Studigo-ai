/* Lip sync for the Rive character: turns a voice level into the rig's `talk` input (0 to 1).
   Pure: time comes in from the caller. */

export const TALK_RMS_FLOOR = 0.02;
export const TALK_RMS_CEILING = 0.25;
export const TALK_ATTACK_MS = 60;
export const TALK_RELEASE_MS = 120;
export const TALK_REDUCED_CAP = 0.4;

/** Roughly RMS 0.02 to 0.25 maps onto 0 to 1. Quieter than the floor is a closed mouth. */
export function talkFromRms(rms: number): number {
  if (!Number.isFinite(rms)) return 0;
  return Math.min(1, Math.max(0, (rms - TALK_RMS_FLOOR) / (TALK_RMS_CEILING - TALK_RMS_FLOOR)));
}

/** Opens fast and closes slower, so a syllable reads as a mouth and not a flutter. */
export function createTalkSmoother() {
  let value = 0;
  return {
    step(target: number, dtMs: number, reduced = false): number {
      const goal = Math.min(reduced ? TALK_REDUCED_CAP : 1, Math.max(0, target));
      const tau = goal > value ? TALK_ATTACK_MS : TALK_RELEASE_MS;
      const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
      value += (goal - value) * k;
      if (value < 0.005 && goal === 0) value = 0;
      return value;
    },
    reset() { value = 0; },
    get value() { return value; },
  };
}
