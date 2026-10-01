"use client";

import { useEffect } from "react";

/* One Studigo, three places: inside the demo phone in the hero, loose on the
   page (he leaps out when you scroll and reacts to each section), and on his
   stage in the closing field. The intro puts him in the phone to begin with.
   The page is plain server-rendered markup; this drives it from the outside. */

const POSES = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "wave", "leap", "celebrate", "read"] as const;
type Pose = (typeof POSES)[number];
const MIRROR: Partial<Record<Pose, Pose>> = { "up-left": "up-right", "down-left": "down-right" };
const GAZE: Record<string, Pose> = { "0": "right", "1": "down-right", "2": "down", "3": "down-left", "4": "left", "-4": "left", "-3": "up-left", "-2": "up", "-1": "up-right" };
const SPRITES = "/demo/assets/full";
const INTRO_SEEN = "studigo.intro";
const SHAPES = {
  heart: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 14.2 2.6 8.9a3.5 3.5 0 0 1 5-4.9l.4.4.4-.4a3.5 3.5 0 0 1 5 4.9Z"/></svg>',
  spark: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z"/></svg>'
} as const;

type Box = { x: number; y: number; size: number };
type Rect = { x: number; y: number; w: number; h: number };
type Place = "phone" | "dock" | "cta";
type Side = "right" | "left";
type PhoneMessage = { type?: string; id?: number; rect?: Rect };

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const now = () => performance.now();

