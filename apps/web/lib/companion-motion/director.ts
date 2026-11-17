import { dirPose, idleStage, type CompanionEvent, type GazePose, type WindowPose } from "../companion-logic";
import { SPARK_START, moodTier, nextSpark } from "../companion-mood";
import { BEATS, CALM_DROPS, CALM_PARTICLE_CAP, EVENT_BEAT, STREAK_BEAT, VIGNETTES, type BeatDef, type BeatName, type GazeMode, type Move, type ParticleKind } from "./beats";
import { EXPRESSIONS, REST, CHANNEL_KEYS, mix, type Channels, type ExpressionName } from "./expressions";
import { SPRINGS, STEP_S, spring, stepSpring, type SpringSpec } from "./springs";

/* Studigo's motion director: what he is doing this instant, as numbers.

   Pure and deterministic. It has no DOM, no React, no network and no clock of
   its own: the caller passes the time in, and randomness is injected. It reads
   committed learning events and never writes anything back.

   Layers (spec §12), later ones on top:
     L0 REST pose
     L1 base state (idle, thinking, held, petted, asleep)
     L2 mood: Spark scales how lively the idle is
     L3 one reaction beat at a time, queue of two
     L4 additive: breath, blink, gaze with eyes leading head leading body, soft parts
     L5 mouth, driven from outside */

export type BaseState = "idle" | "thinking" | "held" | "petted" | "asleep";
export type Cue = "lean" | "sleep" | "wake";

export type MotionFrame = {
  base: BaseState;
  expression: ExpressionName;
  beat: BeatName | null;
  /** The drawing he shows in place of the rig, or null for the rig. */
  pose: WindowPose | null;
  /** Pupils, -1..1 each way. They move first. */
  gazeX: number; gazeY: number;
  /** Head turn, -1..1. It follows the pupils; the body follows the head. */
  headYaw: number; headPitch: number; headTilt: number;
  bodyYaw: number; lean: number; lift: number;
  eyeOpenL: number; eyeOpenR: number; eyeSmile: number; brow: number;
  mouthCurve: number; mouthOpen: number; cheek: number;
  /** Each frill on its own soft spring, -1 back .. +1 up. */
  frillL: number; frillR: number;
  /** Tail swing, -1..1, and its tip, which lags the base. */
  tail: number; tailTip: number;
  flame: number;
  /** Vertical breathing scale around 0. */
  breath: number;
  /** Fractions of his height (hop is negative when he is in the air) and width. */
  hop: number; dash: number; shiver: number;
  /** Positive is squashed, negative stretched. */
  squash: number;
  /** Radians. A full spin is 2π. */
  spin: number;
  spark: number; tier: 0 | 1 | 2 | 3 | 4;
  /** Things that happened during this advance. Drained every call. */
  fx: { kind: ParticleKind; count: number }[];
  cues: Cue[];
};

export type DirectorOptions = {
  /** 0 <= value < 1. Inject a seeded source for tests. */
  random: () => number;
  reducedMotion?: boolean;
};

type Playing = { name: BeatName; def: BeatDef; start: number; fxDone: number; gazeDone: number };
type Fading = { def: BeatDef; start: number; cutAt: number; fadeFrom: number };
type Transient = { hop: number; squash: number; spin: number; dash: number; shiver: number; pitch: number; tilt: number; eyeOpen: number; wag: number; lean: number };

const FACE_FADE_MS = 160, FACE_FADE_CALM_MS = 300;
/** A cut beat lets go of the body over this long, so an interruption never pops. */
const CUT_FADE_MS = 150;
const MAX_FRAME_MS = 100;
const QUEUE_MAX = 2;
const VIGNETTE_AFTER_MS = 8000;
const VIGNETTE_COOLDOWN_MS = 4000;
/* A far gaze draws his head turn. It takes hold at 0.55 and lets go under 0.35, and a drawn look stays at least 250 ms, so a gaze near the line cannot flicker. */
const LOOK_IN = 0.4, LOOK_OUT = 0.26, LOOK_HOLD_MS = 250;
const smooth = (p: number) => { const c = Math.max(0, Math.min(1, p)); return c * c * (3 - 2 * c); };
const BASE_FACE: Record<BaseState, ExpressionName> = { idle: "Sunny", thinking: "Thinking", held: "Wow", petted: "Giggly", asleep: "Sleepy" };
const GAZE_SPRING: Record<GazeMode, SpringSpec> = { snap: SPRINGS.GAZE_SNAP, look: SPRINGS.GAZE_LOOK, drift: SPRINGS.GAZE_DRIFT };

