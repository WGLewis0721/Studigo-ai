import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, parsePrefs, type CompanionPrefs } from "./companion-logic";

const listeners = new Set<() => void>();
const storageKey = (roomId: string) => `studigo.companion.${roomId}`;

function readRaw(roomId: string): string {
  try {
    return window.localStorage.getItem(storageKey(roomId)) ?? "";
  } catch {
    return "";
  }
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
  return parsePrefs(readRaw(roomId));
}

export function writeCompanionPrefs(roomId: string, patch: Partial<CompanionPrefs>) {
  const next = { ...readCompanionPrefs(roomId), ...patch };
  try {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(next));
  } catch {
    /* storage can be blocked; the choice just will not persist */
  }
  listeners.forEach((notify) => notify());
}

/**
 * How Studigo behaves in one Study Room: speech, whether he was sent to his
 * seat, and his corner. Like the room's color it is saved per room in this
 * browser only. Room Settings and his own card write it; his window reads it.
 */
export function useCompanionPrefs(roomId: string): [CompanionPrefs, (patch: Partial<CompanionPrefs>) => void] {
  // The snapshot is the saved string, so it is stable between renders.
  const raw = useSyncExternalStore(subscribe, () => readRaw(roomId), () => "");
  const prefs = useMemo(() => (raw ? parsePrefs(raw) : DEFAULT_PREFS), [raw]);
  const update = useCallback((patch: Partial<CompanionPrefs>) => writeCompanionPrefs(roomId, patch), [roomId]);
  return [prefs, update];
}
