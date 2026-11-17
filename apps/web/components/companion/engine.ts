import {
  LINES, MAX_SCALE, MIN_SCALE, OUTFITS, OUTFIT_LABELS, WINDOW, chooseDock, controlSafeDock, clampScale, coversControl, dirPose, dockForPos, idleStage, nudgePos, parseOutfit, pointFromPos, posFromPoint, reactionFor, readingPose,
  roomFor, scaleFromDrag, sizeAt, spot,
  type Area, type CompanionEvent, type CompanionPrefs, type Dock, type GazePose, type Rect, type WindowPose
} from "@/lib/companion-logic";
import type { BeatName } from "@/lib/companion-motion/beats";
import { createDirector, type Director, type MotionFrame } from "@/lib/companion-motion/director";
import { QUIET_FEEDBACK_EVENT, quietFeedback, type QuietFeedbackDetail } from "@/lib/quiet-feedback";
import { createSpriteRenderer, motionEnabled, SPRITES, type CompanionRenderer } from "./renderers";
import { createRigRenderer } from "./rig-renderer";

/* Studigo's window in a Study Room, drawn straight onto the page.

   He is only ever in one of two places here: his window (waist-up, in a corner
   of every page of the room) or his seat (the header avatar, when the learner
   sends him there). The engine owns a few elements inside `host` and nothing
   else: the room around it is React's. It reads the page to stay out of the
   way and never writes to practice state. */

export { SPRITES };

