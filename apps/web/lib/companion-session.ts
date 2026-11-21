/* When Studigo last saw the learner on this device, so a return after a long gap can be greeted (LC-DEC-042).
   Storage is optional: blocked or unreadable storage reads as "never seen", so nothing is greeted. */

/** A break this long makes the next visit a return. A shorter one is the same sitting. */
export const RETURN_AFTER_MS = 30 * 60_000;
export const LAST_SEEN_KEY = "studigo.companion.lastSeen";

/** Whether this visit follows a gap long enough to greet. A first visit (nothing saved yet) is never a return. */
export function isReturn(lastSeenMs: number | null, nowMs: number): boolean {
  return lastSeenMs !== null && nowMs - lastSeenMs >= RETURN_AFTER_MS;
}

export function readLastSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw !== null && /^\d{1,15}$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function writeLastSeen(nowMs: number): void {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(nowMs));
  } catch {
    /* storage is optional */
  }
}
