import {
  expireStudigoReaction, requestStudigoReaction, resolveStudigoIntent,
  STUDIGO_INITIAL_BEHAVIOR, STUDIGO_INTENT, studigoDirection,
  type StudigoBehavior, type StudigoGaze, type StudigoReaction, type StudigoState,
} from "@/lib/studigo-behaviors";

export type StudigoControlFrame = { mode: 0 | 2; intent: number };
type Listener = (frame: StudigoControlFrame) => void;

export function createStudigoController() {
  let behavior: StudigoBehavior = STUDIGO_INITIAL_BEHAVIOR;
  let reducedMotion = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<Listener>();
  const frame = (): StudigoControlFrame => ({
    mode: reducedMotion ? 2 : 0,
    intent: STUDIGO_INTENT[resolveStudigoIntent(behavior)],
  });
  let last = frame();

  function send() {
    const next = frame();
    if (next.mode === last.mode && next.intent === last.intent) return;
    last = next;
    for (const receive of listeners) receive(next);
  }

  function update(next: StudigoBehavior) {
    if (next === behavior) return;
    const expiryChanged = next.reaction !== behavior.reaction;
    behavior = next;
    if (expiryChanged) {
      clearTimeout(deadline);
      const expiry = next.reaction?.expiresAt;
      deadline = expiry === undefined ? undefined : setTimeout(
        () => update(expireStudigoReaction(behavior, performance.now())),
        Math.ceil(Math.max(0, expiry - performance.now())) + 1,
      );
    }
    send();
  }

  return {
    setState(state: StudigoState) { update({ ...behavior, state }); },
    react(name: StudigoReaction) { update(requestStudigoReaction(behavior, name, performance.now())); },
    lookAt(gaze: StudigoGaze) {
      const direction = studigoDirection(gaze);
      if (direction !== behavior.direction) update({ ...behavior, direction });
    },
    returnToIdle() { update(STUDIGO_INITIAL_BEHAVIOR); },
    setReducedMotion(reduced: boolean) { reducedMotion = reduced; send(); },
    subscribe(receive: Listener) {
      listeners.add(receive);
      receive(frame());
      return () => { listeners.delete(receive); };
    },
    dispose() { clearTimeout(deadline); listeners.clear(); },
  };
}

export type StudigoController = ReturnType<typeof createStudigoController>;
