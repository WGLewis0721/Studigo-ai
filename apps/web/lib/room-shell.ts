/**
 * Every Study Room is shown in one "shell" color, the way one product came in
 * several named colors. The color is cosmetic and derived from the room id,
 * so it is stable across sessions, list order and devices without a schema
 * change. It never encodes state; status always has its own text.
 */
export const ROOM_SHELLS = ["blueberry", "tangerine", "grape", "kiwi", "berry", "teal", "graphite"] as const;

export type RoomShell = (typeof ROOM_SHELLS)[number];

export const ROOM_SHELL_NAMES: Record<RoomShell, string> = {
  blueberry: "Blueberry",
  tangerine: "Tangerine",
  grape: "Grape",
  kiwi: "Kiwi",
  berry: "Berry",
  teal: "Teal",
  graphite: "Graphite"
};

/** FNV-1a over the id: cheap, deterministic, and evenly spread for UUIDs. */
export function roomShellFor(roomId: string): RoomShell {
  let hash = 0x811c9dc5;
  for (let index = 0; index < roomId.length; index += 1) {
    hash ^= roomId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return ROOM_SHELLS[(hash >>> 0) % ROOM_SHELLS.length];
}
