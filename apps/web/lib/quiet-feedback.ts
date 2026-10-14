/**
 * One brief confirmation for a real lesson-open or guide-ready transition.
 * The same success, rendered again or restored after reload, is not confirmed
 * twice. Failure and loading never look like success. Reduced motion and a
 * minimized companion stay static. Nothing here waits, rewards mastery, or praises.
 */

export type QuietPhase = "success" | "error" | "loading";
export type QuietEventKind = "lesson-open" | "guide-ready";
export type QuietAcknowledgement = "none" | "static" | "once";

export type QuietFeedbackInput = {
  phase: QuietPhase;
  kind: QuietEventKind;
  /** Stable identity of this success. The same key after a rerender or reload is the same event. */
  eventKey: string | null;
  /** Keys already acknowledged, including ones restored from storage. */
  acknowledged: readonly string[];
  reducedMotion: boolean;
  /** Companion is minimized (in his seat, not his window). */
  minimized: boolean;
};

export type QuietFeedbackDecision = {
  acknowledgement: QuietAcknowledgement;
  /** Short status. Never praise. Null when there is nothing new to say. */
  status: string | null;
  /** True only for the single animated acknowledgement. */
  animate: boolean;
  acknowledged: readonly string[];
};

const STATUS: Record<QuietEventKind, string> = {
  "lesson-open": "Lesson open",
  "guide-ready": "Guide ready"
};

export const QUIET_ACK_KEY = "studigo.quiet-feedback";
export const QUIET_FEEDBACK_EVENT = "studigo:quiet-feedback";

export type QuietStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} | null;

export type QuietFeedbackDetail = {
  phase: QuietPhase;
  kind: QuietEventKind;
  eventKey: string | null;
  acknowledged: readonly string[];
  decision: QuietFeedbackDecision | null;
};

export function quietFeedback(input: QuietFeedbackInput): QuietFeedbackDecision {
  const acknowledged = input.acknowledged;
  const eventKey = input.eventKey?.trim() || null;
  if (input.phase !== "success" || !eventKey || acknowledged.includes(eventKey)) {
    return { acknowledgement: "none", status: null, animate: false, acknowledged };
  }
  const next = acknowledged.concat(eventKey);
  if (input.reducedMotion || input.minimized) {
    return { acknowledgement: "static", status: STATUS[input.kind], animate: false, acknowledged: next };
  }
  return { acknowledgement: "once", status: STATUS[input.kind], animate: true, acknowledged: next };
}

export function loadAcknowledged(storage: QuietStorage): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUIET_ACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function saveAcknowledged(storage: QuietStorage, keys: readonly string[]) {
  if (!storage) return;
  try {
    storage.setItem(QUIET_ACK_KEY, JSON.stringify(keys));
  } catch {
    /* Storage is optional. A missing write only risks one extra confirmation. */
  }
}

export function browserQuietStorage(): QuietStorage {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion() {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Asks the live companion, when one is on the page, and otherwise decides locally.
 * Returns immediately. Callers must not wait on motion before showing the lesson or enabling controls.
 */
export function requestQuietAcknowledgement(input: {
  phase: QuietPhase;
  kind: QuietEventKind;
  eventKey: string | null;
  storage?: QuietStorage;
  /** Used only when no companion handles the event. */
  reducedMotion?: boolean;
  minimized?: boolean;
}): QuietFeedbackDecision {
  const storage = input.storage === undefined ? browserQuietStorage() : input.storage;
  const acknowledged = loadAcknowledged(storage);
  const detail: QuietFeedbackDetail = {
    phase: input.phase,
    kind: input.kind,
    eventKey: input.eventKey,
    acknowledged,
    decision: null
  };
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent(QUIET_FEEDBACK_EVENT, { detail }));
  }
  const decision = detail.decision ?? quietFeedback({
    phase: input.phase,
    kind: input.kind,
    eventKey: input.eventKey,
    acknowledged,
    reducedMotion: input.reducedMotion ?? prefersReducedMotion(),
    minimized: input.minimized ?? true
  });
  if (decision.acknowledged.length !== acknowledged.length) saveAcknowledged(storage, decision.acknowledged);
  return decision;
}
