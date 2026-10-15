/** How much of the idea an answer must cover. 50 is cold, 100 is hot. */
export type AccuracyGauge = number;

const KEY = (roomId: string) => `studigo-accuracy:${roomId}`;

export function clampGauge(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(50, Math.round(value)));
}

/** 50% at cold, 100% at hot. */
export function requiredCoverage(gauge: number): number {
  return clampGauge(gauge) / 100;
}

/**
 * Cold accepts a partial idea and leaves the rest for Coach to fill in.
 * Hot rejects anything under the mark and asks for the whole answer.
 * Wording never has to match.
 */
export function gaugeOutcome(score: number, gauge: number): "correct" | "partial" | "incorrect" {
  const required = requiredCoverage(gauge);
  if (score >= required && score >= 0.9) return "correct";
  if (score >= required) return "partial";
  if (required >= 0.9) return "incorrect";
  if (score >= required - 0.2) return "partial";
  return "incorrect";
}

export function gaugeLabel(gauge: number): string {
  const percent = clampGauge(gauge);
  const name = percent < 70 ? "Cold" : percent < 90 ? "Warm" : "Hot";
  return `${name} · ${percent}%`;
}

export function readGauge(roomId: string): number {
  if (typeof window === "undefined") return 50;
  try {
    const value = window.localStorage.getItem(KEY(roomId));
    if (value === "low") return 50;
    if (value === "high") return 95;
    if (value == null) return 50;
    return clampGauge(Number(value));
  } catch {
    return 50;
  }
}

export function writeGauge(roomId: string, gauge: number) {
  window.localStorage.setItem(KEY(roomId), String(clampGauge(gauge)));
}
