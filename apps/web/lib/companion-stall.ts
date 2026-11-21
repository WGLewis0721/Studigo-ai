/**
 * Guided Learn's idle timer for a question the learner must answer: the `stall`
 * event in design/living-companion/SHARED_COMPANION_EVENTS.md. Presentation only.
 * It keeps no positions, answers or keys, and it never grades or saves anything.
 * The clock is injected, so every decision is deterministic.
 */

/** A placeholder inside the approved 20 to 45 second range, until the LC-0b measurements set it. */
export const STALL_LEVEL1_MS = 30_000;
export const STALL_LEVEL2_MS = 2 * STALL_LEVEL1_MS;

export type StallLevel = 1 | 2;

export type StallTimerOptions = {
  now: () => number;
  onStall: (level: StallLevel) => void;
  level1Ms?: number;
  level2Ms?: number;
};

export type StallTimer = {
  /** A beat the learner must act on is showing. Opening the beat that is already showing changes nothing. */
  open(beatKey: string): void;
  /** Learner input on the open beat restarts the idle clock. */
  activity(): void;
  /** The beat was answered or left, is busy, or the mission ended. Nothing fires until the next open. */
  close(): void;
  /** Call on a steady interval. Each level fires once, when the idle time reaches its threshold. */
  tick(): void;
};

export function createStallTimer({ now, onStall, level1Ms = STALL_LEVEL1_MS, level2Ms = 2 * level1Ms }: StallTimerOptions): StallTimer {
  const thresholds: Record<StallLevel, number> = { 1: level1Ms, 2: level2Ms };
  const fired: Record<StallLevel, boolean> = { 1: false, 2: false };
  let beatKey: string | null = null;
  let lastActivity = 0;

  return {
    open(key) {
      if (key === beatKey) return;
      beatKey = key;
      lastActivity = now();
      fired[1] = false;
      fired[2] = false;
    },
    activity() {
      if (beatKey !== null) lastActivity = now();
    },
    close() {
      beatKey = null;
    },
    tick() {
      const key = beatKey;
      if (key === null) return;
      for (const level of [1, 2] as const) {
        // A callback may close or replace the beat, so every level is checked against the beat it started on.
        if (beatKey !== key || fired[level] || now() - lastActivity < thresholds[level]) continue;
        fired[level] = true;
        onStall(level);
      }
    }
  };
}
