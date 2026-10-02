import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, parsePrefs, type CompanionPrefs } from "./companion-logic";

const listeners = new Set<() => void>();
const storageKey = (roomId: string) => `studigo.companion.${roomId}`;
/** His size is a choice about the screen in front of you, so it is saved once for the device. */
const SCALE_KEY = "studigo.companion.scale";
const SEPARATOR = "|scale=";

/** The room's saved choices and the device's saved size, as one string (a stable snapshot for React). */
function readRaw(roomId: string): string {
  try {
    return `${window.localStorage.getItem(storageKey(roomId)) ?? ""}${SEPARATOR}${window.localStorage.getItem(SCALE_KEY) ?? ""}`;
  } catch {
    return SEPARATOR;
  }
}

function parseRaw(raw: string): CompanionPrefs {
  const at = raw.lastIndexOf(SEPARATOR);
  return at < 0 ? parsePrefs(raw) : parsePrefs(raw.slice(0, at), raw.slice(at + SEPARATOR.length));
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function readCompanionPrefs(roomId: string): CompanionPrefs {
  return parseRaw(readRaw(roomId));
}

export function writeCompanionPrefs(roomId: string, patch: Partial<CompanionPrefs>) {
  const { scale, ...room } = { ...readCompanionPrefs(roomId), ...patch };
  try {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(room));
    if (patch.scale !== undefined) window.localStorage.setItem(SCALE_KEY, String(scale));
  } catch {
    /* storage can be blocked; the choice just will not persist */
  }
  listeners.forEach((notify) => notify());
}

/**
 * How Studigo behaves in one Study Room: speech, whether he was sent to his
 * seat, and his corner. Like the room's color it is saved per room in this
 * browser only; his size is saved once for the device. Room Settings and his
 * own card write it; his window reads it.
 */
export function useCompanionPrefs(roomId: string): [CompanionPrefs, (patch: Partial<CompanionPrefs>) => void] {
  // The snapshot is the saved string, so it is stable between renders.
  const raw = useSyncExternalStore(subscribe, () => readRaw(roomId), () => SEPARATOR);
  const prefs = useMemo(() => (raw === SEPARATOR ? DEFAULT_PREFS : parseRaw(raw)), [raw]);
  const update = useCallback((patch: Partial<CompanionPrefs>) => writeCompanionPrefs(roomId, patch), [roomId]);
  return [prefs, update];
}
