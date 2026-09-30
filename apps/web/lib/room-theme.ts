import { useCallback, useSyncExternalStore } from "react";
import { roomShellFor } from "./room-shell";

export const ROOM_THEMES = [
  { id: "blueberry", name: "Blueberry" },
  { id: "tangerine", name: "Tangerine" },
  { id: "grape", name: "Grape" },
  { id: "berry", name: "Berry" },
  { id: "kiwi", name: "Kiwi" },
  { id: "dandelion", name: "Dandelion" },
  { id: "teal", name: "Teal" },
  { id: "indigo", name: "Indigo" },
  { id: "graphite", name: "Graphite" }
] as const;

export type RoomTheme = (typeof ROOM_THEMES)[number]["id"];

const listeners = new Set<() => void>();

const storageKey = (roomId: string) => `studigo.coachShell.${roomId}`;

function isTheme(value: unknown): value is RoomTheme {
  return ROOM_THEMES.some((item) => item.id === value);
}

/** Until a color is picked, a room wears the color its card already has. */
function defaultTheme(roomId: string): RoomTheme {
  return roomShellFor(roomId);
}

function read(roomId: string): RoomTheme {
  try {
    const saved = window.localStorage.getItem(storageKey(roomId));
    return isTheme(saved) ? saved : defaultTheme(roomId);
  } catch {
    return defaultTheme(roomId);
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
 * A room's color is cosmetic and saved per room in this browser only. Room
 * Settings writes it; the room, its Coach and its cards read it and stay in
 * sync. It never encodes state, and the study modes keep their own colors.
 */
export function useRoomTheme(roomId: string): [RoomTheme, (next: RoomTheme) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => read(roomId),
    () => defaultTheme(roomId)
  );
  const setTheme = useCallback(
    (next: RoomTheme) => {
      try {
        window.localStorage.setItem(storageKey(roomId), next);
      } catch {
        /* storage can be blocked; the color just will not persist */
      }
      listeners.forEach((notify) => notify());
    },
    [roomId]
  );
  return [theme, setTheme];
}
