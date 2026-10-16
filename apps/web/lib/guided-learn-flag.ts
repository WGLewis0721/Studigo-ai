/**
 * Guided Learn rollout switch. Default off.
 *
 * Server: STUDIGO_GUIDED_LEARN=1
 * Client build: NEXT_PUBLIC_STUDIGO_GUIDED_LEARN=1
 *
 * Both must be the exact string "1". Either one alone stays off.
 * This module does not choose a Learn surface and does not grant source,
 * grading, or mastery authority. See docs/VERCEL_DEPLOYMENT.md.
 */
export const GUIDED_LEARN_SERVER_FLAG = "STUDIGO_GUIDED_LEARN";
export const GUIDED_LEARN_CLIENT_FLAG = "NEXT_PUBLIC_STUDIGO_GUIDED_LEARN";

export function guidedLearnSwitchOn(value: string | undefined): boolean {
  return value === "1";
}

export function guidedLearnEnabled(serverValue: string | undefined, clientValue: string | undefined): boolean {
  return guidedLearnSwitchOn(serverValue) && guidedLearnSwitchOn(clientValue);
}

/** A server-passed true cannot light the client unless the public build flag is also on. */
export function guidedLearnSurfaceEnabled(serverEnabled: boolean, clientValue: string | undefined): boolean {
  return serverEnabled === true && guidedLearnSwitchOn(clientValue);
}