/** The drawing a beat names at tau: its latest key at or before tau. Undefined while no key has come yet. */
function beatPose(def: BeatDef, tau: number): WindowPose | null | undefined {
  let found: { at: number; pose: WindowPose | null } | undefined;
  for (const key of def.poses ?? []) if (key.at <= tau && (!found || key.at >= found.at)) found = key;
  return found?.pose;
}

function moveInto(out: Transient, move: Move, tau: number, weight: number) {
  if (tau < 0 || tau >= move.ms) return;
  const p = tau / move.ms, a = move.amount * weight, bell = Math.sin(Math.PI * p);
  switch (move.kind) {
    case "hop": out.hop -= a * 4 * p * (1 - p); out.squash -= 0.5 * a * bell; break;
    case "land": out.squash += a * Math.exp(-5 * p) * Math.cos(p * 3 * Math.PI) * (1 - p); break;
    case "spin": {
      // Measured from the nearest full turn, so a cut spin unwinds the short way instead of snapping.
      const turn = 2 * Math.PI * move.amount * smooth(p);
      out.spin += Math.atan2(Math.sin(turn), Math.cos(turn)) * weight;
      break;
    }
    case "dash": out.dash += a * Math.sin(2 * Math.PI * p) * (1 - p * 0.3); out.lean += 0.6 * a * bell; break;
    case "shiver": out.shiver += a * Math.sin((tau / 1000) * 70) * 0.035 * (1 - p); break;
    case "nod": out.pitch += a * bell; break;
    case "sway": out.tilt += a * Math.sin(2 * Math.PI * p) * (1 - p * 0.4); break;
    case "pop": out.eyeOpen += a * bell; break;
    case "wag": out.wag += a * bell; break;
    case "peek": out.lean += a * bell; break;
  }
}

