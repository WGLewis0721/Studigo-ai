/**
 * Phase 3 visual rollout gate for an authenticated Study Room.
 * An unset per-room allowlist retains the established global default.
 * A defined empty allowlist switches OFF Phase 3 for every real room.
 * This controls presentation only; it never grants source or grading authority.
 */
export function phase3UiEnabledForRoom(roomId: string, roomIds: string | undefined, globalEnabled: boolean): boolean {
  if (roomIds === undefined) return globalEnabled;
  if (!roomId) return false;
  return roomIds.split(",").some((candidate) => candidate.trim() === roomId);
}
