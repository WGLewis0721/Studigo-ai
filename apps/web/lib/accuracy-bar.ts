/** How much of the guide an answer must cover before Coach calls it correct. */
export type AccuracySetting = "low" | "high";

const KEY = (roomId: string) => `studigo-accuracy:${roomId}`;

/** Low is half the expected points. High is the middle of 80–95%. */
export function requiredCoverage(setting: AccuracySetting | null, firstPass: boolean): number {
  if (setting === "high") return 0.9;
  if (setting === "low" || firstPass) return 0.5;
  return 0.85;
}

/** Coverage only. The words do not have to match the guide. */
export function passesCoverage(score: number, required: number): boolean {
  return score >= required;
}

export function readAccuracySetting(roomId: string): AccuracySetting | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(KEY(roomId));
    return value === "low" || value === "high" ? value : null;
  } catch {
    return null;
  }
}

export function writeAccuracySetting(roomId: string, setting: AccuracySetting) {
  window.localStorage.setItem(KEY(roomId), setting);
}
