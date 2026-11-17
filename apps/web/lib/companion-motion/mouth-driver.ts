/* Turns "something is speaking" into a mouth-open value from 0 to 1, whatever the voice engine is.
   Time always comes in from the caller's clock. No globals, no DOM, no network. */

/** Where a mouth's openness comes from. A voice engine plugs in by picking one kind. */
export type MouthDriver =
  | { kind: "amplitude"; sample(): number }
  | { kind: "visemes"; track: { tMs: number; viseme: string }[] }
  | { kind: "boundary"; onWord(cb: () => void): () => void };

/** Openness from 0 to 1 for common viseme names. Any other name opens to 0.3. */
export const VISEME_OPEN: Record<string, number> = {
  sil: 0, PP: 0, FF: 0.15, TH: 0.25, DD: 0.3, kk: 0.35, CH: 0.3, SS: 0.2,
  nn: 0.25, RR: 0.35, aa: 1, E: 0.6, I: 0.45, O: 0.8, U: 0.5,
};

const UNKNOWN_OPEN = 0.3;
const LINE_TAIL_MS = 250;
const PULSE_PEAK = 0.8;
const PULSE_RISE_MS = 60;
const PULSE_END_MS = 180;

type Cue = { tMs: number; open: number };

export type Mouth = {
  attach(driver: MouthDriver | null, startMs: number): void;
  sample(nowMs: number): number;
  setMuted(on: boolean): void;
  detach(): void;
  active(): boolean;
};

/** Turns the attached driver into a mouth target from 0 to 1. Time only enters through the arguments. */
export function createMouth(options: { muted?: boolean } = {}): Mouth {
  let driver: MouthDriver | null = null;
  let muted = options.muted ?? false;
  let lineStartMs = 0;
  let lastNowMs = 0;
  let cues: Cue[] = [];
  let pulseStartMs: number | null = null;
  let unsubscribe: (() => void) | null = null;

  function detach(): void {
    unsubscribe?.();
    unsubscribe = null;
    driver = null;
    cues = [];
    pulseStartMs = null;
  }

  function attach(next: MouthDriver | null, startMs: number): void {
    detach();
    if (!next) return;
    driver = next;
    lineStartMs = startMs;
    lastNowMs = startMs;
    if (next.kind === "visemes") {
      cues = next.track.map((cue) => ({ tMs: cue.tMs, open: visemeOpen(cue.viseme) })).sort((a, b) => a.tMs - b.tMs);
    }
    if (next.kind === "boundary") {
      // A word carries no clock, so it starts a pulse at the latest sample time.
      let live = true;
      const off = next.onWord(() => { if (live) pulseStartMs = lastNowMs; });
      // A source that keeps calling back after unsubscribe must not pulse the driver that replaced it.
      unsubscribe = () => { live = false; off(); };
    }
  }

  function sample(nowMs: number): number {
    if (!Number.isFinite(nowMs)) return 0;
    lastNowMs = nowMs;
    const current = driver;
    if (!current || muted) return 0;
    if (current.kind === "amplitude") return readLevel(current);
    if (current.kind === "visemes") return visemeTarget(cues, nowMs - lineStartMs);
    return pulseStartMs === null ? 0 : pulseAt(nowMs - pulseStartMs);
  }

  return {
    attach,
    sample,
    setMuted(on: boolean) { muted = on; },
    detach,
    active: () => driver !== null,
  };
}

function visemeOpen(viseme: string): number {
  return Object.hasOwn(VISEME_OPEN, viseme) ? VISEME_OPEN[viseme] : UNKNOWN_OPEN;
}

function readLevel(source: { sample(): number }): number {
  let level: number;
  try {
    level = source.sample();
  } catch {
    return 0;
  }
  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
}

function visemeTarget(cues: Cue[], elapsedMs: number): number {
  const last = cues[cues.length - 1];
  if (!last || elapsedMs - last.tMs >= LINE_TAIL_MS) return 0;
  let open = 0;
  for (const cue of cues) {
    if (cue.tMs > elapsedMs) break;
    open = cue.open;
  }
  return open;
}

function pulseAt(ageMs: number): number {
  if (Number.isNaN(ageMs) || ageMs <= 0 || ageMs >= PULSE_END_MS) return 0;
  if (ageMs < PULSE_RISE_MS) return (PULSE_PEAK * ageMs) / PULSE_RISE_MS;
  return (PULSE_PEAK * (PULSE_END_MS - ageMs)) / (PULSE_END_MS - PULSE_RISE_MS);
}
