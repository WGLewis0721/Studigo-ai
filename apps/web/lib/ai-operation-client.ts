/** Browser identity for one admitted AI gesture. Receipts key on this UUID. */

export const AI_OPERATION_HEADER = "x-studigo-operation-id";

export type Gesture = {
  id: string;
  inflight: boolean;
  /** 202 or 409: this id must not be replaced. A later click replays it. */
  sealed: boolean;
  fingerprint: string;
};

export function createOperationId(): string {
  return crypto.randomUUID();
}

/**
 * One start while a request is in flight. The same id is reused for a retry of the
 * same body. A sealed outcome (already completed, or possibly already run) is never
 * replaced, even if the body changes — minting a new id there would be a silent re-run.
 * A different body after an ordinary failure is a new gesture.
 */
export function beginGesture(
  current: Gesture | null,
  fingerprint: string,
  mint: () => string = createOperationId
): { gesture: Gesture; started: boolean } {
  if (current?.inflight) return { gesture: current, started: false };
  if (current?.sealed || (current && current.fingerprint === fingerprint)) {
    return { gesture: { ...current, inflight: true }, started: true };
  }
  return { gesture: { id: mint(), inflight: true, sealed: false, fingerprint }, started: true };
}

/** Drop the gesture only after a real success. 202 and 409 stay sealed. */
export function finishGesture(current: Gesture, status: number): Gesture | null {
  const idle = { ...current, inflight: false };
  if (status === 202 || status === 409) return { ...idle, sealed: true };
  if (status >= 200 && status < 300) return null;
  return idle;
}

export function abortGesture(current: Gesture): Gesture {
  return { ...current, inflight: false };
}

export function createGestureBook(mint: () => string = createOperationId) {
  const slots = new Map<string, Gesture>();
  return {
    begin(slot: string, fingerprint: string): { id: string; started: boolean } {
      const next = beginGesture(slots.get(slot) ?? null, fingerprint, mint);
      if (next.started) slots.set(slot, next.gesture);
      return { id: next.gesture.id, started: next.started };
    },
    finish(slot: string, status: number) {
      const current = slots.get(slot);
      if (!current) return;
      const ended = finishGesture(current, status);
      if (ended) slots.set(slot, ended);
      else slots.delete(slot);
    },
    abort(slot: string) {
      const current = slots.get(slot);
      if (!current) return;
      slots.set(slot, abortGesture(current));
    }
  };
}

export function operationHeaders(id: string, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(AI_OPERATION_HEADER, id);
  return headers;
}