function startHome(): () => void {
  const root = document.querySelector<HTMLElement>(".home");
  const find = <T extends HTMLElement>(selector: string) => root?.querySelector<T>(selector) ?? null;
  const phone = find<HTMLIFrameElement>("#homePhone"), phoneFrame = find("#homePhoneFrame"), hero = find("#top"), ctaSpot = find("#homeCtaSpot");
  const guide = find("#homeGuide"), guideBody = find("#homeGuideBody"), bubble = find<HTMLButtonElement>("#homeGuideSay"), guideFx = find("#homeGuideFx");
  if (!root || !phone || !phoneFrame || !hero || !ctaSpot || !guide || !guideBody || !bubble || !guideFx) return () => {};

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const narrow = () => window.innerWidth < 961;

  /* Everything started here is torn down when the page unmounts. */
  const lifetime = new AbortController();
  const { signal } = lifetime;
  let dead = false;
  const timers = new Set<number>();
  const observers: IntersectionObserver[] = [];
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const wait = (ms: number) => new Promise<void>((resolve) => { later(resolve, ms); });

  /* ---------- talking to the phone ---------- */
  let phoneReady = false, seq = 0;
  const pending = new Map<number, (rect: Rect) => void>();
  const readyWaiters: Array<() => void> = [];
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== phone.contentWindow || event.origin !== window.location.origin) return;
    const data = (event.data ?? {}) as PhoneMessage;
    if (data.type === "studigo:ready") { phoneReady = true; readyWaiters.splice(0).forEach((fn) => fn()); }
    if (data.type === "studigo:left" && data.id !== undefined && data.rect) { pending.get(data.id)?.(data.rect); pending.delete(data.id); }
  }, { signal });
  const whenReady = () => new Promise<void>((resolve) => { if (phoneReady) resolve(); else { readyWaiters.push(resolve); later(resolve, 2500); } });
  const tell = (message: Record<string, unknown>) => { try { phone.contentWindow?.postMessage(message, window.location.origin); } catch { /* the phone is optional */ } };
  /** Ask him to step out of the phone; resolves with where his window is on this page. */
  const borrow = () => new Promise<Rect>((resolve) => {
    const frame = () => phone.getBoundingClientRect();
    const id = ++seq;
    const timer = later(() => {
      pending.delete(id);
      const f = frame();
      resolve({ x: f.left + f.width * 0.67, y: f.top + f.height * 0.73, w: f.width * 0.22, h: f.width * 0.22 });
    }, 450);
    pending.set(id, (rect) => { window.clearTimeout(timer); timers.delete(timer); const f = frame(); resolve({ x: f.left + rect.x, y: f.top + rect.y, w: rect.w, h: rect.h }); });
    tell({ type: "studigo:leave", id });
  });

  /* ---------- Studigo on the page ---------- */
  const imgs = new Map<Pose, HTMLImageElement>();
  let pose: Pose | "" = "", rest: Pose = "center", box: Box = { x: 0, y: 0, size: 160 }, where: Place = "phone";
  let flying = false, busyUntil = 0, gazeUntil = 0, sayTimer = 0;
  let press: { x: number; y: number; mode: "press" | "pet"; last: number } | null = null;
  let flight: Animation | null = null;
  const said = new Set<string>();

  const showGuide = (on: boolean) => { guide.hidden = !on; guide.tabIndex = on ? 0 : -1; };
  const setPose = (name: Pose) => {
    if (pose === name) return;
    pose = name;
    imgs.forEach((img, key) => img.classList.toggle("on", key === name));
    if (guide.dataset.pose === name) { guide.dataset.pose = ""; void guide.offsetWidth; }
    guide.dataset.pose = name;
  };
  const react = (name: Pose, ms: number) => { busyUntil = now() + ms; pose = ""; setPose(name); };
  const burst = (kind: keyof typeof SHAPES, count: number) => {
    if (reduced) return;
    const colors = kind === "heart" ? ["var(--berry)", "#ff7aa2"] : ["var(--dandelion)", "var(--kiwi)", "var(--tangerine)", "var(--teal)"];
    const reach = box.size / 110;
    for (let i = 0; i < count; i += 1) {
      const node = document.createElement("span");
      node.className = "gfx";
      node.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${18 + Math.random() * 30}%;--dx:${(Math.random() - 0.5) * 150 * reach}px;--dy:${(-40 - Math.random() * 80) * reach}px;--s:${0.8 + Math.random() * 0.8};--r:${(Math.random() - 0.5) * 120}deg;--t:${0.8 + Math.random() * 0.5}s;--c:${colors[Math.floor(Math.random() * colors.length)]};animation-delay:${i * 35}ms`;
      node.innerHTML = SHAPES[kind];
      node.addEventListener("animationend", () => node.remove());
      guideFx.appendChild(node);
    }
  };
  const poke = () => { react("celebrate", 950); burst("spark", 7); };
  const place = (to: Box, still: boolean) => {
    box = to;
    if (still) guide.classList.add("still");
    guide.style.setProperty("--gs", `${to.size}px`);
    guide.style.setProperty("--gx", `${to.x}px`);
    guide.style.setProperty("--gy", `${to.y}px`);
    if (still) { void guide.offsetWidth; guide.classList.remove("still"); }
  };
  const say = (text: string) => {
    if (said.has(text)) return;
    said.add(text);
    bubble.textContent = text;
    bubble.hidden = true; void bubble.offsetWidth; bubble.hidden = false;
    window.clearTimeout(sayTimer); timers.delete(sayTimer);
    sayTimer = later(() => { bubble.hidden = true; }, 3000);
  };
  const look = (x: number, y: number) => {
    if (where === "phone" || flying || press || rest !== "center" || now() < busyUntil) return;
    const dx = x - (box.x + box.size / 2), dy = y - (box.y + box.size * 0.3);
    const far = Math.hypot(dx, dy) > box.size * 0.42;
    setPose(far ? GAZE[String(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)))] ?? "center" : "center");
    gazeUntil = now() + 1500;
  };
  const tick = () => {
    if (where === "phone" || flying || press) return;
    const t = now();
    if (t > busyUntil && t > gazeUntil && pose !== rest) setPose(rest);
  };
  /** One leap from where he is to a new spot. */
  const fly = (to: Box) => {
    const from = box;
    if (reduced) { place(to, true); return Promise.resolve(); }
    return new Promise<void>((resolve) => {
      flying = true; bubble.hidden = true;
      const mirror = to.x + to.size / 2 < from.x + from.size / 2;
      guide.classList.toggle("mirror", mirror); guide.classList.add("flying");
      place(to, true); guide.style.transformOrigin = "0 0";
      pose = ""; setPose("leap");
      const s0 = from.size / to.size, lift = Math.max(12, Math.min(from.y, to.y) - 130);
      const at = (x: number, y: number, s: number, r: number) => `translate(${x}px, ${y}px) scale(${s}) rotate(${mirror ? -r : r}deg)`;
      let ended = false;
      const animation = guide.animate([
        { transform: at(from.x, from.y, s0, 0), easing: "cubic-bezier(.4,0,.6,1)" },
        { transform: at(from.x, from.y + 14 * s0, s0 * 1.04, -6), offset: 0.14, easing: "cubic-bezier(.2,.7,.3,1)" },
        { transform: at(from.x + (to.x - from.x) * 0.45, lift, s0 + (1 - s0) * 0.5, 8), offset: 0.55, easing: "cubic-bezier(.5,0,.8,.6)" },
        { transform: at(to.x, to.y, 1, 2) }
      ], { duration: 880, fill: "forwards" });
      flight = animation;
      const land = () => {
        if (ended) return;
        ended = true; animation.cancel(); flight = null;
        guide.style.transformOrigin = ""; guide.classList.remove("flying", "mirror"); flying = false;
        pose = ""; setPose(rest);
        resolve();
      };
      // A hidden tab can stall the animation; the timer lands him regardless.
      animation.finished.then(land, land);
      later(land, 1150);
    });
  };
  const mountGuide = () => {
    guideBody.innerHTML = POSES.map((name) => `<img data-pose="${name}" ${MIRROR[name] ? "data-flip" : ""} src="${SPRITES}/${MIRROR[name] ?? name}.webp" alt="" draggable="false">`).join("");
    guideBody.querySelectorAll<HTMLImageElement>("img").forEach((img) => imgs.set(img.dataset.pose as Pose, img));
    setPose("center");
    guide.addEventListener("pointerdown", (event) => {
      if (flying) return;
      event.preventDefault();
      press = { x: event.clientX, y: event.clientY, mode: "press", last: 0 };
      guide.setPointerCapture(event.pointerId);
    }, { signal });
    guide.addEventListener("pointermove", (event) => {
      if (!press) return;
      if (press.mode === "press" && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { press.mode = "pet"; setPose("up"); guide.classList.add("petting"); }
      if (press.mode === "pet" && now() - press.last > 280) { press.last = now(); burst("heart", 1); }
    }, { signal });
    const release = () => {
      const was = press;
      if (!was) return;
      press = null; guide.classList.remove("petting");
      if (was.mode === "pet") react("up", 700); else poke();
    };
    guide.addEventListener("pointerup", release, { signal });
    guide.addEventListener("pointercancel", release, { signal });
    guide.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); poke(); } }, { signal });
    bubble.addEventListener("click", (event) => { event.stopPropagation(); bubble.hidden = true; }, { signal });
    bubble.addEventListener("pointerdown", (event) => event.stopPropagation(), { signal });
  };

  let side: Side = "right", lastHop = 0;
  const dockBox = (at: Side = side): Box => {
    const size = narrow() ? 112 : 172, pad = narrow() ? 4 : 22;
    return { size, x: at === "right" ? window.innerWidth - size - pad : pad, y: window.innerHeight - size - (narrow() ? 6 : 14) };
  };
  /** How much of a dock corner sits on top of something a visitor would read or press (0 to 9). */
  const crowding = (at: Side) => {
    const spot = dockBox(at);
    let hits = 0;
    for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.2, 0.5, 0.8]) {
      const under = document.elementsFromPoint(spot.x + spot.size * fx, spot.y + spot.size * fy).find((el) => !guide.contains(el));
      if (!under) continue;
      const media = /^(img|iframe|video|button|a|input|summary|svg|path|circle|rect)$/i.test(under.tagName);
      if (media || Array.from(under.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) hits += 1;
    }
    return hits;
  };
  const faceSide = (next: Side) => { side = next; guide.classList.toggle("onLeft", next === "left"); };
  const spotBox = (): Box => { const r = ctaSpot.getBoundingClientRect(), size = r.width * 0.9; return { size, x: r.left + (r.width - size) / 2, y: r.bottom - 34 - size * 0.962 }; };
  const windowBox = (rect: Rect): Box => { const size = rect.w * 2.35; return { size, x: rect.x + rect.w / 2 - size / 2, y: rect.y + rect.h / 2 - size * 0.27 }; };

  /* ---------- where he should be, given the scroll position ---------- */
  let moving = false, introDone = false, ticking = false, settleTimer = 0;
  let section: HTMLElement | null = null;
  const applySection = (arrived: boolean) => {
    if (where !== "dock" || !section) return;
    const mood = section.dataset.guide;
    rest = mood === "read" ? "read" : "center";
    if (mood === "wave") react("wave", 1700);
    else if (mood === "celebrate") { react("celebrate", 1300); burst("spark", 9); }
    else if (!arrived || mood === "read") { pose = ""; setPose(rest); }
    const line = section.dataset.say;
    if (line) later(() => { if (where === "dock") say(line); }, 350);
  };
  const go = async (target: Place) => {
    if (moving || where === target) return;
    moving = true;
    if (target === "dock") faceSide(crowding("left") < crowding("right") ? "left" : "right");
    if (where === "phone") {
      const rect = await borrow();
      if (dead) return;
      rest = "center"; place(windowBox(rect), true); showGuide(true);
      await fly(target === "cta" ? spotBox() : dockBox());
    } else if (target === "phone") {
      rest = "center";
      const rect = await borrow();
      if (dead) return;
      await fly(windowBox(rect));
      showGuide(false); tell({ type: "studigo:return" });
    } else {
      await fly(target === "cta" ? spotBox() : dockBox());
    }
    if (dead) return;
    where = target; moving = false;
    if (target === "cta") { rest = "wave"; setPose("wave"); burst("spark", 10); }
    if (target === "dock") applySection(true);
    onScroll();
  };
  /** He takes the other corner when the one he is in covers what you are reading. */
  const settle = async () => {
    if (dead || where !== "dock" || moving || flying || press || now() - lastHop < 1200) return;
    const other: Side = side === "right" ? "left" : "right";
    const here = crowding(side);
    if (here < 3 || crowding(other) > here - 3) return;
    lastHop = now(); moving = true;
    faceSide(other);
    await fly(dockBox());
    if (dead) return;
    moving = false;
    onScroll();
  };
  function onScroll() {
    if (dead) return;
    window.clearTimeout(settleTimer); timers.delete(settleTimer);
    settleTimer = later(() => { void settle(); }, 260);
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (dead) return;
      const y = window.scrollY;
      if (!reduced && !narrow()) phoneFrame!.style.transform = `translateY(${(-y * 0.05).toFixed(1)}px) rotate(${clamp(y * 0.004, 0, 2.2).toFixed(2)}deg)`;
      if (!introDone || moving) return;
      const pr = phoneFrame!.getBoundingClientRect();
      const visible = clamp((Math.min(pr.bottom, window.innerHeight) - Math.max(pr.top, 0)) / pr.height, 0, 1);
      const cr = ctaSpot!.getBoundingClientRect();
      const atCta = cr.top < window.innerHeight * 0.74 && cr.bottom > window.innerHeight * 0.34;
      const inPhone = where === "phone" ? visible > 0.45 : visible > 0.82;
      const target: Place = inPhone ? "phone" : atCta ? "cta" : "dock";
      if (target !== where) void go(target);
      else if (where === "cta") place(spotBox(), true);
      else if (where === "dock") place(dockBox(), true);
    });
  }

  /* ---------- the intro: the device wakes, he leaps in, then jumps into the phone ---------- */
  const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("in"); reveal.unobserve(entry.target); }
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  observers.push(reveal);
  const startPage = () => { root.querySelectorAll(".rv").forEach((node) => reveal.observe(node)); introDone = true; onScroll(); };
  const intro = async () => {
    const overlay = find("#homeIntro"), screenEl = find("#homeIntroScreen"), skip = find("#homeIntroSkip");
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN) === "1"; } catch { /* storage is optional */ }
    // The overlay only displays where the stylesheet allowed it (script and motion both on).
    const showing = Boolean(overlay) && getComputedStyle(overlay!).display !== "none";
    if (!overlay || !screenEl || !showing || reduced || seen || window.scrollY > 40) {
      if (overlay) overlay.dataset.state = "off";
      startPage();
      return;
    }
    overlay.dataset.live = "1";
    let skipped = overlay.dataset.skipped === "1";
    skip?.addEventListener("click", () => { skipped = true; }, { signal });
    const pause = async (ms: number) => { const end = now() + ms; while (!skipped && !dead && now() < end) await wait(40); };
    document.body.style.overflow = "hidden";
    guide.style.zIndex = "95";
    void whenReady().then(borrow);
    // The wake itself is a CSS animation that began with the first paint.
    await pause(Math.max(0, (Number(overlay.dataset.t) || now()) + 1250 - now()));
    if (dead) return;
    if (!skipped) {
      const sr = screenEl.getBoundingClientRect(), size = sr.width * 0.86;
      const stand: Box = { size, x: sr.left + (sr.width - size) / 2, y: sr.bottom - 34 - size * 0.962 };
      rest = "wave";
      place({ size: size * 0.7, x: stand.x - window.innerWidth * 0.42, y: window.innerHeight * 0.72 }, true);
      showGuide(true);
      await fly(stand);
      burst("spark", 12);
      await pause(1250);
      if (dead) return;
    }
    try { sessionStorage.setItem(INTRO_SEEN, "1"); } catch { /* storage is optional */ }
    document.body.style.overflow = "";
    overlay.classList.add("out");
    later(() => { overlay.dataset.state = "off"; overlay.classList.remove("out"); }, 700);
    root.querySelectorAll(".hero .rv").forEach((node) => node.classList.add("in"));
    rest = "center";
    if (!skipped) {
      await whenReady();
      const rect = await borrow();
      if (dead) return;
      await fly(windowBox(rect));
      if (dead) return;
    }
    showGuide(false); guide.style.zIndex = ""; tell({ type: "studigo:return" });
    where = "phone";
    startPage();
  };

  /* ---------- the rest of the page ---------- */
  const shells = find("#homeShells");
  shells?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-shell]");
    if (!button) return;
    shells.querySelectorAll("[data-shell]").forEach((item) => item.setAttribute("aria-checked", String(item === button)));
    hero.dataset.room = button.dataset.shell;
    tell({ type: "studigo:tone", tone: button.dataset.shell });
  }, { signal });

  /** Modes: the device holds still while the room changes mode and color. */
  const grid = find(".modesGrid"), device = find("#homeModeDevice"), host = find("#homeModeHost"), modeName = find("#homeModeName");
  const steps = Array.from(root.querySelectorAll<HTMLElement>(".modeStep"));
  if (grid && device && host && modeName && steps.length) {
    let current: HTMLElement | null = null;
    const show = (step: HTMLElement) => {
      if (step === current) return;
      current = step;
      steps.forEach((item) => item.classList.toggle("on", item === step));
      device.dataset.tone = step.dataset.tone;
      modeName.textContent = step.dataset.mode ?? "";
      const copy = document.createElement("div");
      copy.className = "modeScreenCopy";
      copy.dataset.tone = step.dataset.tone;
      copy.innerHTML = step.querySelector(".modeScreen")?.innerHTML ?? "";
      host.replaceChildren(copy);
    };
    const setup = () => {
      const pinned = !narrow();
      grid.classList.toggle("pinned", pinned);
      if (pinned && !current) show(steps[0]);
      if (!pinned) steps.forEach((item) => item.classList.add("on"));
    };
    setup();
    window.addEventListener("resize", setup, { signal });
    const stepWatch = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting && grid.classList.contains("pinned")) show(entry.target as HTMLElement);
    }), { rootMargin: "-46% 0px -46% 0px" });
    steps.forEach((step) => stepWatch.observe(step));
    observers.push(stepWatch);
  }

  const sectionWatch = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting && entry.target !== section) { section = entry.target as HTMLElement; applySection(false); }
  }), { rootMargin: "-40% 0px -40% 0px" });
  root.querySelectorAll("[data-guide]").forEach((node) => sectionWatch.observe(node));
  observers.push(sectionWatch);

  root.dataset.motion = "on";
  mountGuide();
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", onScroll, { signal });
  window.addEventListener("pointermove", (event) => { if (fine) look(event.clientX, event.clientY); }, { passive: true, signal });
  window.addEventListener("pointerdown", (event) => { if (!(event.target as HTMLElement).closest("#homeGuide")) look(event.clientX, event.clientY); }, { passive: true, signal });
  const heartbeat = window.setInterval(tick, 300);
  void intro();

  return () => {
    dead = true;
    lifetime.abort();
    window.clearInterval(heartbeat);
    timers.forEach((id) => window.clearTimeout(id));
    observers.forEach((observer) => observer.disconnect());
    flight?.cancel();
    document.body.style.overflow = "";
    guide.style.zIndex = ""; guide.style.transformOrigin = ""; guide.classList.remove("flying", "mirror", "petting");
    showGuide(false);
    delete root.dataset.motion;
  };
}

export function HomeMotion() {
  useEffect(() => startHome(), []);
  return null;
}