export function createDirector(options: DirectorOptions) {
  const random = options.random;
  let reduced = options.reducedMotion === true;
  let visible = true;
  /** Simulated time in ms. Advances only in whole fixed steps. */
  let t = 0;
  let lastNow: number | null = null, carry = 0;

  let base: BaseState = "idle";
  let thinking = false, held = false, petted = false, asleep = false, leaned = false;
  let lastActivity = 0;
  let spark = SPARK_START;
  let streak = 0;
  let petGiven = 0, petWindowStart = 0;

  let playing: Playing | null = null;
  const fading: Fading[] = [];
  const queue: BeatName[] = [];
  let nextVignette = VIGNETTE_AFTER_MS, lastVignette: BeatName | null = null, lastVignetteAt = -Infinity;

  /* the face: a crossfade from wherever he was to the current target */
  let faceName: ExpressionName = "Sunny";
  const faceFrom: Channels = { ...EXPRESSIONS.Sunny }, faceNow: Channels = { ...EXPRESSIONS.Sunny };
  let faceAt = -Infinity;

  /* gaze */
  const gaze = { x: 0, y: 0, mode: "look" as GazeMode, until: 0, owner: "wander" as "wander" | "look" | "beat" };
  const pupilX = spring(), pupilY = spring(), headX = spring(), headY = spring(), bodyX = spring();
  let nextWander = 2000 + random() * 4000, nextSaccade = 600, jitterX = 0, jitterY = 0;
  /* the drawn head turn he holds, and when it was taken up */
  let lookPose: GazePose | null = null, lookSince = 0;

  /* blink */
  let nextBlink = 2500 + random() * 3500, blinkAt = -Infinity, blinkAgain = false;
  /* soft parts */
  const frillL = spring(), frillR = spring(), tailBase = spring(), tailTip = spring(), mouth = spring();
  let mouthTarget = 0;

  const pending = { fx: [] as { kind: ParticleKind; count: number }[], cues: [] as Cue[] };
  const tr: Transient = { hop: 0, squash: 0, spin: 0, dash: 0, shiver: 0, pitch: 0, tilt: 0, eyeOpen: 0, wag: 0, lean: 0 };
  const frame: MotionFrame = {
    base, expression: faceName, beat: null, pose: null, gazeX: 0, gazeY: 0, headYaw: 0, headPitch: 0, headTilt: 0, bodyYaw: 0, lean: 0, lift: 0,
    eyeOpenL: 1, eyeOpenR: 1, eyeSmile: 0, brow: 0, mouthCurve: 0, mouthOpen: 0, cheek: 0, frillL: 0, frillR: 0, tail: 0, tailTip: 0,
    flame: 1, breath: 0, hop: 0, dash: 0, shiver: 0, squash: 0, spin: 0, spark, tier: 2, fx: [], cues: []
  };

  const faceFade = () => (reduced ? FACE_FADE_CALM_MS : FACE_FADE_MS);
  function setFace(name: ExpressionName) {
    if (name === faceName) return;
    Object.assign(faceFrom, faceNow);
    faceName = name; faceAt = t;
  }
  const baseState = (): BaseState => (asleep ? "asleep" : held ? "held" : petted ? "petted" : thinking ? "thinking" : "idle");
  /** Mood chooses among calm faces only. A low tier is cozy, never sad. */
  const idleFace = (): ExpressionName => (moodTier(spark) <= 1 ? "Cozy" : "Sunny");
  const restFace = (): ExpressionName => (base === "idle" ? idleFace() : BASE_FACE[base]);

  function cut() {
    if (!playing) return;
    fading.push({ def: playing.def, start: playing.start, cutAt: t, fadeFrom: 1 });
    playing = null;
  }
  function start(name: BeatName) {
    cut();
    playing = { name, def: BEATS[name], start: t, fxDone: 0, gazeDone: 0 };
    if (gaze.owner === "beat") gaze.until = 0;
  }
  /** Higher priority interrupts. Otherwise it waits its turn; only the two newest wait. Idle vignettes never wait. */
  function play(name: BeatName) {
    const def: BeatDef = BEATS[name];
    if (!playing || def.priority > playing.def.priority) { start(name); return; }
    if (def.priority <= 1) return;
    queue.push(name);
    while (queue.length > QUEUE_MAX) queue.shift();
  }

  function activity() {
    lastActivity = t; leaned = false;
    nextVignette = t + VIGNETTE_AFTER_MS;
    if (asleep) { asleep = false; pending.cues.push("wake"); play("wake"); }
  }

  function substep() {
    const dtMs = STEP_S * 1000;
    t += dtMs;
    const idleMs = t - lastActivity;
    spark = nextSpark(spark, null, dtMs, idleMs);

    /* L1 base state and the idle ladder */
    if (!asleep && !held && !petted && !thinking && !playing) {
      const stage = idleStage(idleMs);
      if (stage === "sleep") { asleep = true; pending.cues.push("sleep"); }
      else if (stage === "lean" && !leaned) { leaned = true; pending.cues.push("lean"); play("lean"); }
      else if (!reduced && idleMs > VIGNETTE_AFTER_MS && t > nextVignette) {
        // Livelier moods fidget more often.
        nextVignette = t + (14000 - moodTier(spark) * 2000) * (0.7 + random() * 0.6);
        const choice = VIGNETTES[Math.floor(random() * VIGNETTES.length)];
        if (choice !== lastVignette || t - lastVignetteAt > VIGNETTE_COOLDOWN_MS + BEATS[choice].ms) { lastVignette = choice; lastVignetteAt = t; play(choice); }
      }
    }
    base = baseState();

    /* L3 the beat in play */
    if (playing && t - playing.start >= playing.def.ms) {
      playing = null;
      const next = queue.shift();
      if (next) start(next);
    }
    let face = restFace();
    tr.hop = tr.squash = tr.spin = tr.dash = tr.shiver = tr.pitch = tr.tilt = tr.eyeOpen = tr.wag = tr.lean = 0;
    if (playing) {
      const tau = t - playing.start, def = playing.def;
      for (const key of def.faces) if (key.at <= tau) face = key.face;
      for (const move of def.moves ?? []) if (!reduced || !CALM_DROPS.includes(move.kind)) moveInto(tr, move, tau - move.at, reduced ? 0.5 : 1);
      const fx = def.fx ?? [];
      while (playing.fxDone < fx.length && fx[playing.fxDone].at <= tau) {
        const item = fx[playing.fxDone++];
        pending.fx.push({ kind: item.kind, count: reduced ? Math.min(item.count, CALM_PARTICLE_CAP) : item.count });
      }
      const cues = def.gaze ?? [];
      while (playing.gazeDone < cues.length && cues[playing.gazeDone].at <= tau) {
        const cue = cues[playing.gazeDone++];
        if (gaze.owner !== "look" || t > gaze.until) { gaze.x = cue.x; gaze.y = cue.y; gaze.mode = cue.mode; gaze.until = t + cue.ms; gaze.owner = "beat"; }
      }
    }
    for (let i = fading.length - 1; i >= 0; i -= 1) {
      const old = fading[i], weight = 1 - smooth((t - old.cutAt) / CUT_FADE_MS);
      if (weight <= 0) { fading.splice(i, 1); continue; }
      // The cut beat keeps moving along its own curve while it lets go, so nothing jumps.
      for (const move of old.def.moves ?? []) if (!reduced || !CALM_DROPS.includes(move.kind)) moveInto(tr, move, t - old.start - move.at, weight * (reduced ? 0.5 : 1));
    }
    setFace(face);
    mix(faceFrom, EXPRESSIONS[faceName], smooth((t - faceAt) / faceFade()), faceNow);

    /* L4 gaze: where he wants to look */
    if (t > gaze.until) {
      if (gaze.owner !== "wander") { gaze.owner = "wander"; gaze.x = 0; gaze.y = 0; gaze.mode = "look"; nextWander = t + 1200 + random() * 2500; }
      else if (t > nextWander && !asleep && base !== "held") {
        if (gaze.x !== 0 || gaze.y !== 0) { gaze.x = 0; gaze.y = 0; nextWander = t + 2000 + random() * 4000; }
        else { const angle = random() * Math.PI * 2, reach = 0.36 * (0.5 + random() * 0.5); gaze.x = Math.cos(angle) * reach; gaze.y = Math.sin(angle) * reach * 0.6; nextWander = t + 800 + random() * 800; }
        gaze.mode = random() < 0.35 ? "drift" : "look";
      }
    }
    if (t > nextSaccade) {
      nextSaccade = t + 400 + random() * 800;
      jitterX = asleep ? 0 : (random() - 0.5) * 0.08; jitterY = asleep ? 0 : (random() - 0.5) * 0.06;
    }
    const reach = asleep ? 0 : reduced ? 0.5 : 1;
    const wantX = (gaze.x + faceNow.yaw * 0.6) * reach + jitterX, wantY = (gaze.y + faceNow.pitch * 0.5) * reach + jitterY;
    const eyeSpring = GAZE_SPRING[gaze.mode];
    stepSpring(pupilX, wantX, eyeSpring); stepSpring(pupilY, wantY, eyeSpring);
    // Eyes lead, the head follows most of the way, the body follows a little and late.
    stepSpring(headX, pupilX.x * 0.75 + faceNow.yaw * 0.4, SPRINGS.HEAD_FOLLOW);
    stepSpring(headY, pupilY.x * 0.7 + faceNow.pitch * 0.5 + tr.pitch, SPRINGS.HEAD_FOLLOW);
    stepSpring(bodyX, headX.x * 0.35, SPRINGS.BODY_FOLLOW);

    /* blink: every 2.5 to 6 s, 22% doubled (Coucou) */
    if (!asleep && t > nextBlink) {
      blinkAt = t;
      if (!blinkAgain && random() < 0.22) { blinkAgain = true; nextBlink = t + 260; }
      else { blinkAgain = false; nextBlink = t + 2500 + random() * 3500; }
    }
    const blinkT = t - blinkAt;
    const lid = blinkT < 70 ? blinkT / 70 : blinkT < 190 ? 1 - (blinkT - 70) / 120 : 0;

    /* soft parts: frills and tail lag whatever the head and body just did */
    const liveliness = reduced ? 0.4 : 0.6 + moodTier(spark) * 0.2;
    const wagAmp = Math.min(1, faceNow.tailWag + tr.wag) * (reduced ? 0.4 : 1);
    const wag = Math.sin((t / 1000) * (5 + wagAmp * 6)) * wagAmp;
    const drag = headX.v * 0.22;
    stepSpring(frillL, faceNow.frill + faceNow.frillAsym * 0.6 - drag + tr.hop * 3, SPRINGS.SOFT_PART);
    stepSpring(frillR, faceNow.frill - faceNow.frillAsym * 0.6 + drag + tr.hop * 3, SPRINGS.SOFT_PART);
    stepSpring(tailBase, wag * 0.7 - bodyX.v * 0.3 + Math.sin(t / 1900) * 0.08 * liveliness, SPRINGS.SOFT_PART);
    stepSpring(tailTip, tailBase.x * 1.25 - tailBase.v * 0.08, SPRINGS.SOFT_PART);
    stepSpring(mouth, mouthTarget, SPRINGS.MOUTH);

    const breathe = asleep ? Math.sin((t / 1000) * 1.2) * 0.034 : Math.sin((t / 1000) * 2.4) * 0.022 * liveliness;
    const flicker = 1 + Math.sin(t / 90) * 0.04 + Math.sin(t / 37) * 0.03;
    const open = Math.max(0, faceNow.eyeOpen + tr.eyeOpen) * (1 - lid) * (asleep ? 0 : 1);

    /* the drawing: a base state, then a beat that names one, then a far look; otherwise the rig */
    const distance = Math.hypot(gaze.x, gaze.y);
    const wantLook = distance >= (lookPose ? LOOK_OUT : LOOK_IN) ? dirPose(gaze.x * 100, gaze.y * 100, 0) : null;
    if (wantLook !== lookPose && (!lookPose || t - lookSince >= LOOK_HOLD_MS)) { lookPose = wantLook; lookSince = t; }
    const named = playing ? beatPose(playing.def, t - playing.start) : undefined;
    frame.pose = base === "asleep" ? "sleep" : base === "held" ? "poke" : base === "petted" ? "pet"
      : named !== undefined ? named : base === "thinking" ? "up" : lookPose;
    frame.base = base; frame.expression = faceName; frame.beat = playing ? playing.name : null;
    frame.gazeX = pupilX.x; frame.gazeY = pupilY.x;
    frame.headYaw = headX.x; frame.headPitch = headY.x;
    frame.headTilt = faceNow.tilt * 0.5 + tr.tilt * 0.5;
    frame.bodyYaw = bodyX.x; frame.lean = faceNow.lean + tr.lean; frame.lift = faceNow.lift;
    frame.eyeOpenL = open; frame.eyeOpenR = open * (1 - faceNow.wink);
    frame.eyeSmile = faceNow.eyeSmile; frame.brow = faceNow.brow;
    frame.mouthCurve = faceNow.mouthCurve; frame.mouthOpen = Math.max(0, Math.min(1, faceNow.mouthOpen + mouth.x));
    frame.cheek = faceNow.cheek;
    frame.frillL = frillL.x; frame.frillR = frillR.x; frame.tail = tailBase.x; frame.tailTip = tailTip.x;
    frame.flame = faceNow.flame * flicker * (0.9 + moodTier(spark) * 0.05);
    frame.breath = breathe; frame.hop = tr.hop; frame.dash = tr.dash; frame.shiver = tr.shiver; frame.squash = tr.squash; frame.spin = tr.spin;
    frame.spark = spark; frame.tier = moodTier(spark);
  }

  return {
    /** Moves the simulation to `nowMs` (any monotonic clock) and returns the pose. The same object is reused each call. */
    advance(nowMs: number): MotionFrame {
      if (visible) {
        if (lastNow !== null) carry += Math.min(Math.max(nowMs - lastNow, 0), MAX_FRAME_MS) / 1000;
        lastNow = nowMs;
        while (carry >= STEP_S - 1e-9) { carry -= STEP_S; substep(); }
      }
      frame.fx = pending.fx; frame.cues = pending.cues;
      pending.fx = []; pending.cues = [];
      return frame;
    },
    /** A committed learning event. Stall carries its level; nothing else has a payload. */
    onEvent(event: CompanionEvent, payload?: { level?: 1 | 2 }) {
      activity();
      spark = nextSpark(spark, event, 0, 0);
      if (event === "correct" || event === "correctFast") streak += 1;
      else if (event === "wrong" || event === "blindspot") streak = 0;
      if (event === "stall") { play(payload?.level === 2 ? "stall2" : "stall1"); return; }
      play(EVENT_BEAT[event]);
      const milestone = event === "correct" || event === "correctFast" ? STREAK_BEAT[streak] : undefined;
      if (milestone) play(milestone);
    },
    play,
    /** Drop whatever he is doing and anything waiting. He eases back to his base pose. */
    rest() { queue.length = 0; cut(); },
    activity,
    /** Look at a point: x and y are -1..1 from his eyes. Pointer and tap targets only; nothing is recorded. */
    lookAt(x: number, y: number, holdMs: number, mode: GazeMode = "look") {
      if (asleep) return;
      const length = Math.hypot(x, y), scale = length > 1 ? 1 / length : 1;
      gaze.x = x * scale; gaze.y = y * scale; gaze.mode = mode; gaze.until = t + holdMs; gaze.owner = "look";
    },
    setThinking(on: boolean) { thinking = on; if (on) activity(); },
    setHeld(on: boolean) { held = on; if (on) activity(); },
    /** Petting lifts mood a little: +0.25 each, at most +1 a minute (MOOD_METER.md). */
    setPetted(on: boolean) {
      if (on && !petted) {
        activity();
        if (t - petWindowStart > 60_000) { petWindowStart = t; petGiven = 0; }
        if (petGiven < 1) { petGiven += 0.25; spark = Math.min(4, spark + 0.25); }
      }
      petted = on;
    },
    /** 0..1 from a MouthDriver. */
    setMouth(value: number) { mouthTarget = Math.max(0, Math.min(1, value)); },
    setReducedMotion(on: boolean) { reduced = on; },
    /** Hidden tabs stop the clock. On return he carries on from where he was, with no jump. */
    setVisible(on: boolean) { if (on && !visible) { lastNow = null; carry = 0; } visible = on; },
    /**
     * How far the reaction layer still holds him from his base pose: 0 means the
     * beat has fully let go. Breath, blinks and gaze are not counted.
     */
    restDistance(): number {
      const rest = EXPRESSIONS[restFace()];
      let far = Math.max(Math.abs(tr.hop) * 8, Math.abs(tr.squash) * 8, Math.abs(tr.spin) / Math.PI, Math.abs(tr.dash) * 4, Math.abs(tr.shiver) * 20, Math.abs(tr.pitch), Math.abs(tr.tilt), Math.abs(tr.eyeOpen), Math.abs(tr.lean));
      for (const key of CHANNEL_KEYS) if (key !== "tailWag") far = Math.max(far, Math.abs(faceNow[key] - rest[key]));
      return far;
    },
    /** For tests and the dev panel. */
    state: () => ({ t, base, streak, spark, playing: playing?.name ?? null, queued: [...queue], asleep, visible, reduced })
  };
}

export type Director = ReturnType<typeof createDirector>;
export { REST };
