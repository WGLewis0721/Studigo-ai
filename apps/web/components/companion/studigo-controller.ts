import {
  expireStudigoReaction, requestStudigoReaction, resolveStudigoIntent,
  STUDIGO_INITIAL_BEHAVIOR, STUDIGO_INTENT, STUDIGO_EXPRESSION_EMOTE, normalizeStudigoGaze,
  type StudigoBehavior, type StudigoEmote, type StudigoGaze, type StudigoReaction, type StudigoState,
} from "@/lib/studigo-behaviors";
import type { Outfit } from "@/lib/companion-logic";
import { TALK_REDUCED_CAP } from "@/lib/studigo-talk";

export type StudigoControlFrame = { mode: 0 | 2; intent: number; gaze: StudigoGaze; outfit: Outfit | null; flameBoost: number; emote: StudigoEmote | null; talk: number; growth: number };
type Listener = (frame: StudigoControlFrame) => void;

export function createStudigoController() {
  let behavior: StudigoBehavior = STUDIGO_INITIAL_BEHAVIOR;
  let reducedMotion = false;
  const centered = { x: 0, y: 0 };
  let gaze = centered;
  let outfit: Outfit | null = null;
  let flameBoost = 1;
  let emote: StudigoEmote | null = null;
  let talk = 0;
  let growth = 1;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<Listener>();
  const frame = (): StudigoControlFrame => ({
    mode: reducedMotion ? 2 : 0,
    intent: STUDIGO_INTENT[resolveStudigoIntent(behavior)],
    gaze: reducedMotion ? centered : gaze,
    outfit,
    flameBoost,
    emote: emote ?? STUDIGO_EXPRESSION_EMOTE[resolveStudigoIntent(behavior)] ?? null,
    talk: reducedMotion ? Math.min(talk, TALK_REDUCED_CAP) : talk,
    growth,
  });
  let last = frame();

  function send() {
    const next = frame();
    if (next.mode === last.mode && next.intent === last.intent && next.gaze.x === last.gaze.x && next.gaze.y === last.gaze.y
      && next.outfit === last.outfit && next.flameBoost === last.flameBoost && next.emote === last.emote && next.talk === last.talk && next.growth === last.growth) return;
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
    lookAt(target: StudigoGaze) { gaze = normalizeStudigoGaze(target); send(); },
    setOutfit(next: Outfit | null) { outfit = next; send(); },
    setFlameBoost(next: number) { flameBoost = next; send(); },
    setEmote(next: StudigoEmote | null) { emote = next; send(); },
    /** The rig's `talk` input, 0 to 1: how far his mouth is open while he speaks. */
    /** The rig's `growth` input, 0 to 1 (1 is his approved size). The surface tweens changes. */
    setGrowth(value: number) { growth = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1; send(); },
    setTalk(level: number) { talk = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0; send(); },
    returnToIdle() { gaze = centered; update(STUDIGO_INITIAL_BEHAVIOR); send(); },
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