export type CompanionHandle = {
  /** Something already happened in the room (an answer was graded, a card was rated). */
  event(name: CompanionEvent): void;
  /** True while Studigo is working on a reply. */
  thinking(on: boolean): void;
  setTone(tone: string): void;
  setPrefs(prefs: CompanionPrefs): void;
  /** Living companion only: play one of his beats by name. For the dev hook and demos. */
  play?(beat: BeatName): void;
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
type Mode = "seat" | "window" | "strip";

const POP: Partial<Record<WindowPose, true>> = { celebrate: true, lean: true, poke: true };
/** With the living companion, the old pose and pulse commands become beats. */
const POSE_BEAT: Partial<Record<WindowPose, BeatName>> = { celebrate: "bound", support: "support", poke: "poke", pet: "petted", lean: "lean" };
const PULSE_BEAT: Partial<Record<string, BeatName>> = { land: "land", sway: "tickle", quietAck: "nod" };
/** A pointer this far from his eyes (at default size) turns his head all the way. */
const GAZE_REACH = 170;
/** His stage is 106 px wide at his default size, and his eyes sit 53 px across and 41 px down from its top left. */
const STAGE_W = 106, EYE_ACROSS = 53, EYE_DOWN = 41;
/** Clicking the size handle without dragging steps through these. */
const SIZE_STEPS = [1, 1.5, 2];
const NUDGE_PX = 16;
const NUDGE = new Map<string, readonly [number, number]>([["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]]]);
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
/* Reading targets stay this far out, so the director draws him looking down into the field. */
const READ_REACH = 0.6;
/** Reading: he peers down into the field, as the drawn reading pose did. Text beside him, or just above, is pulled down. */
function readingGaze(x: number, y: number): [number, number] {
  let gx = x, gy = y;
  if (gy > -0.3) gy = Math.max(gy, 0.5 * Math.abs(gx), READ_REACH);
  const length = Math.hypot(gx, gy);
  if (length < READ_REACH) { gx = (gx * READ_REACH) / length; gy = (gy * READ_REACH) / length; }
  return [gx, gy];
}

export function createCompanion(ws: HTMLElement, host: HTMLElement, options: Options): CompanionHandle {
  const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let dead = false;
  let prefs = options.prefs;
  let calm = systemReduced || prefs.calm;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cancel = (id: number) => { window.clearTimeout(id); timers.delete(id); };

  const rt = {
    mode: "seat" as Mode, dock: prefs.dock, pose: "center" as WindowPose | "", x: 0, y: 0,
    reactUntil: 0, reacting: false, gazeUntil: 0, gazing: false, typingUntil: 0, thinking: false, asleep: false, leaned: false,
    lastInput: now(), nextBlink: now() + 2200, nextGlance: now() + 5200, nextZ: 0, streak: 0, pokeAt: 0, pokeCombo: 0,
    press: null as Press | null, drag: null as { ox: number; oy: number } | null, steadyUntil: 0, loaded: false, pinchEndedAt: 0,
    // Auto-seating is transient. The edge tab must still allow an explicit summon.
    autoSeated: false, userSummoned: false
  };
  /** His current size: k is the scale, W and H the window in CSS pixels. */
  let k = 1, W: number = WINDOW.w, H: number = WINDOW.h;
  /** The size the learner asked for. What is shown (k) can be smaller when the room is tight. */
  let desired = prefs.scale;
  /** The corner a resize or pinch grows from, while it lasts. */
  let grow: { x: number; y: number; dock: Dock } | null = null;
  /** True when he sits at the spot the learner chose, rather than in a corner. */
  let floating = false;

  /* ---------- how he is drawn ---------- */
  /** The living companion: a motion director and the rig. Null means the original drawings. */
  let director: Director | null = motionEnabled() ? createDirector({ random: Math.random, reducedMotion: calm }) : null;
  let renderer: CompanionRenderer = director ? createRigRenderer(() => fallBack()) : createSpriteRenderer();
  /** Dresses whichever drawing he is in now. The original drawings have no outfits, so they ignore it. */
  function applyOutfit() { renderer.setOutfit?.(prefs.outfit); }

  /* ---------- his elements ---------- */
  host.innerHTML = `
    <div class="cmp" data-state="seat" data-tone="coach" data-pose="center" data-side="r" data-dock="br"${director ? " data-motion" : ""}>
      <button class="cmpBubble" type="button" hidden aria-live="polite"></button>
      <div class="cmpWin">
        <div class="cmpScale">
          <div class="cmpScreen"></div>
          <div class="cmpStage"><div class="cmpBody">${renderer.markup()}</div></div>
          <div class="cmpHit" role="button" tabindex="0" aria-label="Studigo. Tap to play, stroke to pet. Arrow keys move him. His name opens his menu."></div>
          <button class="cmpSill" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Studigo's menu"><span class="led"></span><span class="sillBrand">studigo</span><svg class="sillMore" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
        <button class="cmpCorner cmpGrip" type="button" tabindex="-1" aria-label="Drag to move Studigo"><svg width="16" height="6" viewBox="0 0 16 6" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.4"/><circle cx="8" cy="3" r="1.4"/><circle cx="13" cy="3" r="1.4"/></g></svg></button>
        <button class="cmpCorner cmpSize" type="button" aria-label="Resize Studigo. Drag, or press to step through sizes."><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5v-4h4M9.5 5.5v4h-4M2.8 2.8l6.4 6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="cmpCorner cmpMin" type="button" aria-label="Send Studigo back to his seat"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="cmpFx"></div>
      <button class="cmpStripMenu" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Studigo's menu"><span class="led"></span><span class="sillBrand">studigo</span><svg class="sillMore" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
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
  const body = host.querySelector<HTMLElement>(".cmpBody")!;
  const stageNode = el.querySelector<HTMLElement>(".cmpStage")!;
  const stripMenu = host.querySelector<HTMLButtonElement>(".cmpStripMenu")!;
  /** The strip's box. His window lives in it only while he is shown in the strip. */
  const stripBox = document.createElement("div");
  stripBox.className = "cmpStrip";
  let heartbeat = 0, motionFrame = 0;
  /** The rig could not draw (no WebGL, a lost context, missing art): he goes back to the original drawings. */
  function fallBack() {
    if (dead || !director) return;
    director = null;
    window.cancelAnimationFrame(motionFrame); motionFrame = 0;
    try { renderer.destroy(); } catch { /* it was already broken */ }
    renderer = createSpriteRenderer();
    body.innerHTML = renderer.markup();
    renderer.mount(body);
    applyOutfit();
    delete el.dataset.motion;
    if (rt.loaded) renderer.load();
    rt.pose = ""; setPose("center");
    if (!heartbeat) heartbeat = window.setInterval(tick, 320);
  }
  try { renderer.mount(body); } catch (error) { console.warn("Studigo's rig could not start; using his drawings.", error); fallBack(); }
  applyOutfit();
  /** The other poses are only fetched once he is actually out in his window. */
  const loadPoses = () => {
    if (rt.loaded) return;
    rt.loaded = true;
    renderer.load();
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
      const row = composer.querySelector(".chatRow");
      const keys = Array.from(row?.querySelectorAll(".voiceAnswerControl, .chatSend") ?? []).filter(shown);
      const keyWidth = keys.reduce((total, key) => total + key.getBoundingClientRect().width, 0);
      const gap = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
      // Keep at least 120px for writing after reserving his window and keys.
      // A crowded messenger gets a full-width lane; he sits above it instead
      // of squeezing the input down to a few characters on a narrow phone.
      if (c.width - W - 8 - keyWidth - keys.length * gap < 120) {
        return { top: top + 8, bottom: Math.min(c.top - 8, floor), left: Math.max(s.left, 0) + 10, right: Math.min(s.right, window.innerWidth) - 10, inRow: false };
      }
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
    ws.querySelectorAll(".chatComposer, .chatChips, .chatError, .lessonActions, .lessonCitations").forEach((node) => { if (shown(node)) height += node.getBoundingClientRect().height; });
    return height;
  }
  function controls(a: Area): Rect[] {
    const page = surface();
    if (!page) return [];
    return Array.from(page.querySelectorAll("button:not(:disabled), input:not(:disabled), label:has(input:not(:disabled)), select, textarea, a[href]"))
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
  /** The largest he can be and still fit the space he has. */
  function fit(scale: number, a: Area | null) {
    const roomy = a ? Math.max(MIN_SCALE, (a.bottom - a.top) / WINDOW.h) : MAX_SCALE;
    // A window with no width yet (a tab that has not been shown) says nothing about the room he will have.
    const wide = window.innerWidth > 0 ? (window.innerWidth - 24) / WINDOW.w : MAX_SCALE;
    return clampScale(Math.max(MIN_SCALE, Math.min(scale, roomy, wide)));
  }
  function place() {
    if (dead) return;
    if (rt.mode === "strip") { placeStrip(); return; }
    stripSlot()?.removeAttribute("data-on");
    stripBox.remove();
    // Coming back from the strip is a move, not a slide: he appears where he now is.
    if (el.parentElement !== host || el.dataset.host) snap(() => { delete el.dataset.host; host.insertBefore(el, tab); placeInRoom(); });
    else placeInRoom();
  }
  function placeInRoom() {
    const a = area();
    // His size follows the room he has: he shrinks to fit a tight spot and returns to the chosen size after.
    const fitted = fit(desired, a);
    if (fitted !== k) { k = fitted; ({ w: W, h: H } = sizeAt(k)); el.style.setProperty("--k", String(k)); }
    const positionSeatTab = () => {
      // A safety retreat on a dense Progress surface is still a seat: unlike
      // the saved seated preference, it must not strand Studigo offscreen.
      const waiting = a !== null && (prefs.seated || rt.autoSeated);
      tab.hidden = !waiting;
      if (!waiting || !a) return;
      const page = surface()!.getBoundingClientRect(), right = rt.dock[1] === "r";
      tab.dataset.side = right ? "r" : "l";
      tab.style.setProperty("--tx", `${right ? Math.min(page.right, window.innerWidth) - 20 : Math.max(page.left, 0)}px`);
      tab.style.setProperty("--ty", `${a.bottom - (a.inRow ? rowHeight() + 83 : 79)}px`);
    };
    positionSeatTab();
    // Automatic seating is transient presentation, never a saved preference.
    el.hidden = false; el.inert = false;
    floating = false;
    if (rt.mode !== "window" || !a) {
      rt.autoSeated = false;
      positionSeatTab();
      const seat = seatSpot();
      setXY(seat.x, seat.y);
      makeRoom(0, 0, 0, 0);
      return;
    }
    const size = { w: W, h: H };
    const safeRoom = ws.closest('.roomDevice[data-ui="phase3"]') !== null && !a.inRow;
    const targets = controls(a);
    if (safeRoom) {
      // Source text and section headings matter as much as clickable controls.
      // Keep the Materials title/status unobscured; if no safe corner remains,
      // controlSafeDock automatically seats Studigo in his existing header avatar.
      surface()?.querySelectorAll(".dropzone, .guideReading, .materialsIntro h2, .materialsReadout, .roomSectionIntro, .masteryHero, .weakSpots li, .mdTile, .evidenceGuide").forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.bottom > a.top && rect.top < a.bottom) targets.push(rect);
      });
    }
    // A spot he was moved to holds, as a corner does, unless it covers a control the page cannot scroll clear.
    // Without the scroll rule, scrolling would flip him between spot and corner. Phase 3 rooms and chat rows keep their corners.
    let free: { x: number; y: number; dock: Dock } | null = null;
    if (prefs.pos && !safeRoom && !a.inRow) {
      const floatDock = grow?.dock ?? dockForPos(prefs.pos, a, size);
      const from = grow
        ? { x: floatDock[1] === "r" ? grow.x - size.w : grow.x, y: floatDock[0] === "b" ? grow.y - size.h : grow.y }
        : pointFromPos(prefs.pos, a, size);
      free = {
        x: clamp(from.x, a.left, Math.max(a.left, a.right - size.w)),
        y: clamp(from.y, a.top, Math.max(a.top, a.bottom - size.h)),
        dock: floatDock
      };
    }
    if (free && (rt.drag || canScrollClear() || !coversControl(free, targets, size))) {
      floating = true;
      rt.autoSeated = false;
      positionSeatTab();
      ws.dataset.seat = "empty";
      if (!rt.drag) setXY(free.x, free.y);
      el.dataset.side = free.dock[1];
      el.dataset.dock = free.dock;
      makeRoom(0, 0, 0, 0);
      return;
    }
    const preferred = grow?.dock ?? (prefs.pos && !a.inRow ? dockForPos(prefs.pos, a, size) : rt.dock);
    const dock = safeRoom && !rt.drag && !rt.userSummoned
      ? controlSafeDock(preferred, a, targets, size)
      : rt.drag ? rt.dock : chooseDock(preferred, a, targets, canScrollClear(), size);
    if (dock === null) {
      // No safe corner. Temporarily seat him, but expose his normal edge tab
      // even if the header has retracted: the learner can always summon him.
      rt.autoSeated = true;
      positionSeatTab();
      el.hidden = true; el.inert = true; bubble.hidden = true;
      ws.dataset.seat = "occupied";
      closeCard();
      makeRoom(0, 0, 0, 0);
      return;
    }
    rt.autoSeated = false;
    positionSeatTab();
    ws.dataset.seat = "empty";
    if (!rt.drag) { const at = spot(dock, a, size); setXY(at.x, at.y); }
    el.dataset.side = dock[1];
    el.dataset.dock = dock;
    // The page makes room for him instead of being covered by him.
    const room = roomFor(dock, a, rowHeight(), size);
    if (!a.inRow && shown(ws.querySelector(".chatComposer"))) {
      // This is a chat window above the bar, so reserve scroll room in the
      // thread rather than adding space to the surrounding page.
      makeRoom(0, 0, dock[0] === "b" ? H + 8 : 0, 0);
    } else makeRoom(room.right, room.left, room.thread, room.page);
  }
  /** The strip's slot in this room's header, if the room has one. */
  function stripSlot(): HTMLElement | null { return ws.querySelector<HTMLElement>("[data-companion-strip]"); }
  /** The strip only shows while its slot has a height. The header's drawer folds it away. */
  function stripShowing(): boolean { const slot = stripSlot(); return Boolean(slot && slot.getBoundingClientRect().height > 0); }
  /** He is out and can be seen: in his window, or in the strip while the strip shows. */
  function live(): boolean { return rt.mode === "window" || (rt.mode === "strip" && stripShowing()); }
  /** Changes his window in place without a transition, so he appears where he now is. */
  function snap(change: () => void) {
    el.classList.add("noMove");
    change();
    void el.offsetWidth;
    el.classList.remove("noMove");
  }
  /** The strip: his window moved into the slot under the menu, where it is a fixed band. */
  function placeStrip() {
    const slot = stripSlot();
    if (!slot) { sync(); return; }
    slot.setAttribute("data-on", "");
    sizes.observe(slot);
    if (stripBox.parentElement !== slot) slot.appendChild(stripBox);
    if (el.parentElement !== stripBox || el.dataset.host !== "strip") snap(() => { el.dataset.host = "strip"; stripBox.appendChild(el); });
    el.hidden = false; el.inert = false; floating = false;
    tab.hidden = true;
    makeRoom(0, 0, 0, 0);
    ws.dataset.seat = "empty";
    syncMotion();
  }
  let placeFrame = 0;
  const schedulePlace = () => { if (!placeFrame) placeFrame = window.requestAnimationFrame(() => { placeFrame = 0; place(); }); };

  /* ---------- his size ---------- */
  /** The size the learner chose (or is choosing mid-gesture); what is shown may be smaller to fit. */
  function applyScale(scale: number, save: boolean) {
    desired = clampScale(scale);
    place();
    if (save && prefs.scale !== k) { desired = k; changePrefs({ scale: k }); }
  }
  /** While the learner is resizing, the window follows the hand with no easing. */
  const sizing = (on: boolean) => { el.classList.toggle("sizing", on); if (on) bubble.hidden = true; };

  /* ---------- poses ---------- */
  /** Writes the pose his element carries: the attribute the CSS reads, and the pop that lets him break out of his frame. */
  function stamp(name: WindowPose) {
    rt.pose = name;
    // Re-entering the same pose (a second poke) replays its movement.
    if (el.dataset.pose === name) { el.dataset.pose = ""; void el.offsetWidth; }
    el.dataset.pose = name;
    if (POP[name]) el.dataset.pop = ""; else delete el.dataset.pop;
  }
  function setPose(name: WindowPose) {
    // In motion mode the director names the pose instead (see syncPose).
    if (director) return;
    if (rt.pose === name) return;
    renderer.setPose(name);
    stamp(name);
  }
  /** A reaction outranks gaze and idle until it runs out. */
  function react(name: WindowPose, ms: number) {
    if (director) { const beat = POSE_BEAT[name]; if (beat) director.play(beat); return; }
    rt.reacting = true; rt.reactUntil = now() + ms; rt.gazing = false;
    rt.pose = ""; setPose(name);
  }
  function pulse(cls: string, ms: number, node: HTMLElement = el) {
    if (director && node === el) {
      const beat = PULSE_BEAT[cls];
      if (beat) { director.play(beat); return; }
      if (cls === "bob" || cls === "blink") return;
    }
    node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
    later(() => node.classList.remove(cls), ms);
  }
  /** Where his eyes are on the page, and how many page pixels make one of his units. In the strip that is the stage as it is drawn. */
  function eyes(): { x: number; y: number; scale: number } {
    if (rt.mode === "strip") {
      const r = stageNode.getBoundingClientRect(), scale = r.width > 0 ? r.width / STAGE_W : k;
      return { x: r.left + EYE_ACROSS * scale, y: r.top + EYE_DOWN * scale, scale };
    }
    return { x: rt.x + W / 2, y: rt.y + 46 * k, scale: k };
  }
  function lookAt(px: number, py: number, hold: number) {
    if (director) {
      // Continuous: his eyes go first, then his head. Only the direction is used; nothing is kept.
      if (live() && !rt.drag && !rt.press) { const e = eyes(); director.lookAt((px - e.x) / (GAZE_REACH * e.scale), (py - e.y) / (GAZE_REACH * e.scale), hold); rt.gazeUntil = now() + hold; }
      return;
    }
    if (!live() || rt.drag || rt.press || rt.asleep || rt.thinking || now() < rt.reactUntil) return;
    const e = eyes();
    setPose(dirPose(px - e.x, py - e.y, 54 * e.scale));
    rt.gazing = true; rt.gazeUntil = now() + hold;
  }

  /* ---------- speech and particles ---------- */
  let sayTimer = 0;
  /** Only ever speaks when the learner has switched speech on for this room. */
  function say(lines: readonly string[]) {
    if (!prefs.speech || !live()) return;
    bubble.textContent = pick(lines);
    bubble.hidden = true; void bubble.offsetWidth; bubble.hidden = false;
    cancel(sayTimer); sayTimer = later(() => { bubble.hidden = true; }, 2900);
  }
  function burst(kind: keyof typeof FX_COLORS, count: number) {
    // Calm mode has no sparks or hearts. Only the sleep letters remain.
    if (calm && kind !== "zzz") return;
    // In the strip the figure is small: particles start lower and travel a short way, so they stay in it.
    const inStrip = rt.mode === "strip", travel = inStrip ? 0.2 : k;
    for (let i = 0; i < count; i += 1) {
      const node = document.createElement("span");
      node.className = "fx";
      const dx = (Math.random() - 0.5) * (kind === "spark" ? 150 : 70) * travel, dy = (kind === "spark" ? -30 - Math.random() * 90 : -50 - Math.random() * 40) * travel;
      const fy = kind === "zzz" ? 22 : inStrip ? 40 + Math.random() * 20 : 18 + Math.random() * 30, size = inStrip ? 1 : Math.max(1, k * 0.8);
      node.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${fy}%;--dx:${kind === "zzz" ? 26 * travel : dx}px;--dy:${dy}px;--s:${(0.7 + Math.random() * 0.7) * size};--r:${(Math.random() - 0.5) * 120}deg;--t:${kind === "zzz" ? 1.9 : 0.8 + Math.random() * 0.5}s;--c:${pick(FX_COLORS[kind])};animation-delay:${i * (kind === "spark" ? 30 : 110)}ms`;
      node.innerHTML = kind === "zzz" ? "z" : kind === "spark" ? (i % 3 ? SHAPES.spark : SHAPES.dot) : SHAPES.heart;
      node.addEventListener("animationend", () => node.remove());
      fx.appendChild(node);
    }
  }

  /* ---------- idle: a character waiting for input ---------- */
  function activity() {
    rt.lastInput = now(); rt.leaned = false;
    director?.activity();
    if (rt.asleep) { rt.asleep = false; react("poke", 800); say(LINES.wake); }
  }
  function tick() {
    if (!live() || rt.drag || rt.press || rt.thinking) return;
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
    director?.setPetted(false); director?.setHeld(true);
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
    if (a) {
      const size = { w: W, h: H }, pos = posFromPoint(rt.x, rt.y, a, size);
      rt.dock = dockForPos(pos, a, size);
      changePrefs({ pos, dock: rt.dock });
    }
    rt.drag = null; el.classList.remove("dragging");
    director?.setHeld(false);
    place(); pulse("land", 460); react("center", 300);
  }
  /** The corner a resize or pinch keeps still: his window's corner on the side he is docked to. */
  function growCorner(): { x: number; y: number; dock: Dock } {
    const dock = (el.dataset.dock ?? rt.dock) as Dock;
    return { x: dock[1] === "r" ? rt.x + W : rt.x, y: dock[0] === "b" ? rt.y + H : rt.y, dock };
  }
  /** Saves the size, and the spot too while he floats, so he stays where the hand let go. */
  function saveSize() {
    const a = area();
    if (!floating || !a) { changePrefs({ scale: k }); return; }
    const size = { w: W, h: H }, pos = posFromPoint(rt.x, rt.y, a, size);
    rt.dock = dockForPos(pos, a, size);
    changePrefs({ scale: k, pos, dock: rt.dock });
  }
  /** Arrow keys nudge him and Home sends him back to his corner. False when the key is not his to take. */
  function moveFromKeys(key: string, shift: boolean): boolean {
    const a = area();
    if (rt.mode !== "window" || !a || a.inRow) return false;
    const size = { w: W, h: H };
    if (key === "Home") { if (prefs.pos) changePrefs({ pos: null }); place(); return true; }
    const step = NUDGE.get(key);
    if (!step) return false;
    const px = NUDGE_PX * (shift ? 4 : 1);
    const pos = nudgePos(posFromPoint(rt.x, rt.y, a, size), step[0] * px, step[1] * px, a, size);
    rt.dock = dockForPos(pos, a, size);
    changePrefs({ pos, dock: rt.dock });
    place();
    return true;
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
    if (press.mode === "press" && Math.hypot(x - press.sx, y - press.sy) > 7) { press.mode = "pet"; cancel(longTimer); rt.pose = ""; setPose("pet"); director?.setPetted(true); }
    if (press.mode === "pet") {
      const outside = x < rt.x - 18 || x > rt.x + W + 18 || y < rt.y - 18 || y > rt.y + H + 18;
      if (outside && rt.mode === "window") { press.mode = "drag"; startDrag(x, y, press); }
      else if (now() - press.lastHeart > 300) { press.lastHeart = now(); burst("heart", 1); }
    }
    if (press.mode === "drag") dragTo(x, y);
  }, { signal });
  const release = () => {
    const press = rt.press;
    if (!press) return;
    cancel(longTimer); rt.press = null;
    director?.setPetted(false);
    if (press.mode === "press") { if (rt.pose === "celebrate") highFive(); else poke(); }
    else if (press.mode === "pet") react("pet", 750);
    else if (press.mode === "drag") endDrag();
  };
  hit.addEventListener("pointerup", release, { signal });
  hit.addEventListener("pointercancel", release, { signal });
  hit.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activity(); poke(); return; }
    if (moveFromKeys(event.key, event.shiftKey)) event.preventDefault();
  }, { signal });
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
    grow = growCorner();
    resize = { ax: grow.x, ay: grow.y, moved: false };
  }, { signal });
  sizer.addEventListener("pointermove", (event) => {
    if (!resize) return;
    if (!resize.moved) { resize.moved = true; sizing(true); }
    applyScale(scaleFromDrag(resize.ax, resize.ay, event.clientX, event.clientY), false);
  }, { signal });
  const endResize = () => {
    if (!resize) return;
    const dragged = resize.moved;
    resize = null; grow = null;
    if (!dragged) return;
    sizing(false); sizeClickUntil = now() + 350;
    saveSize();
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
    if (event.pointerType !== "touch" || rt.mode !== "window") return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size !== 2 || pinch) return;
    // A second finger turns the gesture into a pinch: whatever the first finger began is dropped.
    cancel(longTimer); rt.press = null;
    if (rt.drag) { rt.drag = null; el.classList.remove("dragging"); }
    director?.setHeld(false); director?.setPetted(false);
    rt.pose = ""; setPose("center");
    pinch = { start: Math.max(spread(), 24), from: k };
    grow = growCorner();
    sizing(true);
  }, { signal, capture: true });
  window.addEventListener("pointermove", (event) => {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && fingers.size >= 2) applyScale(pinch.from * (spread() / pinch.start), false);
  }, { signal, passive: true });
  const liftFinger = (event: PointerEvent) => {
    if (!fingers.delete(event.pointerId) || !pinch || fingers.size >= 2) return;
    pinch = null; grow = null; sizing(false);
    rt.pinchEndedAt = now();
    saveSize();
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
    applyCalm();
    if ("outfit" in patch) applyOutfit();
    options.onPrefs(patch);
  }
  /** Calm reaches his window and the living companion's motion at once. */
  function applyCalm() {
    calm = systemReduced || prefs.calm;
    el.toggleAttribute("data-calm", calm);
    director?.setReducedMotion(calm);
  }
  /** Where he is: seated, in his floating window, or in the strip. The strip needs its slot in this room. */
  const wanted = (): Mode => (prefs.seated || !surface() ? "seat" : prefs.host === "strip" && stripSlot() ? "strip" : "window");
  function sync() {
    const want = wanted();
    if (want === rt.mode) { ws.dataset.seat = want === "seat" ? "occupied" : "empty"; place(); return; }
    const was = rt.mode;
    rt.mode = want; rt.asleep = false; rt.drag = null; bubble.hidden = true; closeCard();
    cancel(seatTimer);
    if (want !== "seat" && was === "seat") {
      loadPoses();
      ws.dataset.seat = "empty";
      // He was parked on his seat, so the move to his corner reads as stepping out of it.
      el.dataset.state = "window"; activity(); place(); pulse("land", 460);
      react("support", 1200);
    } else if (want === "seat") {
      el.dataset.state = "seat"; place();
      seatTimer = later(() => { ws.dataset.seat = "occupied"; pulse("seatLand", 420, ws); }, calm ? 0 : 300);
    } else {
      // Window and strip: he changes place, not state, so he does not hop.
      ws.dataset.seat = "empty"; el.dataset.state = "window"; activity(); place();
    }
    syncMotion();
  }
  /** The window appears empty; he lands in it a moment later (the end of his leap from Home). */
  function arrive() {
    loadPoses();
    rt.mode = wanted(); rt.asleep = false;
    ws.dataset.seat = "empty";
    el.dataset.empty = ""; el.classList.add("noMove"); el.dataset.state = "window";
    place(); void el.offsetWidth; el.classList.remove("noMove");
    later(() => { delete el.dataset.empty; activity(); pulse("land", 460); react("celebrate", 1300); burst("spark", 10); }, calm ? 0 : 520);
  }
  host.querySelector<HTMLButtonElement>(".cmpMin")!.addEventListener("click", () => {
    rt.userSummoned = false;
    changePrefs({ seated: true }); sync(); tab.focus({ preventScroll: true });
  }, { signal });
  tab.addEventListener("click", () => {
    // Only an explicit learner request may relax the no-overlap fallback when
    // every automatic corner is blocked. Drag/seat remain available afterward.
    rt.userSummoned = rt.autoSeated;
    rt.autoSeated = false;
    changePrefs({ seated: false }); sync();
  }, { signal });

  /* ---------- his menu ---------- */
  let card: HTMLElement | null = null;
  /** His sill in his window and the strip's button both open the menu, so both say whether it is open. */
  const menuButtons = () => [sill, stripMenu];
  const menuButton = () => (rt.mode === "strip" ? stripMenu : sill);
  function closeCard() {
    if (!card) return;
    card.remove(); card = null;
    for (const button of menuButtons()) button.setAttribute("aria-expanded", "false");
    if (rt.mode !== "seat") menuButton().focus({ preventScroll: true });
  }
  function openCard() {
    closeCard();
    const outfitOptions = `<option value=""${prefs.outfit === null ? " selected" : ""}>None</option>${OUTFITS.map((outfit) => `<option value="${outfit}"${prefs.outfit === outfit ? " selected" : ""}>${OUTFIT_LABELS[outfit]}</option>`).join("")}`;
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
        ${prefs.host === "strip" ? "" : `<label class="cmpRange"><b>Size</b><small>Drag his corner handle, or pinch him on a phone.</small><input type="range" min="${MIN_SCALE * 100}" max="${MAX_SCALE * 100}" step="5" value="${Math.round(k * 100)}" data-set="scale" aria-label="Studigo's size"><output>${Math.round(k * 100)}%</output></label>`}
        <label class="cmpToggle"><b>Speech</b><small>A short line now and then. Off until you turn it on.</small><input type="checkbox" data-set="speech" ${prefs.speech ? "checked" : ""}></label>
        <label class="cmpToggle"><b>Fade while I scroll</b><small>He turns see-through so nothing under him is hidden.</small><input type="checkbox" data-set="tuck" ${prefs.tuck ? "checked" : ""}></label>
        <label class="cmpToggle"><b>Calm mode</b><small>Gentler, slower movement. No hops, spins or sparkles.</small><input type="checkbox" data-set="calm" ${prefs.calm ? "checked" : ""}></label>
        <div class="cmpChoice" role="group" aria-labelledby="cmpWhereTitle">
          <b id="cmpWhereTitle">Where he sits</b>
          <small>A floating window you can move, or a strip under the menu.</small>
          <div class="cmpSegment">
            <button type="button" data-host-choice="float" aria-pressed="${prefs.host === "float"}">Floating window</button>
            <button type="button" data-host-choice="strip" aria-pressed="${prefs.host === "strip"}">Strip under the menu</button>
          </div>
        </div>
        <label class="cmpChoice"><b>Outfit</b><small>Cosmetic only. It never changes his progress.</small><select data-set="outfit" aria-label="Studigo's outfit">${outfitOptions}</select></label>
        <div class="cmpCardActions">
          ${prefs.host === "strip" ? "" : `<button class="ghostButton" type="button" data-card="move">Move to the other side</button>`}
          <button class="ghostButton" type="button" data-card="seat">Send him back to his seat</button>
        </div>
      </section>`;
    wrap.addEventListener("click", (event) => {
      // Scoped to the card: the workspace above it carries data attributes of its own.
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-card]")?.dataset.card;
      if (action === "close") closeCard();
      if (action === "seat") { closeCard(); changePrefs({ seated: true }); sync(); }
      const choice = (event.target as HTMLElement).closest<HTMLElement>("[data-host-choice]")?.dataset.hostChoice;
      if (choice === "float" || choice === "strip") { changePrefs({ host: choice }); sync(); closeCard(); }
      if (action === "move") { rt.dock = `${rt.dock[0]}${rt.dock[1] === "r" ? "l" : "r"}` as Dock; changePrefs({ dock: rt.dock, pos: null }); closeCard(); place(); pulse("land", 460); }
      const play = action === "play" ? wrap.querySelector<HTMLElement>(".cmpPlay") : null;
      if (play) {
        const img = play.querySelector("img")!;
        img.src = `${SPRITES}/full/celebrate.webp`; pulse("playing", 900, play);
        later(() => { img.src = `${SPRITES}/full/center.webp`; }, 900);
      }
    });
    const readout = wrap.querySelector("output");
    wrap.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.set !== "scale") return;
      applyScale(Number(input.value) / 100, true);
      if (readout) readout.textContent = `${Math.round(k * 100)}%`;
    });
    wrap.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement, key = input.dataset.set;
      if (key === "speech" || key === "tuck" || key === "calm") changePrefs({ [key]: input.checked });
      if (key === "outfit") changePrefs({ outfit: parseOutfit((event.target as HTMLSelectElement).value) });
    });
    wrap.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeCard(); } });
    host.appendChild(wrap);
    card = wrap;
    for (const button of menuButtons()) button.setAttribute("aria-expanded", "true");
    wrap.querySelector<HTMLButtonElement>(".cmpSheetHead [data-card]")?.focus({ preventScroll: true });
  }
  for (const button of menuButtons()) button.addEventListener("click", () => { if (afterPinch()) return; pulse("pressed", 260, button); openCard(); }, { signal });
  bubble.addEventListener("click", () => { bubble.hidden = true; }, { signal });

  /* ---------- watching the room ---------- */
  const inHost = (target: EventTarget | null) => target instanceof Node && (host.contains(target) || el.contains(target));
  ws.addEventListener("pointermove", (event) => { if (!inHost(event.target)) lookAt(event.clientX, event.clientY, 1800); }, { signal, passive: true });
  ws.addEventListener("pointerdown", (event) => { if (!inHost(event.target)) { activity(); lookAt(event.clientX, event.clientY, 1500); } }, { signal, capture: true, passive: true });
  document.addEventListener("keydown", activity, { signal });
  /** On every keystroke he looks at where the words are appearing. */
  ws.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || inHost(input)) return;
    if (input instanceof HTMLInputElement && !["text", "search", ""].includes(input.type)) return;
    activity();
    if (!live() || now() < rt.reactUntil || rt.thinking) return;
    const r = input.getBoundingClientRect(), chars = Math.min(input.value.length, 26), e = eyes();
    const tx = r.left + 16 + chars * 8.4 - e.x, ty = r.top + r.height / 2 - e.y;
    // He reads along: eyes on where the words are appearing, down into the field.
    if (director) { const [x, y] = readingGaze(tx / (GAZE_REACH * e.scale), ty / (GAZE_REACH * e.scale)); director.lookAt(x, y, 1500, "drift"); rt.typingUntil = now() + 1500; return; }
    setPose(readingPose(tx, ty));
    rt.gazing = true; rt.typingUntil = now() + 1500;
    if (!calm) pulse("bob", 170);
  }, { signal });

  /* While the page scrolls up or down he stays exactly where he is and turns
     see-through, so nothing passing under him is hidden. Sideways scrolling (a
     row of chips) passes behind him and changes nothing. Only a real gesture
     counts: the app scrolling a new message into view does not. */
  let fadeTimer = 0, touchFrom: { x: number; y: number } | null = null;
  const sideways = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".chatChips, .coachTabs, .chatModes, .studyGroups"));
  const fadeForScroll = () => {
    rt.lastInput = now();
    if (!prefs.tuck || !live() || rt.drag || pinch || resize || now() < rt.steadyUntil) return;
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
  window.addEventListener("resize", schedulePlace, { signal });
  window.addEventListener("scroll", schedulePlace, { signal, passive: true });
  // Internal page scrollers do not bubble scroll events. Only the new non-chat
  // collision policy needs to follow them; leave Coach's locked geometry alone.
  ws.addEventListener("scroll", () => {
    if (ws.closest('.roomDevice[data-ui="phase3"]') && !shown(ws.querySelector(".chatComposer"))) schedulePlace();
  }, { signal, passive: true, capture: true });
  window.visualViewport?.addEventListener("resize", schedulePlace, { signal });
  window.visualViewport?.addEventListener("scroll", schedulePlace, { signal });
  ws.addEventListener("transitionend", (event) => { if (!inHost(event.target)) schedulePlace(); }, { signal });
  const sizes = new ResizeObserver(schedulePlace);
  sizes.observe(ws);
  const changes = new MutationObserver((records) => {
    if (!records.some((record) => !(host.contains(record.target) || el.contains(record.target)))) return;
    // The page changed under him: hold still for a moment, and catch up.
    rt.steadyUntil = now() + 700;
    schedulePlace();
    if (wanted() !== rt.mode) sync();
  });
  changes.observe(ws, { childList: true, subtree: true });

  /* The living companion runs on one animation loop, and only while he is out and the tab is showing. */
  function motionLoop(time: number) {
    motionFrame = 0;
    if (dead || !director) return;
    motionFrame = window.requestAnimationFrame(motionLoop);
    const frame = director.advance(time);
    renderer.apply(frame);
    for (const item of frame.fx) burst(item.kind, item.count);
    for (const cue of frame.cues) { if (cue === "lean") say(LINES.lean); else if (cue === "wake") say(LINES.wake); }
    if (frame.base === "asleep" && time > rt.nextZ) { burst("zzz", 1); rt.nextZ = time + 1500; }
    syncPose(frame.pose);
    glance(frame);
  }
  /** The pose the director names is the pose he is in. Changed only when it changes, so the CSS animations replay once. */
  function syncPose(pose: WindowPose | null) {
    const want: WindowPose = pose ?? "center";
    if (rt.pose !== want) stamp(want);
  }
  /** Idle glances on the drawn version's schedule: a look toward the page, up, down, or a gentle sway. Only while he is idle with nothing playing. */
  function glance(frame: MotionFrame) {
    const t = now();
    if (!director || frame.base !== "idle" || frame.beat !== null || rt.drag || rt.press || !live()) return;
    if (t < rt.reactUntil || t < rt.typingUntil || t < rt.gazeUntil || t <= rt.nextGlance) return;
    rt.nextGlance = t + 4800 + Math.random() * 4200;
    const toward: GazePose = el.dataset.side === "r" ? "left" : "right";
    const move = pick<GazePose | "sway">([toward, toward, "up", `down-${toward}` as GazePose, "sway"]);
    if (move === "sway") { director.play("sway"); return; }
    director.lookAt(move.endsWith("left") ? -0.9 : move.endsWith("right") ? 0.9 : 0, move === "up" ? -0.8 : move.startsWith("down") ? 0.7 : 0, 850);
    rt.gazeUntil = t + 850;
  }
  function syncMotion() {
    if (!director) return;
    const on = live() && !document.hidden;
    director.setVisible(on);
    if (on && !motionFrame) motionFrame = window.requestAnimationFrame(motionLoop);
    else if (!on && motionFrame) { window.cancelAnimationFrame(motionFrame); motionFrame = 0; }
  }
  document.addEventListener("visibilitychange", syncMotion, { signal });
  if (!director && !heartbeat) heartbeat = window.setInterval(tick, 320);
  applyCalm();
  applyScale(prefs.scale, false);
  if (options.arriving && !prefs.seated && surface()) arrive(); else sync();
  syncMotion();

  /* A lesson opened or a guide became ready. One brief nod, or nothing if he is minimized or motion is reduced. */
  const quietSeen = new Set<string>();
  function acknowledgeQuiet(detail: QuietFeedbackDetail) {
    const acknowledged = Array.from(new Set([...detail.acknowledged, ...quietSeen]));
    const decision = quietFeedback({
      phase: detail.phase,
      kind: detail.kind,
      eventKey: detail.eventKey,
      acknowledged,
      reducedMotion: calm,
      minimized: rt.mode !== "window" && rt.mode !== "strip"
    });
    for (const key of decision.acknowledged) quietSeen.add(key);
    if (decision.animate) pulse("quietAck", 700);
    return decision;
  }
  document.addEventListener(QUIET_FEEDBACK_EVENT, (event) => {
    const detail = (event as CustomEvent<QuietFeedbackDetail>).detail;
    if (!detail || detail.decision || dead) return;
    detail.decision = acknowledgeQuiet(detail);
  }, { signal });

  return {
    event(name) {
      if (dead) return;
      activity();
      if (name === "correct") rt.streak += 1;
      else if (name === "wrong" || name === "blindspot") rt.streak = 0;
      if (rt.mode === "seat") {
        // From his seat he still notices: the avatar gives a small bounce.
        if (name === "correct" || name === "setDone" || name === "cardGood") pulse("seatLand", 420, ws);
        return;
      }
      const reaction = reactionFor(name, rt.streak);
      if (director) {
        // The director picks the motion and its sparks from the same committed event; only the line is chosen here.
        director.onEvent(name);
        if (reaction.lines && (reaction.always || Math.random() < 0.35)) say(reaction.lines);
        return;
      }
      react(reaction.pose, reaction.ms);
      if (reaction.sparks) burst("spark", reaction.sparks);
      if (reaction.lines && (reaction.always || Math.random() < 0.35)) say(reaction.lines);
    },
    thinking(on) {
      if (dead || rt.thinking === on) return;
      rt.thinking = on;
      el.classList.toggle("thinking", on);
      director?.setThinking(on);
      if (!live()) return;
      activity();
      rt.pose = ""; setPose(on ? "up" : "center");
    },
    setTone(tone) {
      if (el.dataset.tone !== tone) {
        // Don't carry an explicit summon override into the next study page.
        rt.userSummoned = false;
        el.dataset.tone = tone;
        schedulePlace();
      }
    },
    setPrefs(next) {
      if (dead) return;
      const outfitChanged = next.outfit !== prefs.outfit;
      prefs = next;
      applyCalm();
      if (outfitChanged) applyOutfit();
      if (next.seated) rt.userSummoned = false;
      if (!rt.drag) rt.dock = next.dock;
      if (!next.speech) bubble.hidden = true;
      if (!pinch && !resize) desired = next.scale;
      sync();
    },
    play(beat) { if (!dead) director?.play(beat); },
    destroy() {
      dead = true;
      lifetime.abort();
      window.clearInterval(heartbeat);
      window.cancelAnimationFrame(motionFrame);
      try { renderer.destroy(); } catch { /* nothing left to release */ }
      window.cancelAnimationFrame(placeFrame);
      timers.forEach((id) => window.clearTimeout(id));
      sizes.disconnect(); changes.disconnect();
      stripSlot()?.removeAttribute("data-on");
      el.remove(); stripBox.remove();
      host.innerHTML = "";
      ["--dock-r", "--dock-l", "--dock-thread", "--dock-page"].forEach((name) => ws.style.removeProperty(name));
      delete ws.dataset.seat;
      ws.classList.remove("seatLand");
    }
  };
}
