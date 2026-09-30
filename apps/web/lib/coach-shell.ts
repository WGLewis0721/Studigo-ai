import { useCallback, useSyncExternalStore } from "react";

export const COACH_SHELLS = [
  { id: "blueberry", name: "Blueberry" },
  { id: "tangerine", name: "Tangerine" },
  { id: "grape", name: "Grape" },
  { id: "berry", name: "Berry" },
  { id: "kiwi", name: "Kiwi" },
  { id: "dandelion", name: "Dandelion" },
  { id: "teal", name: "Teal" },
  { id: "indigo", name: "Indigo" }
] as const;

export type CoachShell = (typeof COACH_SHELLS)[number]["id"];

const DEFAULT_SHELL: CoachShell = "blueberry";
const listeners = new Set<() => void>();

const storageKey = (roomId: string) => `studigo.coachShell.${roomId}`;

function isShell(value: unknown): value is CoachShell {
  return COACH_SHELLS.some((item) => item.id === value);
}

function read(roomId: string): CoachShell {
  try {
    const saved = window.localStorage.getItem(storageKey(roomId));
    return isShell(saved) ? saved : DEFAULT_SHELL;
  } catch {
    return DEFAULT_SHELL;
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

/**
 * The Coach shell color is cosmetic and saved per room in this browser only.
 * Room Settings writes it, the Coach device reads it, and both stay in sync.
 */
export function useCoachShell(roomId: string): [CoachShell, (next: CoachShell) => void] {
  const shell = useSyncExternalStore(
    subscribe,
    () => read(roomId),
    () => DEFAULT_SHELL
  );
  const setShell = useCallback(
    (next: CoachShell) => {
      try {
        window.localStorage.setItem(storageKey(roomId), next);
      } catch {
        /* storage can be blocked; the color just will not persist */
      }
      listeners.forEach((notify) => notify());
    },
    [roomId]
  );
  return [shell, setShell];
}
