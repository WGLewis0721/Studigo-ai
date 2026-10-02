import {
  LINES, MAX_SCALE, MIN_SCALE, MIRRORED, WINDOW, WINDOW_POSES, chooseDock, clampScale, dirPose, dockFromDrop, idleStage, reactionFor, readingPose,
  roomFor, scaleFromDrag, sizeAt, spot,
  type Area, type CompanionEvent, type CompanionPrefs, type Dock, type GazePose, type Rect, type WindowPose
} from "@/lib/companion-logic";

/* Studigo's window in a Study Room, drawn straight onto the page.

   He is only ever in one of two places here: his window (waist-up, in a corner
   of every page of the room) or his seat (the header avatar, when the learner
   sends him there). The engine owns a few elements inside `host` and nothing
   else: the room around it is React's. It reads the page to stay out of the
   way and never writes to practice state. */

export const SPRITES = "/mascot/companion";

export type CompanionHandle = {
  /** Something already happened in the room (an answer was graded, a card was rated). */
  event(name: CompanionEvent): void;
  /** True while Studigo is working on a reply. */
  thinking(on: boolean): void;
  setTone(tone: string): void;
  setPrefs(prefs: CompanionPrefs): void;
  destroy(): void;
};

type Options = {
  prefs: CompanionPrefs;
  /** The learner changed something from his window or his card. */
  onPrefs(patch: Partial<CompanionPrefs>): void;
  /** He is arriving from the Home stage: the window shows empty, then he lands in it. */
  arriving?: boolean;
};

type Press = { sx: number; sy: number; ox: number; oy: number; mode: "press" | "pet" | "drag" | "long"; lastHeart: number };

const POP: Partial<Record<WindowPose, true>> = { celebrate: true, lean: true, poke: true };
/** Clicking the size handle without dragging steps through these. */
const SIZE_STEPS = [1, 1.5, 2];
const SHAPES = {
  heart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14.2 2.6 8.9a3.5 3.5 0 0 1 5-4.9l.4.4.4-.4a3.5 3.5 0 0 1 5 4.9Z"/></svg>',
  spark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z"/></svg>',
  dot: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>'
} as const;
const FX_COLORS = {
  heart: ["var(--berry)", "#ff7aa2"],
  spark: ["var(--dandelion)", "var(--kiwi)", "var(--tangerine)", "var(--teal)"],
  zzz: ["var(--indigo)"]
} as const;

const now = () => performance.now();
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const shown = (node: Element | null): node is HTMLElement => Boolean(node && node.getClientRects().length);
/** Keeps a drag attached to its handle. A pointer that is already gone is not worth failing over. */
const capture = (node: Element, pointerId: number) => { try { node.setPointerCapture(pointerId); } catch { /* the pointer was released first */ } };

