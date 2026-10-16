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


/**
 * Private Guided Learn inspection, explicitly requested by the learner.
 *
 * The URL parameter alone is not an entitlement: it requires a server-side
 * room allowlist as well as the authenticated room owner check performed by
 * the signed-in room page and mission API. Missing env fails closed.
 * No global rollout and no synthetic fixture exposure.
 */
export function guidedLearnCanaryEnabledForRoom(
  roomId: string,
  optIn: string | undefined,
  roomIds: string | undefined
): boolean {
  return optIn === "1" && phase3UiEnabledForRoom(roomId, roomIds, false);
}