export function createCompanion(ws: HTMLElement, host: HTMLElement, options: Options): CompanionHandle {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let dead = false;
  let prefs = options.prefs;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cancel = (id: number) => { window.clearTimeout(id); timers.delete(id); };

  const rt = {
    mode: "seat" as "seat" | "window", dock: prefs.dock, pose: "center" as WindowPose | "", x: 0, y: 0,
    reactUntil: 0, reacting: false, gazeUntil: 0, gazing: false, typingUntil: 0, thinking: false, asleep: false, leaned: false,
    lastInput: now(), nextBlink: now() + 2200, nextGlance: now() + 5200, nextZ: 0, streak: 0, pokeAt: 0, pokeCombo: 0,
    press: null as Press | null, drag: null as { ox: number; oy: number } | null, steadyUntil: 0, loaded: false, pinchEndedAt: 0
  };
  /** His current size: k is the scale, W and H the window in CSS pixels. */
  let k = 1, W: number = WINDOW.w, H: number = WINDOW.h;

  /* ---------- his elements ---------- */
  host.innerHTML = `
    <div class="cmp" data-state="seat" data-tone="coach" data-pose="center" data-side="r" data-dock="br">
      <button class="cmpBubble" type="button" hidden aria-live="polite"></button>
      <div class="cmpWin">
        <div class="cmpScale">
          <div class="cmpScreen"></div>
          <div class="cmpStage"><div class="cmpBody">${WINDOW_POSES.map((pose) => `<img class="cmpPose${pose === "center" ? " on" : ""}" data-pose="${pose}" ${MIRRORED[pose as GazePose] ? "data-flip" : ""} alt="" draggable="false" decoding="async">`).join("")}<i class="cmpLid l"></i><i class="cmpLid r"></i></div></div>
          <div class="cmpHit" role="button" tabindex="0" aria-label="Studigo. Tap to play, stroke to pet. His name opens his menu."></div>
          <button class="cmpSill" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Studigo's menu"><span class="led"></span><span class="sillBrand">studigo</span><svg class="sillMore" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <button class="cmpCorner cmpGrip" type="button" tabindex="-1" aria-label="Drag to move Studigo"><svg width="16" height="6" viewBox="0 0 16 6" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.4"/><circle cx="8" cy="3" r="1.4"/><circle cx="13" cy="3" r="1.4"/></g></svg></button>
        <button class="cmpCorner cmpSize" type="button" aria-label="Resize Studigo. Drag, or press to step through sizes."><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5v-4h4M9.5 5.5v4h-4M2.8 2.8l6.4 6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="cmpCorner cmpMin" type="button" aria-label="Send Studigo back to his seat"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="cmpFx"></div>
    </div>
    <button class="cmpTab" type="button" hidden aria-label="Bring Studigo back out"><span class="led"></span><svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><path d="M7 2 2.5 7 7 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  const el = host.querySelector<HTMLElement>(".cmp")!;
  const bubble = host.querySelector<HTMLButtonElement>(".cmpBubble")!;
  const fx = host.querySelector<HTMLElement>(".cmpFx")!;
  const tab = host.querySelector<HTMLButtonElement>(".cmpTab")!;
  const hit = host.querySelector<HTMLElement>(".cmpHit")!;
  const grip = host.querySelector<HTMLElement>(".cmpGrip")!;
  const sizer = host.querySelector<HTMLButtonElement>(".cmpSize")!;
  const sill = host.querySelector<HTMLButtonElement>(".cmpSill")!;
  const poseEls = new Map<string, HTMLImageElement>();
  host.querySelectorAll<HTMLImageElement>(".cmpPose").forEach((img) => poseEls.set(img.dataset.pose ?? "", img));
  const spriteFor = (pose: string) => `${SPRITES}/${MIRRORED[pose as GazePose] ?? pose}.webp`;
  poseEls.get("center")!.src = spriteFor("center");
  /** The other poses are only fetched once he is actually out in his window. */
  const loadPoses = () => {
    if (rt.loaded) return;
    rt.loaded = true;
    poseEls.forEach((img, pose) => { if (!img.getAttribute("src")) img.src = spriteFor(pose); });
  };

  /* ---------- geometry, in viewport pixels ---------- */
  const surface = () => ws.querySelector<HTMLElement>(".modeSurface");
  const viewBottom = () => { const vv = window.visualViewport; return vv ? vv.offsetTop + vv.height : window.innerHeight; };
  /** Where his window may sit: under the page header, above the lowest control cluster. */
  function area(): Area | null {
    const page = surface();
    if (!page) return null;
    const s = page.getBoundingClientRect(), floor = viewBottom();
    let top = Math.max(s.top, 0);
    ws.querySelectorAll(".topbarWrap, .modeFrame, .mhChipBar").forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.height && r.bottom > top && r.bottom < floor * 0.6) top = r.bottom;
    });
    const composer = ws.querySelector(".chatComposer");
    if (shown(composer)) {
      const c = composer.getBoundingClientRect();
      return { top: top + 8, bottom: Math.min(c.bottom, floor) - 6, left: c.left + 6, right: c.right - 6, inRow: true };
    }
    let bottom = Math.min(s.bottom, floor) - 8;
    const nav = ws.querySelector(".studyNavigation .studyGroups");
    if (shown(nav)) { const n = nav.getBoundingClientRect(); if (n.top > floor / 2) bottom = Math.min(bottom, n.top - 8); }
    return { top: top + 8, bottom, left: Math.max(s.left, 0) + 10, right: Math.min(s.right, window.innerWidth) - 10, inRow: false };
  }
  /** The message field and whatever sits directly above it (chips, an error): what his window stands beside. */
  function rowHeight() {
    let height = 0;
    ws.querySelectorAll(".chatComposer, .chatChips, .chatError").forEach((node) => { if (shown(node)) height += node.getBoundingClientRect().height; });
    return height;
  }
  function controls(a: Area): Rect[] {
    const page = surface();
    if (!page) return [];
    return Array.from(page.querySelectorAll("button:not(:disabled), input:not(:disabled), select, textarea, a[href]"))
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.bottom > a.top && r.top < a.bottom);
  }
  function canScrollClear() {
    const page = surface();
    const scroller = page && page.scrollHeight - page.clientHeight > 8 ? page : document.scrollingElement;
    return Boolean(scroller && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 8);
  }
  function seatSpot() {
    const seat = Array.from(ws.querySelectorAll(".chatMascot")).find(shown);
    if (!seat) return { x: 14, y: 110 };
    const r = seat.getBoundingClientRect();
    return { x: r.left + r.width / 2 - W / 2, y: r.top + r.height / 2 - H / 2 };
  }
  const setXY = (x: number, y: number) => { rt.x = x; rt.y = y; el.style.setProperty("--x", `${x}px`); el.style.setProperty("--y", `${y}px`); };
  const makeRoom = (right: number, left: number, thread: number, page: number) => {
    ws.style.setProperty("--dock-r", `${right}px`); ws.style.setProperty("--dock-l", `${left}px`);
    ws.style.setProperty("--dock-thread", `${thread}px`); ws.style.setProperty("--dock-page", `${page}px`);
  };
  function place() {
    if (dead) return;
    const a = area();
    const waiting = prefs.seated && a !== null;
    tab.hidden = !waiting;
    if (waiting) {
      const page = surface()!.getBoundingClientRect(), right = rt.dock[1] === "r";
      tab.dataset.side = right ? "r" : "l";
      tab.style.setProperty("--tx", `${right ? Math.min(page.right, window.innerWidth) - 20 : Math.max(page.left, 0)}px`);
      tab.style.setProperty("--ty", `${a.bottom - (a.inRow ? rowHeight() + 62 : 58)}px`);
    }
    if (rt.mode !== "window" || !a) {
      const seat = seatSpot();
      setXY(seat.x, seat.y);
      makeRoom(0, 0, 0, 0);
      return;
    }
    const size = { w: W, h: H };
    const dock = rt.drag ? rt.dock : chooseDock(rt.dock, a, controls(a), canScrollClear(), size);
    if (!rt.drag) { const at = spot(dock, a, size); setXY(at.x, at.y); }
    el.dataset.side = dock[1];
    el.dataset.dock = dock;
    // The page makes room for him instead of being covered by him.
    const room = roomFor(dock, a, rowHeight(), size);
    makeRoom(room.right, room.left, room.thread, room.page);
  }
  let placeFrame = 0;
  const schedulePlace = () => { if (!placeFrame) placeFrame = window.requestAnimationFrame(() => { placeFrame = 0; place(); }); };

  /* ---------- his size ---------- */
  /** The largest he can be and still fit the screen he is on. */
  function fit(scale: number) {
    const a = area();
    const roomy = a ? Math.max(MIN_SCALE, (a.bottom - a.top) / WINDOW.h) : MAX_SCALE;
    return clampScale(Math.min(scale, roomy, (window.innerWidth - 24) / WINDOW.w));
  }
  function applyScale(scale: number, save: boolean) {
    k = fit(scale);
    ({ w: W, h: H } = sizeAt(k));
    el.style.setProperty("--k", String(k));
    place();
    if (save && prefs.scale !== k) changePrefs({ scale: k });
  }
  /** While the learner is resizing, the window follows the hand with no easing. */
  const sizing = (on: boolean) => { el.classList.toggle("sizing", on); if (on) bubble.hidden = true; };

  /* ---------- poses ---------- */
  function setPose(name: WindowPose) {
    if (rt.pose === name) return;
    rt.pose = name;
    poseEls.forEach((img, key) => img.classList.toggle("on", key === name));
    // Re-entering the same pose (a second poke) replays its movement.
    if (el.dataset.pose === name) { el.dataset.pose = ""; void el.offsetWidth; }
    el.dataset.pose = name;
    if (POP[name]) el.dataset.pop = ""; else delete el.dataset.pop;
  }
  /** A reaction outranks gaze and idle until it runs out. */
  function react(name: WindowPose, ms: number) {
    rt.reacting = true; rt.reactUntil = now() + ms; rt.gazing = false;
    rt.pose = ""; setPose(name);
  }
  function pulse(cls: string, ms: number, node: HTMLElement = el) {
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
    later(() => node.classList.remove(cls), ms);
  }
  const eyesX = () => rt.x + W / 2, eyesY = () => rt.y + 46 * k;
  function lookAt(px: number, py: number, hold: number) {
    if (rt.mode !== "window" || rt.drag || rt.press || rt.asleep || rt.thinking || now() < rt.reactUntil) return;
    setPose(dirPose(px - eyesX(), py - eyesY(), 54 * k));
    rt.gazing = true; rt.gazeUntil = now() + hold;
  }

  /* ---------- speech and particles ---------- */
  let sayTimer = 0;
  /** Only ever speaks when the learner has switched speech on for this room. */
  function say(lines: readonly string[]) {
    if (!prefs.speech || rt.mode !== "window") return;
    bubble.textContent = pick(lines);
    bubble.hidden = true; void bubble.offsetWidth; bubble.hidden = false;
    cancel(sayTimer); sayTimer = later(() => { bubble.hidden = true; }, 2900);
  }
  function burst(kind: keyof typeof FX_COLORS, count: number) {
    if (reduced && kind !== "zzz") count = Math.min(count, 2);
    for (let i = 0; i < count; i += 1) {
      const node = document.createElement("span");
      node.className = "fx";
      const dx = (Math.random() - 0.5) * (kind === "spark" ? 150 : 70) * k, dy = (kind === "spark" ? -30 - Math.random() * 90 : -50 - Math.random() * 40) * k;
      node.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${kind === "zzz" ? 22 : 18 + Math.random() * 30}%;--dx:${kind === "zzz" ? 26 * k : dx}px;--dy:${dy}px;--s:${(0.7 + Math.random() * 0.7) * Math.max(1, k * 0.8)};--r:${(Math.random() - 0.5) * 120}deg;--t:${kind === "zzz" ? 1.9 : 0.8 + Math.random() * 0.5}s;--c:${pick(FX_COLORS[kind])};animation-delay:${i * (kind === "spark" ? 30 : 110)}ms`;
      node.innerHTML = kind === "zzz" ? "z" : kind === "spark" ? (i % 3 ? SHAPES.spark : SHAPES.dot) : SHAPES.heart;
      node.addEventListener("animationend", () => node.remove());
      fx.appendChild(node);
    }
  }

  /* ---------- idle: a character waiting for input ---------- */
  function activity() {
    rt.lastInput = now(); rt.leaned = false;
    if (rt.asleep) { rt.asleep = false; react("poke", 800); say(LINES.wake); }
  }
  function tick() {
    if (rt.mode !== "window" || rt.drag || rt.press || rt.thinking) return;
    const t = now();
    if (t < rt.reactUntil) return;
    if (rt.reacting) { rt.reacting = false; if (!rt.asleep) setPose("center"); }
    if (t < rt.typingUntil || t < rt.gazeUntil) return;
    if (rt.gazing) { rt.gazing = false; setPose("center"); }
    if (rt.asleep) { if (t > rt.nextZ) { burst("zzz", 1); rt.nextZ = t + 1500; } return; }
    const stage = idleStage(t - rt.lastInput);
    if (stage === "sleep") { rt.asleep = true; rt.nextZ = t; setPose("sleep"); return; }
    if (stage === "lean" && !rt.leaned) { rt.leaned = true; react("lean", 5400); say(LINES.lean); return; }
    if (t > rt.nextBlink) { pulse("blink", 240); rt.nextBlink = t + 2300 + Math.random() * 3300; }
    if (t > rt.nextGlance) {
      rt.nextGlance = t + 4800 + Math.random() * 4200;
      const toward: GazePose = el.dataset.side === "r" ? "left" : "right";
      const move = pick<GazePose | "sway">([toward, toward, "up", `down-${toward}` as GazePose, "sway"]);
      if (move === "sway") pulse("sway", 1600);
      else { setPose(move); rt.gazing = true; rt.gazeUntil = t + 850; }
    }
  }

  /* ---------- touch: tap to poke, stroke to pet, pull to pick up, pinch to resize ---------- */
  function poke() {
    const t = now();
    rt.pokeCombo = t - rt.pokeAt < 1300 ? rt.pokeCombo + 1 : 1; rt.pokeAt = t;
    react("poke", 900); burst("spark", 3);
    if (rt.pokeCombo >= 3) { rt.pokeCombo = 0; pulse("sway", 1600); say(LINES.tickle); }
  }
  function highFive() { pulse("highfive", 360); burst("spark", 9); rt.reactUntil = now() + 1100; }
  function startDrag(x: number, y: number, press?: Press) {
    rt.drag = { ox: press ? press.ox : x - rt.x, oy: press ? press.oy : y - rt.y };
    el.classList.add("dragging"); bubble.hidden = true;
    rt.pose = ""; setPose("poke");
  }
  function dragTo(x: number, y: number) {
    if (!rt.drag) return;
    setXY(clamp(x - rt.drag.ox, 4, window.innerWidth - W - 4), clamp(y - rt.drag.oy, 56, viewBottom() - H - 8));
  }
  function endDrag() {
    const a = area();
    if (a) { rt.dock = dockFromDrop(rt.x + W / 2, rt.y + H / 2, a); changePrefs({ dock: rt.dock }); }
    rt.drag = null; el.classList.remove("dragging");
    place(); pulse("land", 460); react("center", 300);
  }
  let longTimer = 0;
  hit.addEventListener("pointerdown", (event) => {
    event.preventDefault(); activity();
    if (pinch) return;
    rt.press = { sx: event.clientX, sy: event.clientY, ox: event.clientX - rt.x, oy: event.clientY - rt.y, mode: "press", lastHeart: 0 };
    capture(hit, event.pointerId);
    cancel(longTimer);
    longTimer = later(() => { if (rt.press?.mode === "press") { rt.press.mode = "long"; openCard(); } }, 620);
  }, { signal });
  hit.addEventListener("pointermove", (event) => {
    const press = rt.press;
    if (!press || pinch) return;
    const x = event.clientX, y = event.clientY;
    if (press.mode === "press" && Math.hypot(x - press.sx, y - press.sy) > 7) { press.mode = "pet"; cancel(longTimer); rt.pose = ""; setPose("pet"); }
    if (press.mode === "pet") {
      const outside = x < rt.x - 18 || x > rt.x + W + 18 || y < rt.y - 18 || y > rt.y + H + 18;
      if (outside) { press.mode = "drag"; startDrag(x, y, press); }
      else if (now() - press.lastHeart > 300) { press.lastHeart = now(); burst("heart", 1); }
    }
    if (press.mode === "drag") dragTo(x, y);
  }, { signal });
  const release = () => {
    const press = rt.press;
    if (!press) return;
    cancel(longTimer); rt.press = null;
    if (press.mode === "press") { if (rt.pose === "celebrate") highFive(); else poke(); }
    else if (press.mode === "pet") react("pet", 750);
    else if (press.mode === "drag") endDrag();
  };
  hit.addEventListener("pointerup", release, { signal });
  hit.addEventListener("pointercancel", release, { signal });
  hit.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activity(); poke(); } }, { signal });
  grip.addEventListener("pointerdown", (event) => { event.preventDefault(); activity(); capture(grip, event.pointerId); startDrag(event.clientX, event.clientY); }, { signal });
  grip.addEventListener("pointermove", (event) => dragTo(event.clientX, event.clientY), { signal });
  const drop = () => { if (rt.drag) endDrag(); };
  grip.addEventListener("pointerup", drop, { signal });
  grip.addEventListener("pointercancel", drop, { signal });

  /* Resize by the handle (desktop): the corner he is docked in stays put and the
     opposite corner follows the pointer. A press without a drag steps through sizes. */
  let resize: { ax: number; ay: number; moved: boolean } | null = null;
  sizer.addEventListener("pointerdown", (event) => {
    event.preventDefault(); activity();
    capture(sizer, event.pointerId);
    const dock = (el.dataset.dock ?? rt.dock) as Dock;
    resize = { ax: dock[1] === "r" ? rt.x + W : rt.x, ay: dock[0] === "b" ? rt.y + H : rt.y, moved: false };
  }, { signal });
  sizer.addEventListener("pointermove", (event) => {
    if (!resize) return;
    if (!resize.moved) { resize.moved = true; sizing(true); }
    applyScale(scaleFromDrag(resize.ax, resize.ay, event.clientX, event.clientY), false);
  }, { signal });
  const endResize = () => {
    if (!resize) return;
    const dragged = resize.moved;
    resize = null;
    if (!dragged) return;
    sizing(false); sizeClickUntil = now() + 350;
    changePrefs({ scale: k });
  };
  let sizeClickUntil = 0;
  sizer.addEventListener("pointerup", endResize, { signal });
  sizer.addEventListener("pointercancel", endResize, { signal });
  sizer.addEventListener("click", () => {
    // The click that ends a drag is not a request to step the size.
    if (now() < sizeClickUntil) return;
    const next = SIZE_STEPS.find((step) => step > k + 0.05) ?? SIZE_STEPS[0];
    applyScale(next, true); pulse("land", 460);
  }, { signal });

  /* Resize by pinching him (touch): two fingers on his window. */
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { start: number; from: number } | null = null;
  const spread = () => { const [a, b] = Array.from(fingers.values()); return Math.hypot(a.x - b.x, a.y - b.y); };
  el.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size !== 2 || pinch) return;
    // A second finger turns the gesture into a pinch: whatever the first finger began is dropped.
    cancel(longTimer); rt.press = null;
    if (rt.drag) { rt.drag = null; el.classList.remove("dragging"); }
    rt.pose = ""; setPose("center");
    pinch = { start: Math.max(spread(), 24), from: k };
    sizing(true);
  }, { signal, capture: true });
  window.addEventListener("pointermove", (event) => {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && fingers.size >= 2) applyScale(pinch.from * (spread() / pinch.start), false);
  }, { signal, passive: true });
  const liftFinger = (event: PointerEvent) => {
    if (!fingers.delete(event.pointerId) || !pinch || fingers.size >= 2) return;
    pinch = null; sizing(false);
    rt.pinchEndedAt = now();
    changePrefs({ scale: k });
    pulse("land", 460);
  };
  window.addEventListener("pointerup", liftFinger, { signal });
  window.addEventListener("pointercancel", liftFinger, { signal });
  /** The tap a pinch leaves behind is not a tap. */
  const afterPinch = () => now() - rt.pinchEndedAt < 400;

  /* ---------- his seat: the header avatar he goes back to when dismissed ---------- */
  let seatTimer = 0;
  function changePrefs(patch: Partial<CompanionPrefs>) {
    prefs = { ...prefs, ...patch };
    options.onPrefs(patch);
  }
  const wanted = () => (!prefs.seated && surface() ? "window" : "seat");
  function sync() {
    const want = wanted();
    if (want === rt.mode) { ws.dataset.seat = want === "window" ? "empty" : "occupied"; place(); return; }
    rt.mode = want; rt.asleep = false; rt.drag = null; bubble.hidden = true; closeCard();
    cancel(seatTimer);
    if (want === "window") {
      loadPoses();
      ws.dataset.seat = "empty";
      // He was parked on his seat, so the move to his corner reads as stepping out of it.
      el.dataset.state = "window"; activity(); place(); pulse("land", 460);
      react("support", 1200);
    } else {
      el.dataset.state = "seat"; place();
      seatTimer = later(() => { ws.dataset.seat = "occupied"; pulse("seatLand", 420, ws); }, reduced ? 0 : 300);
    }
  }
  /** The window appears empty; he lands in it a moment later (the end of his leap from Home). */
  function arrive() {
    loadPoses();
    rt.mode = "window"; rt.asleep = false;
    ws.dataset.seat = "empty";
    el.dataset.empty = ""; el.classList.add("noMove"); el.dataset.state = "window";
    place(); void el.offsetWidth; el.classList.remove("noMove");
    later(() => { delete el.dataset.empty; activity(); pulse("land", 460); react("celebrate", 1300); burst("spark", 10); }, reduced ? 0 : 520);
  }
  host.querySelector<HTMLButtonElement>(".cmpMin")!.addEventListener("click", () => { changePrefs({ seated: true }); sync(); tab.focus({ preventScroll: true }); }, { signal });
  tab.addEventListener("click", () => { changePrefs({ seated: false }); sync(); }, { signal });

  /* ---------- his menu ---------- */
  let card: HTMLElement | null = null;
  function closeCard() {
    if (!card) return;
    card.remove(); card = null;
    sill.setAttribute("aria-expanded", "false");
    if (rt.mode === "window") sill.focus({ preventScroll: true });
  }
  function openCard() {
    closeCard();
    const wrap = document.createElement("div");
    wrap.className = "cmpCard";
    wrap.innerHTML = `
      <button class="cmpBackdrop" type="button" aria-label="Close Studigo's menu" data-card="close"></button>
      <section class="cmpSheet" role="dialog" aria-modal="true" aria-labelledby="cmpSheetTitle">
        <div class="cmpSheetHead"><div><span class="tinyLabel">STUDIGO</span><strong id="cmpSheetTitle">Your study companion</strong></div><button type="button" data-card="close">Done</button></div>
        <div class="cmpCardTop">
          <button class="cmpPlay" type="button" data-card="play" aria-label="Studigo. Tap to play."><img src="${SPRITES}/full/center.webp" alt=""></button>
          <div class="cmpAbout"><strong>He studies with you.</strong><p>He looks where you tap, reads along while you type, and turns see-through when you scroll. He never changes your mastery. Only your answers do.</p></div>
        </div>
        <label class="cmpRange"><b>Size</b><small>Drag his corner handle, or pinch him on a phone.</small><input type="range" min="${MIN_SCALE * 100}" max="${MAX_SCALE * 100}" step="5" value="${Math.round(k * 100)}" data-set="scale" aria-label="Studigo's size"><output>${Math.round(k * 100)}%</output></label>
        <label class="cmpToggle"><b>Speech</b><small>A short line now and then. Off until you turn it on.</small><input type="checkbox" data-set="speech" ${prefs.speech ? "checked" : ""}></label>
        <label class="cmpToggle"><b>Fade while I scroll</b><small>He turns see-through so nothing under him is hidden.</small><input type="checkbox" data-set="tuck" ${prefs.tuck ? "checked" : ""}></label>
        <div class="cmpCardActions">
          <button class="ghostButton" type="button" data-card="move">Move to the other side</button>
          <button class="ghostButton" type="button" data-card="seat">Send him back to his seat</button>
        </div>
      </section>`;
    wrap.addEventListener("click", (event) => {
      // Scoped to the card: the workspace above it carries data attributes of its own.
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-card]")?.dataset.card;
      if (action === "close") closeCard();
      if (action === "seat") { closeCard(); changePrefs({ seated: true }); sync(); }
      if (action === "move") { rt.dock = `${rt.dock[0]}${rt.dock[1] === "r" ? "l" : "r"}` as Dock; changePrefs({ dock: rt.dock }); closeCard(); place(); pulse("land", 460); }
      const play = action === "play" ? wrap.querySelector<HTMLElement>(".cmpPlay") : null;
      if (play) {
        const img = play.querySelector("img")!;
        img.src = `${SPRITES}/full/celebrate.webp`; pulse("playing", 900, play);
        later(() => { img.src = `${SPRITES}/full/center.webp`; }, 900);
      }
    });
    const readout = wrap.querySelector("output")!;
    wrap.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.set !== "scale") return;
      applyScale(Number(input.value) / 100, true);
      readout.textContent = `${Math.round(k * 100)}%`;
    });
    wrap.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement, key = input.dataset.set;
      if (key === "speech" || key === "tuck") changePrefs({ [key]: input.checked });
    });
    wrap.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeCard(); } });
    host.appendChild(wrap);
    card = wrap;
    sill.setAttribute("aria-expanded", "true");
    wrap.querySelector<HTMLButtonElement>(".cmpSheetHead [data-card]")?.focus({ preventScroll: true });
  }
  sill.addEventListener("click", () => { if (afterPinch()) return; pulse("pressed", 260, sill); openCard(); }, { signal });
  bubble.addEventListener("click", () => { bubble.hidden = true; }, { signal });

  /* ---------- watching the room ---------- */
  const inHost = (target: EventTarget | null) => target instanceof Node && host.contains(target);
  ws.addEventListener("pointermove", (event) => { if (!inHost(event.target)) lookAt(event.clientX, event.clientY, 1800); }, { signal, passive: true });
  ws.addEventListener("pointerdown", (event) => { if (!inHost(event.target)) { activity(); lookAt(event.clientX, event.clientY, 1500); } }, { signal, capture: true, passive: true });
  document.addEventListener("keydown", activity, { signal });
  /** On every keystroke he looks at where the words are appearing. */
  ws.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || inHost(input)) return;
    if (input instanceof HTMLInputElement && !["text", "search", ""].includes(input.type)) return;
    activity();
    if (rt.mode !== "window" || now() < rt.reactUntil || rt.thinking) return;
    const r = input.getBoundingClientRect(), chars = Math.min(input.value.length, 26);
    setPose(readingPose(r.left + 16 + chars * 8.4 - eyesX(), r.top + r.height / 2 - eyesY()));
    rt.gazing = true; rt.typingUntil = now() + 1500;
    if (!reduced) pulse("bob", 170);
  }, { signal });

  /* While the page scrolls up or down he stays exactly where he is and turns
     see-through, so nothing passing under him is hidden. Sideways scrolling (a
     row of chips) passes behind him and changes nothing. Only a real gesture
     counts: the app scrolling a new message into view does not. */
  let fadeTimer = 0, touchFrom: { x: number; y: number } | null = null;
  const sideways = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".chatChips, .coachTabs, .chatModes, .studyGroups"));
  const fadeForScroll = () => {
    rt.lastInput = now();
    if (!prefs.tuck || rt.mode !== "window" || rt.drag || pinch || resize || now() < rt.steadyUntil) return;
    el.classList.add("ghost"); bubble.hidden = true;
    cancel(fadeTimer); fadeTimer = later(() => el.classList.remove("ghost"), 520);
  };
  ws.addEventListener("wheel", (event) => {
    if (inHost(event.target) || sideways(event.target) || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    fadeForScroll();
  }, { signal, passive: true });
  ws.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    touchFrom = touch && !inHost(event.target) && !sideways(event.target) ? { x: touch.clientX, y: touch.clientY } : null;
  }, { signal, passive: true });
  ws.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (!touchFrom || !touch) return;
    const dx = Math.abs(touch.clientX - touchFrom.x), dy = Math.abs(touch.clientY - touchFrom.y);
    if (dy > 8 && dy > dx) fadeForScroll();
  }, { signal, passive: true });

  // He rides along whenever the page under him changes: a new page, the keyboard, a resize.
  const onViewport = () => { if (fit(prefs.scale) !== k) applyScale(prefs.scale, false); else schedulePlace(); };
  window.addEventListener("resize", onViewport, { signal });
  window.addEventListener("scroll", schedulePlace, { signal, passive: true });
  window.visualViewport?.addEventListener("resize", schedulePlace, { signal });
  window.visualViewport?.addEventListener("scroll", schedulePlace, { signal });
  ws.addEventListener("transitionend", (event) => { if (!inHost(event.target)) schedulePlace(); }, { signal });
  const sizes = new ResizeObserver(schedulePlace);
  sizes.observe(ws);
  const changes = new MutationObserver((records) => {
    if (!records.some((record) => !host.contains(record.target))) return;
    // The page changed under him: hold still for a moment, and catch up.
    rt.steadyUntil = now() + 700;
    schedulePlace();
    if (wanted() !== rt.mode) sync();
  });
  changes.observe(ws, { childList: true, subtree: true });

  const heartbeat = window.setInterval(tick, 320);
  applyScale(prefs.scale, false);
  if (options.arriving && !prefs.seated && surface()) arrive(); else sync();

  return {
    event(name) {
      if (dead) return;
      activity();
      if (name === "correct") rt.streak += 1;
      else if (name === "wrong" || name === "blindspot") rt.streak = 0;
      if (rt.mode !== "window") {
        // From his seat he still notices: the avatar gives a small bounce.
        if (name === "correct" || name === "setDone" || name === "cardGood") pulse("seatLand", 420, ws);
        return;
      }
      const reaction = reactionFor(name, rt.streak);
      react(reaction.pose, reaction.ms);
      if (reaction.sparks) burst("spark", reaction.sparks);
      if (reaction.lines && (reaction.always || Math.random() < 0.35)) say(reaction.lines);
    },
    thinking(on) {
      if (dead || rt.thinking === on) return;
      rt.thinking = on;
      el.classList.toggle("thinking", on);
      if (rt.mode !== "window") return;
      activity();
      rt.pose = ""; setPose(on ? "up" : "center");
    },
    setTone(tone) { el.dataset.tone = tone; },
    setPrefs(next) {
      if (dead) return;
      prefs = next;
      if (!rt.drag) rt.dock = next.dock;
      if (!next.speech) bubble.hidden = true;
      if (!pinch && !resize && fit(next.scale) !== k) applyScale(next.scale, false);
      sync();
    },
    destroy() {
      dead = true;
      lifetime.abort();
      window.clearInterval(heartbeat);
      window.cancelAnimationFrame(placeFrame);
      timers.forEach((id) => window.clearTimeout(id));
      sizes.disconnect(); changes.disconnect();
      host.innerHTML = "";
      ["--dock-r", "--dock-l", "--dock-thread", "--dock-page"].forEach((name) => ws.style.removeProperty(name));
      delete ws.dataset.seat;
      ws.classList.remove("seatLand");
    }
  };
}
