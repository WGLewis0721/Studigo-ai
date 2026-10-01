/* The Studigo companion. One character who watches what you do and reacts with
   gaze, body language and (rarely) a short line.

   He has three places, and is only ever in one of them:
   - the stage: full body, on Home and in onboarding;
   - his window: waist-up, on the pages where he has a job (Coach, Practice);
   - his seat: the round avatar in the page header, everywhere else or when sent back.

   Concept demo: timings are shortened so every behavior shows up in a minute. */
(function () {
  "use strict";

  const W = 100, H = 120;
  const LEAN_AT = 12000, SLEEP_AT = 26000;
  const KEY = "studigo.companion.demo.v2";
  const POSES = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "celebrate", "support", "pet", "poke", "lean", "sleep"];
  const FULL = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "wave", "leap", "celebrate", "read"];
  const MIRROR = { "up-left": "up-right", "down-left": "down-right" };
  const POP = { celebrate: 1, lean: 1, poke: 1 };
  const LINES = {
    wrong: ["That's okay — try the next one.", "Close. We'll get it.", "Good try. Keep going."],
    blindspot: ["Worth a second look."],
    correct: ["Yes!", "Nice."],
    streak: ["Three in a row!"],
    setDone: ["Set done. Nice work."],
    lean: ["Ready when you are.", "Take your time."],
    wake: ["…I'm up."],
    tickle: ["Hey, that tickles."]
  };
  const MOODS = { center: "Relaxed", celebrate: "Proud", support: "Encouraging", pet: "Happy", poke: "Giggly", lean: "Waiting on you", sleep: "Dozing", wave: "Saying hello", read: "Reading", leap: "On his way", up: "Happy" };

  const now = () => performance.now();
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fresh = () => ({ pets: 0, pokes: 0, highFives: 0, answers: 0, correct: 0, dismissed: 0, seated: 0, chatty: 0.8, quiet: false, tuck: true });
  let st = fresh();
  try { st = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (error) { /* storage is optional */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (error) { /* storage is optional */ } };

  const rt = {
    mode: "seat", hasJob: false, userSeated: false, dock: "br", pose: "center", x: 0, y: 0,
    reactUntil: 0, reacting: null, gazeUntil: 0, gazing: false, typingUntil: 0, thinking: false, asleep: false, leaned: false,
    lastInput: now(), nextBlink: now() + 2200, nextGlance: now() + 5200, nextZ: 0, streak: 0, spokeAt: 0, pokeAt: 0, pokeCombo: 0,
    press: null, drag: null, steadyUntil: 0
  };

  let screen, el, bubble, fx, poseEls = {}, sayTimer = 0, tuckTimer = 0, longTimer = 0, seatTimer = 0, listeners = [];

  /* ---------- geometry ---------- */
  const scale = () => { const r = screen.getBoundingClientRect(); return r.width / screen.offsetWidth || 1; };
  function local(event) { const r = screen.getBoundingClientRect(), s = scale(); return { x: (event.clientX - r.left) / s, y: (event.clientY - r.top) / s }; }
  function rel(node) {
    const r = node.getBoundingClientRect(), sr = screen.getBoundingClientRect(), s = scale();
    return { left: (r.left - sr.left) / s, top: (r.top - sr.top) / s, right: (r.right - sr.left) / s, bottom: (r.bottom - sr.top) / s, width: r.width / s, height: r.height / s };
  }
  const workspace = () => screen.querySelector(".roomWorkspace");
  /** Where his window may sit: under the page header, above the lowest control cluster. */
  function area() {
    const ws = rel(workspace());
    const chips = screen.querySelector(".mhChipBar");
    const head = chips && chips.childElementCount ? chips : screen.querySelector(".modeFrame");
    const composer = screen.querySelector(".chatComposer");
    const kbOpen = screen.dataset.keyboard === "open";
    let bottom, inRow = false;
    if (composer) { bottom = rel(composer).bottom - 6; inRow = true; }
    else if (kbOpen) bottom = ws.bottom - 10;
    else bottom = rel(screen.querySelector(".studyGroups")).top - 6;
    return { top: rel(head).bottom + 8, bottom, left: ws.left + 10, right: ws.right - 10, inRow };
  }
  const spot = (dock, a) => ({ x: dock[1] === "r" ? a.right - W : a.left, y: dock[0] === "b" ? a.bottom - H : a.top });
  function seatSpot() {
    const seat = screen.querySelector(".chatMascot");
    if (!seat) return { x: 14, y: 110 };
    const r = rel(seat);
    return { x: r.left + r.width / 2 - W / 2, y: r.top + r.height / 2 - H / 2 };
  }
  /** He never sits on a control you need. If his corner covers one and the page
      cannot scroll it clear, he takes the nearest free corner instead. */
  function freeDock(a) {
    const surface = screen.querySelector(".modeSurface");
    if (a.inRow || surface.scrollHeight - surface.clientHeight - surface.scrollTop > 8) return rt.dock;
    const controls = Array.from(surface.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")).map(rel).filter((r) => r.width && r.bottom > a.top && r.top < a.bottom);
    const blocked = (dock) => { const p = spot(dock, a); return controls.some((r) => Math.max(0, Math.min(p.x + W, r.right) - Math.max(p.x, r.left)) * Math.max(0, Math.min(p.y + H, r.bottom) - Math.max(p.y, r.top)) > 900); };
    const other = rt.dock[1] === "r" ? "l" : "r";
    return [rt.dock, rt.dock[0] + other, (rt.dock[0] === "b" ? "t" : "b") + rt.dock[1], (rt.dock[0] === "b" ? "t" : "b") + other].find((dock) => !blocked(dock)) || rt.dock;
  }
  function place() {
    if (!screen) return;
    const ws = workspace(), out = rt.mode === "window";
    const setVars = (r, l, thread, page) => { ws.style.setProperty("--dock-r", r); ws.style.setProperty("--dock-l", l); ws.style.setProperty("--dock-thread", thread); ws.style.setProperty("--dock-page", page); };
    if (!out) {
      const seat = seatSpot();
      rt.x = seat.x; rt.y = seat.y;
      el.style.setProperty("--x", rt.x + "px"); el.style.setProperty("--y", rt.y + "px");
      setVars("0px", "0px", "0px", "0px");
    } else {
      const a = area(), dock = rt.drag ? rt.dock : freeDock(a);
      const bottomDock = dock[0] === "b", right = dock[1] === "r";
      if (!rt.drag) {
        rt.x = spot(dock, a).x; rt.y = spot(dock, a).y;
        el.style.setProperty("--x", rt.x + "px"); el.style.setProperty("--y", rt.y + "px");
      }
      el.dataset.side = right ? "r" : "l";
      // The page makes room for him instead of being covered by him.
      const row = a.inRow && bottomDock;
      setVars(row && right ? "108px" : "0px", row && !right ? "108px" : "0px", row ? "18px" : "0px", !a.inRow && bottomDock ? "104px" : "0px");
    }
    Stage.sync();
  }

  /* ---------- poses ---------- */
  function setPose(name) {
    if (rt.pose === name) return;
    rt.pose = name;
    for (const key in poseEls) poseEls[key].classList.toggle("on", key === name);
    // Re-entering the same pose (a second poke) replays its movement.
    if (el.dataset.pose === name) { el.dataset.pose = ""; void el.offsetWidth; }
    el.dataset.pose = name;
    if (POP[name]) el.dataset.pop = ""; else delete el.dataset.pop;
    emit();
  }
  /** A reaction outranks gaze and idle until it runs out. */
  function react(name, ms) {
    rt.reacting = name; rt.reactUntil = now() + ms; rt.gazing = false;
    setPose(name);
  }
  function pulse(cls, ms, node) { node = node || el; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }
  function dirPose(dx, dy, dead) {
    if (Math.hypot(dx, dy) < (dead || 54)) return "center";
    const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return { "0": "right", "1": "down-right", "2": "down", "3": "down-left", "4": "left", "-4": "left", "-3": "up-left", "-2": "up", "-1": "up-right" }[step];
  }
  function lookAt(px, py, hold) {
    if (rt.mode !== "window" || rt.drag || rt.press || rt.asleep || rt.thinking || now() < rt.reactUntil) return;
    setPose(dirPose(px - (rt.x + W / 2), py - (rt.y + 46)));
    rt.gazing = true; rt.gazeUntil = now() + (hold || 2000);
  }

  /* ---------- speech and particles ---------- */
  function say(lines, force) {
    if (st.quiet || rt.mode !== "window") return false;
    if (!force && Math.random() > st.chatty) return false;
    bubble.textContent = Array.isArray(lines) ? pick(lines) : lines;
    bubble.hidden = true; void bubble.offsetWidth; bubble.hidden = false;
    rt.spokeAt = now();
    clearTimeout(sayTimer); sayTimer = setTimeout(() => { bubble.hidden = true; }, 2900);
    return true;
  }
  const SHAPES = {
    heart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14.2 2.6 8.9a3.5 3.5 0 0 1 5-4.9l.4.4.4-.4a3.5 3.5 0 0 1 5 4.9Z"/></svg>',
    spark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z"/></svg>',
    dot: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>'
  };
  function burst(kind, count, into, big) {
    if (reduced && kind !== "zzz") count = Math.min(count, 2);
    const colors = { heart: ["var(--berry)", "#ff7aa2"], spark: ["var(--dandelion)", "var(--kiwi)", "var(--tangerine)", "var(--teal)"], zzz: ["var(--indigo)"] }[kind];
    const reach = big ? 1.8 : 1;
    for (let i = 0; i < count; i += 1) {
      const node = document.createElement("span");
      node.className = "fx";
      const spread = (kind === "spark" ? 150 : 70) * reach;
      const dx = (Math.random() - 0.5) * spread, dy = (kind === "spark" ? -30 - Math.random() * 90 : -50 - Math.random() * 40) * reach;
      node.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${kind === "zzz" ? 22 : 18 + Math.random() * 30}%;--dx:${kind === "zzz" ? 26 : dx}px;--dy:${dy}px;--s:${(0.7 + Math.random() * 0.7) * (big ? 1.3 : 1)};--r:${(Math.random() - 0.5) * 120}deg;--t:${kind === "zzz" ? 1.9 : 0.8 + Math.random() * 0.5}s;--c:${pick(colors)};animation-delay:${i * (kind === "spark" ? 30 : 110)}ms`;
      node.innerHTML = kind === "zzz" ? "z" : kind === "spark" ? (i % 3 ? SHAPES.spark : SHAPES.dot) : SHAPES.heart;
      node.addEventListener("animationend", () => node.remove());
      (into || fx).appendChild(node);
    }
  }

  /* ---------- the stage: full body, on Home and in onboarding ---------- */
  const Stage = {
    node: null, fx: null, poses: {}, anchor: null, pose: "center", busyUntil: 0, gazeUntil: 0, gazing: false, next: 0, press: null,
    size: 0, x: 0, y: 0, flying: false, onTouch: null, watch: null,
    mount() {
      const node = document.createElement("div");
      node.className = "stg"; node.hidden = true; node.dataset.pose = "center";
      node.setAttribute("role", "button"); node.setAttribute("tabindex", "0"); node.setAttribute("aria-label", "Studigo. Tap to play, stroke to pet.");
      node.innerHTML = `<span class="stgShadow"></span><div class="stgBody">${FULL.map((pose) => `<img class="stgPose${pose === "center" ? " on" : ""}" data-pose="${pose}" ${MIRROR[pose] ? "data-flip" : ""} src="assets/full/${MIRROR[pose] || pose}.webp" alt="" draggable="false">`).join("")}</div><div class="cmpFx"></div>`;
      screen.appendChild(node);
      this.node = node; this.fx = node.querySelector(".cmpFx");
      node.querySelectorAll(".stgPose").forEach((img) => { this.poses[img.dataset.pose] = img; });
      if (window.ResizeObserver) this.watch = new ResizeObserver(() => this.sync());
      node.addEventListener("pointerdown", (event) => {
        if (this.flying) return;
        event.preventDefault(); const p = local(event);
        this.press = { sx: p.x, sy: p.y, mode: "press", last: 0 }; node.setPointerCapture(event.pointerId);
      });
      node.addEventListener("pointermove", (event) => {
        const press = this.press; if (!press) return; const p = local(event);
        if (press.mode === "press" && Math.hypot(p.x - press.sx, p.y - press.sy) > 8) { press.mode = "pet"; this.set("up"); node.classList.add("petting"); }
        if (press.mode === "pet" && now() - press.last > 280) { press.last = now(); burst("heart", 1, this.fx, true); }
      });
      const up = () => {
        const press = this.press; if (!press) return; this.press = null; node.classList.remove("petting");
        if (press.mode === "pet") { st.pets += 1; save(); this.react("up", 700); this.touched("pet"); }
        else this.poke();
      };
      node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
      node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.poke(); } });
    },
    poke() { st.pokes += 1; save(); this.pose = ""; this.react("celebrate", 950); burst("spark", 7, this.fx, true); this.touched("poke"); },
    touched(kind) { if (this.onTouch) this.onTouch(kind); emit(); },
    active() { return Boolean(this.anchor) && !this.flying; },
    /** Stand him on a spot in the current view. He walks over if he was somewhere else. */
    attach(anchor, pose) {
      if (this.watch && this.anchor) this.watch.unobserve(this.anchor);
      const wasHidden = this.node.hidden;
      this.anchor = anchor; this.flying = false;
      if (this.watch) this.watch.observe(anchor);
      if (wasHidden) this.node.classList.add("noMove");
      this.sync(); this.node.hidden = false;
      void this.node.offsetWidth; this.node.classList.remove("noMove");
      this.pose = ""; this.set(pose || "center");
      emit();
    },
    detach() { if (this.watch && this.anchor) this.watch.unobserve(this.anchor); this.anchor = null; this.node.hidden = true; emit(); },
    sync() {
      if (!this.anchor || this.flying) return;
      if (!this.anchor.isConnected) { this.detach(); return; }
      const r = rel(this.anchor); if (!r.width) return;
      this.size = r.width; this.x = r.left; this.y = r.top;
      this.node.style.setProperty("--ss", r.width + "px"); this.node.style.setProperty("--sx", r.left + "px"); this.node.style.setProperty("--sy", r.top + "px");
    },
    set(name) {
      if (this.pose === name) return;
      this.pose = name;
      for (const key in this.poses) this.poses[key].classList.toggle("on", key === name);
      if (this.node.dataset.pose === name) { this.node.dataset.pose = ""; void this.node.offsetWidth; }
      this.node.dataset.pose = name; emit();
    },
    react(name, ms) { this.busyUntil = now() + ms; this.gazing = false; this.set(name); },
    /** Hold a pose until told otherwise (waving on the welcome step, reading a file). */
    hold(name) { this.rest = name || "center"; if (now() >= this.busyUntil) { this.pose = ""; this.set(this.rest); } },
    rest: "center",
    look(px, py, hold) {
      if (!this.active() || this.press || now() < this.busyUntil) return;
      this.set(dirPose(px - (this.x + this.size / 2), py - (this.y + this.size * 0.3), this.size * 0.3));
      this.gazing = true; this.gazeUntil = now() + (hold || 1800);
    },
    tick(t) {
      if (!this.active() || this.press || t < this.busyUntil || t < this.gazeUntil) return;
      if (this.gazing || this.pose !== this.rest) { this.gazing = false; this.set(this.rest); this.next = t + 3500; return; }
      if (this.rest === "center" && t > this.next) {
        this.next = t + 4200 + Math.random() * 3800;
        const move = pick(["left", "right", "up", "sway"]);
        if (move === "sway") pulse("sway", 1600, this.node); else { this.set(move); this.gazing = true; this.gazeUntil = t + 850; }
      }
    },
    /** The leap from where he stands into his window. */
    flyTo(target, done) {
      const node = this.node, size = this.size || 200;
      const tx = target.x + target.w / 2 - size / 2, ty = target.y + target.h / 2 - size * 0.36, sc = (target.w * 1.62) / size;
      const dx = tx - this.x, dy = ty - this.y, mirror = dx < 0;
      this.flying = true; this.busyUntil = now() + 5000;
      let ended = false;
      const finish = () => {
        if (ended) return; ended = true;
        if (this.watch && this.anchor) this.watch.unobserve(this.anchor);
        node.hidden = true; this.flying = false; this.anchor = null; node.classList.remove("mirror", "flying"); this.pose = ""; this.set("center"); done(); emit();
      };
      if (reduced) { node.hidden = true; setTimeout(finish, 180); return; }
      node.classList.toggle("mirror", mirror); node.classList.add("flying");
      this.pose = ""; this.set("leap");
      const at = (x, y, s, r) => `translate(${x}px, ${y}px) scale(${s}) rotate(${mirror ? -r : r}deg)`;
      const flight = node.animate([
        { transform: at(this.x, this.y, 1, 0), easing: "cubic-bezier(.4,0,.6,1)" },
        { transform: at(this.x, this.y + 16, 1.05, -8), offset: 0.16, easing: "cubic-bezier(.2,.7,.3,1)" },
        { transform: at(this.x + dx * 0.42, this.y + dy * 0.3 - 120, 1 - (1 - sc) * 0.35, 10), offset: 0.56, easing: "cubic-bezier(.5,0,.8,.6)" },
        { transform: at(this.x + dx, this.y + dy, sc, 4) }
      ], { duration: 900, fill: "forwards" });
      const land = () => { finish(); flight.cancel(); };
      flight.finished.then(land, land);
      // If the tab is not being painted the animation clock stalls; land anyway.
      setTimeout(land, 1100);
    }
  };

  /* ---------- idle: a character waiting for input ---------- */
  function activity() {
    rt.lastInput = now(); rt.leaned = false;
    if (rt.asleep) wake();
  }
  function wake() {
    rt.asleep = false;
    react("poke", 800); say(LINES.wake);
  }
  function tick() {
    const t = now();
    Stage.tick(t);
    if (!el || rt.mode !== "window" || rt.drag || rt.press || rt.thinking) return;
    if (t < rt.reactUntil) return;
    if (rt.reacting) { rt.reacting = null; if (!rt.asleep) setPose("center"); }
    if (t < rt.typingUntil || t < rt.gazeUntil) return;
    if (rt.gazing) { rt.gazing = false; setPose("center"); }
    if (rt.asleep) { if (t > rt.nextZ) { burst("zzz", 1); rt.nextZ = t + 1500; } return; }
    const idle = t - rt.lastInput;
    if (idle > SLEEP_AT) { rt.asleep = true; rt.nextZ = t; setPose("sleep"); return; }
    if (idle > LEAN_AT && !rt.leaned) { rt.leaned = true; react("lean", 5400); say(LINES.lean); return; }
    if (t > rt.nextBlink) { pulse("blink", 240); rt.nextBlink = t + 2300 + Math.random() * 3300; }
    if (t > rt.nextGlance) {
      rt.nextGlance = t + 4800 + Math.random() * 4200;
      const toward = el.dataset.side === "r" ? "left" : "right";
      const move = pick([toward, toward, "up", "down-" + toward, "sway"]);
      if (move === "sway") pulse("sway", 1600);
      else { setPose(move); rt.gazing = true; rt.gazeUntil = t + 850; }
    }
  }

  /* ---------- touch: tap to poke, stroke to pet, pull to pick up ---------- */
  function poke() {
    const t = now();
    st.pokes += 1; rt.pokeCombo = t - rt.pokeAt < 1300 ? rt.pokeCombo + 1 : 1; rt.pokeAt = t;
    if (t - rt.spokeAt < 3000) st.chatty = clamp(st.chatty + 0.1, 0.2, 1);
    save();
    rt.pose = ""; react("poke", 900); burst("spark", 3);
    if (rt.pokeCombo >= 3) { rt.pokeCombo = 0; pulse("sway", 1600); say(LINES.tickle, true); }
  }
  function highFive() {
    st.highFives += 1; save();
    pulse("highfive", 360); burst("spark", 9);
    rt.reactUntil = now() + 1100; emit();
  }
  function petTick() {
    const t = now(), press = rt.press;
    if (t - press.lastHeart > 300) { press.lastHeart = t; burst("heart", 1); }
  }
  function startDrag(p, press) {
    rt.drag = { ox: press ? press.ox : p.x - rt.x, oy: press ? press.oy : p.y - rt.y };
    el.classList.add("dragging"); bubble.hidden = true;
    rt.pose = ""; setPose("poke");
  }
  function dragTo(p) {
    rt.x = clamp(p.x - rt.drag.ox, 4, screen.offsetWidth - W - 4);
    rt.y = clamp(p.y - rt.drag.oy, 60, screen.offsetHeight - H - 8);
    el.style.setProperty("--x", rt.x + "px"); el.style.setProperty("--y", rt.y + "px");
  }
  function endDrag() {
    const a = area();
    const cx = rt.x + W / 2, cy = rt.y + H / 2;
    rt.dock = (cy > (a.top + a.bottom) / 2 ? "b" : "t") + (cx > screen.offsetWidth / 2 ? "r" : "l");
    rt.drag = null; el.classList.remove("dragging");
    place(); pulse("land", 460); react("center", 300); emit();
  }
  function bindTouch(hit, grip) {
    hit.addEventListener("pointerdown", (event) => {
      event.preventDefault(); activity();
      const p = local(event);
      rt.press = { sx: p.x, sy: p.y, ox: p.x - rt.x, oy: p.y - rt.y, mode: "press", lastHeart: 0 };
      hit.setPointerCapture(event.pointerId);
      clearTimeout(longTimer);
      longTimer = setTimeout(() => { if (rt.press && rt.press.mode === "press") { rt.press.mode = "long"; openCard(); } }, 620);
    });
    hit.addEventListener("pointermove", (event) => {
      const press = rt.press; if (!press) return;
      const p = local(event);
      if (press.mode === "press" && Math.hypot(p.x - press.sx, p.y - press.sy) > 7) { press.mode = "pet"; clearTimeout(longTimer); rt.pose = ""; setPose("pet"); }
      if (press.mode === "pet") {
        const out = p.x < rt.x - 18 || p.x > rt.x + W + 18 || p.y < rt.y - 18 || p.y > rt.y + H + 18;
        if (out) { press.mode = "drag"; startDrag(p, press); } else petTick();
      }
      if (press.mode === "drag") dragTo(p);
    });
    const release = () => {
      const press = rt.press; if (!press) return;
      clearTimeout(longTimer); rt.press = null;
      if (press.mode === "press") { if (rt.pose === "celebrate") highFive(); else poke(); }
      else if (press.mode === "pet") { st.pets += 1; save(); react("pet", 750); }
      else if (press.mode === "drag") endDrag();
    };
    hit.addEventListener("pointerup", release);
    hit.addEventListener("pointercancel", release);

    grip.addEventListener("pointerdown", (event) => { event.preventDefault(); activity(); grip.setPointerCapture(event.pointerId); startDrag(local(event)); });
    grip.addEventListener("pointermove", (event) => { if (rt.drag) dragTo(local(event)); });
    const drop = () => { if (rt.drag) endDrag(); };
    grip.addEventListener("pointerup", drop); grip.addEventListener("pointercancel", drop);
  }

  /* ---------- his seat: the header avatar he comes out of and goes back to ---------- */
  function sync() {
    const want = rt.hasJob && !rt.userSeated ? "window" : "seat";
    const ws = workspace();
    if (want === rt.mode) { ws.dataset.seat = want === "window" ? "empty" : "occupied"; place(); return; }
    rt.mode = want; rt.asleep = false; rt.drag = null; bubble.hidden = true; closeCard();
    clearTimeout(seatTimer);
    if (want === "window") {
      ws.dataset.seat = "empty";
      el.dataset.state = "window"; activity(); place(); pulse("land", 460);
      rt.pose = ""; react("support", 1200);
    } else {
      el.dataset.state = "seat"; place();
      seatTimer = setTimeout(() => { ws.dataset.seat = "occupied"; pulse("seatLand", 420, ws); }, reduced ? 0 : 300);
    }
    emit();
  }
  function seatTap() {
    if (!rt.hasJob) { pulse("seatLand", 420, workspace()); return; }
    if (rt.mode === "window") { if (now() - rt.spokeAt < 4000) st.chatty = clamp(st.chatty - 0.1, 0.2, 1); st.seated += 1; save(); rt.userSeated = true; }
    else rt.userSeated = false;
    sync();
  }
  /** The window appears empty; he lands in it a moment later (end of the leap). */
  function arrive() {
    rt.userSeated = false; rt.hasJob = true; rt.mode = "window"; rt.asleep = false;
    workspace().dataset.seat = "empty";
    el.dataset.empty = ""; el.classList.add("noMove"); el.dataset.state = "window";
    place(); void el.offsetWidth; el.classList.remove("noMove");
    return { x: rt.x + 4, y: rt.y + 4, w: 92, h: 92 };
  }
  function landed() {
    delete el.dataset.empty; activity();
    pulse("land", 460); rt.pose = ""; react("celebrate", 1300); burst("spark", 10); emit();
  }

  /* ---------- his card ---------- */
  function traits() {
    const list = [];
    if (st.dismissed >= 2 || st.chatty < 0.6) list.push(["Says less", "You waved off his comments, so he keeps them rarer."]);
    if (st.pokes > st.pets + 3) list.push(["Extra playful", "You poke him a lot. He has started playing along."]);
    if (st.pets >= 3) list.push(["Affectionate", "He leans in when you pet him."]);
    if (st.seated >= 2) list.push(["Gives you space", "You send him back to his seat often, so he stays out of the way."]);
    if (st.highFives >= 2) list.push(["Expects the high-five", "Tap him while he is celebrating."]);
    if (!list.length) list.push(["Still getting to know you", "How you treat him shapes how he behaves."]);
    return list;
  }
  function openCard() {
    closeCard();
    const wrap = document.createElement("div");
    wrap.className = "cmpCard";
    wrap.innerHTML = `
      <button class="cmpBackdrop" type="button" aria-label="Close Studigo's card" data-close></button>
      <section class="cmpSheet" role="dialog" aria-modal="true" aria-labelledby="cmpSheetTitle">
        <div class="cmpSheetHead"><div><span class="tinyLabel">STUDIGO</span><strong id="cmpSheetTitle">Your study companion</strong></div><button type="button" data-close>Done</button></div>
        <div class="cmpCardTop">
          <button class="cmpPlay" type="button" data-play aria-label="Studigo. Tap to play."><img src="assets/full/center.webp" alt=""></button>
          <div class="cmpAbout"><strong>He studies with you.</strong><p>He watches where you tap, reads along while you type, and steps aside when you scroll. Tap him. Stroke him. Drag him to another corner.</p></div>
        </div>
        <dl class="cmpStats">
          <div><dt>Answered together</dt><dd>${st.answers}</dd></div><div><dt>Right</dt><dd>${st.correct}</dd></div>
          <div><dt>Pets</dt><dd>${st.pets}</dd></div><div><dt>High-fives</dt><dd>${st.highFives}</dd></div>
        </dl>
        <div class="cmpTraits"><span class="tinyLabel">WHAT HE HAS PICKED UP</span><ul>${traits().map(([name, why]) => `<li><b>${name}</b><span>${why}</span></li>`).join("")}</ul></div>
        <label class="cmpToggle"><b>Quiet mode</b><small>No speech bubbles. He still watches and reacts.</small><input type="checkbox" data-set="quiet" ${st.quiet ? "checked" : ""}></label>
        <label class="cmpToggle"><b>Step aside while I scroll</b><small>He tucks to the edge so nothing is covered.</small><input type="checkbox" data-set="tuck" ${st.tuck ? "checked" : ""}></label>
        <button class="ghostButton" type="button" data-seat>Send him back to his seat</button>
      </section>`;
    wrap.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) closeCard();
      if (event.target.closest("[data-seat]")) { closeCard(); if (rt.mode === "window") seatTap(); }
      const play = event.target.closest("[data-play]");
      if (play) { const img = play.querySelector("img"); img.src = "assets/full/celebrate.webp"; pulse("playing", 900, play); setTimeout(() => { img.src = "assets/full/center.webp"; }, 900); }
    });
    wrap.addEventListener("change", (event) => { const key = event.target.dataset.set; if (key) { st[key] = event.target.checked; save(); emit(); } });
    screen.appendChild(wrap);
  }
  function closeCard() { const open = screen && screen.querySelector(".cmpCard"); if (open) open.remove(); }

  /* ---------- what the app tells him ---------- */
  function event(name, data) {
    if (!el) return;
    activity();
    if (name === "tone") { el.dataset.tone = data; return; }
    if (name === "thinking") { rt.thinking = true; el.classList.add("thinking"); rt.pose = ""; setPose("up"); return; }
    if (name === "thinkingEnd") { rt.thinking = false; el.classList.remove("thinking"); setPose("center"); return; }
    if (name === "look" && data) { const r = rel(data); lookAt(r.left + Math.min(r.width, 220) / 2, r.top + r.height / 2, 1600); return; }
    if (name === "correct") { st.answers += 1; st.correct += 1; rt.streak += 1; save(); }
    if (name === "wrong" || name === "blindspot") { st.answers += 1; rt.streak = 0; save(); }
    if (rt.mode !== "window") {
      // From his seat he still notices: the avatar gives a small bounce.
      if (name === "correct" || name === "setDone" || name === "cardGood") pulse("seatLand", 420, workspace());
      emit(); return;
    }
    rt.pose = "";
    if (name === "correct") {
      react("celebrate", 2300); burst("spark", 10);
      if (rt.streak === 3) say(LINES.streak, true); else if (Math.random() < 0.35) say(LINES.correct);
    } else if (name === "wrong" || name === "blindspot") {
      react("support", 2800); say(name === "blindspot" ? LINES.blindspot : LINES.wrong, true);
    } else if (name === "setDone") {
      react("celebrate", 3000); burst("spark", 16); say(LINES.setDone, true);
    } else if (name === "cardGood") { react("celebrate", 1300); burst("spark", 5); }
    else if (name === "cardMiss") { react("support", 1500); }
    emit();
  }
  /** Called on every keystroke: he looks at where the words are appearing. */
  function typing(input) {
    if (!el) return;
    const r = rel(input);
    const chars = Math.min((input.value || "").length, 26);
    const px = r.left + 16 + chars * 8.4, py = r.top + r.height / 2;
    if (Stage.active()) { Stage.look(px, py, 1500); return; }
    if (rt.mode !== "window") return;
    activity();
    if (now() < rt.reactUntil || rt.thinking) return;
    let pose = dirPose(px - (rt.x + W / 2), py - (rt.y + 46));
    // Beside the field he peers down into it rather than straight across.
    if (pose === "left") pose = "down-left"; else if (pose === "right") pose = "down-right"; else if (pose === "center") pose = "down";
    setPose(pose);
    rt.gazing = true; rt.typingUntil = now() + 1500;
    if (!reduced) pulse("bob", 170);
  }

  /* ---------- mount ---------- */
  function emit() {
    const where = Stage.flying ? "Leaping in" : Stage.active() ? "On his stage" : rt.mode === "window" ? "In his window" : "In his seat";
    const pose = Stage.active() || Stage.flying ? Stage.pose : rt.pose;
    const mood = rt.mode === "seat" && !Stage.active() && !Stage.flying ? "Resting" : rt.thinking ? "Thinking" : now() < rt.typingUntil ? "Curious" : MOODS[pose] || "Watching";
    const snapshot = { mode: rt.mode, where, pose, mood, chatty: st.chatty, quiet: st.quiet, traits: traits().map((t) => t[0]) };
    listeners.forEach((fn) => fn(snapshot));
  }
  function init(target) {
    screen = target;
    el = document.createElement("div");
    el.className = "cmp"; el.dataset.state = "seat"; el.dataset.tone = "coach"; el.dataset.pose = "center"; el.dataset.side = "r";
    el.innerHTML = `
      <button class="cmpBubble" type="button" hidden aria-live="polite"></button>
      <div class="cmpWin">
        <div class="cmpScreen"></div>
        <div class="cmpStage"><div class="cmpBody">${POSES.map((pose) => `<img class="cmpPose${pose === "center" ? " on" : ""}" data-pose="${pose}" ${MIRROR[pose] ? "data-flip" : ""} src="assets/${MIRROR[pose] || pose}.webp" alt="" draggable="false">`).join("")}<i class="cmpLid l"></i><i class="cmpLid r"></i></div></div>
        <div class="cmpHit" role="button" tabindex="0" aria-label="Studigo. Tap to play, stroke to pet, hold for his card."></div>
        <button class="cmpSill" type="button" aria-label="Open Studigo's card"><span class="led"></span><span class="sillBrand">studigo</span></button>
        <button class="cmpCorner cmpGrip" type="button" aria-label="Move Studigo"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/><circle cx="3" cy="9" r="1.3"/><circle cx="9" cy="9" r="1.3"/><circle cx="6" cy="6" r="1.3"/></g></svg></button>
        <button class="cmpCorner cmpMin" type="button" aria-label="Send Studigo back to his seat"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <div class="cmpFx"></div>`;
    screen.appendChild(el);
    bubble = el.querySelector(".cmpBubble"); fx = el.querySelector(".cmpFx");
    el.querySelectorAll(".cmpPose").forEach((img) => { poseEls[img.dataset.pose] = img; });
    Stage.mount();

    bindTouch(el.querySelector(".cmpHit"), el.querySelector(".cmpGrip"));
    el.querySelector(".cmpMin").addEventListener("click", seatTap);
    el.querySelector(".cmpSill").addEventListener("click", openCard);
    el.querySelector(".cmpHit").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poke(); } });
    bubble.addEventListener("click", () => { bubble.hidden = true; st.dismissed += 1; st.chatty = clamp(st.chatty - 0.2, 0.2, 1); save(); emit(); });

    // He looks toward where you point and tap.
    const watch = (e, hold) => { if (e.target.closest(".cmp, .stg, .cmpCard")) return; const p = local(e); if (Stage.active()) Stage.look(p.x, p.y, hold); else lookAt(p.x, p.y, hold); };
    screen.addEventListener("pointermove", (e) => watch(e, 1800));
    screen.addEventListener("pointerdown", (e) => { if (!e.target.closest(".cmp, .stg, .cmpCard")) activity(); watch(e, 1500); }, true);
    document.addEventListener("keydown", activity);
    // Only a real scroll gesture counts: the app scrolling a new message into view does not.
    const onScrollGesture = (e) => {
      if (!e.target.closest || !e.target.closest(".modeSurface, .chatThread") || e.target.closest(".cmp, .cmpCard")) return;
      rt.lastInput = now();
      if (!st.tuck || rt.mode !== "window" || rt.drag || now() < rt.steadyUntil) return;
      el.classList.add("tucked"); bubble.hidden = true;
      clearTimeout(tuckTimer); tuckTimer = setTimeout(() => el.classList.remove("tucked"), 620);
    };
    screen.addEventListener("wheel", onScrollGesture, { passive: true });
    screen.addEventListener("touchmove", onScrollGesture, { passive: true });
    window.addEventListener("resize", place);
    // He rides along whenever the page under him changes size (keyboard, page switch).
    if (window.ResizeObserver) {
      const watcher = new ResizeObserver(() => place());
      watcher.observe(workspace()); watcher.observe(screen.querySelector(".modeSurface"));
    }
    screen.addEventListener("transitionend", (e) => { if (e.target.closest && !e.target.closest(".cmp, .stg")) place(); });

    place(); setInterval(tick, 320); emit();
  }

  window.Companion = {
    init, event, typing, relayout: place, openCard, seatTap, arrive, landed, stage: Stage,
    /** He steps out of the phone (onto a page that embeds it). Returns where he was, in client pixels. */
    leave() {
      const node = rt.mode === "window" ? el.querySelector(".cmpScreen") : screen.querySelector(".chatMascot.seat .studigoMascot") || el;
      const r = node.getBoundingClientRect();
      screen.classList.add("away"); bubble.hidden = true; rt.asleep = false;
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    },
    comeBack() {
      if (!screen.classList.contains("away")) return;
      screen.classList.remove("away"); activity();
      if (rt.mode === "window") { pulse("land", 460); rt.pose = ""; react("celebrate", 1100); burst("spark", 8); }
      else pulse("seatLand", 420, workspace());
    },
    /** The page says whether he has a job here. With one he comes out to his window; without, he stays seated. */
    job(hasJob) { rt.hasJob = hasJob; if (el) sync(); },
    /** Bring him out (or seat him) regardless of what the user last chose. */
    present(out) { rt.userSeated = !out; if (el) sync(); },
    /** Keep him in place for a moment (the page is about to move under him). */
    steady(ms) { rt.steadyUntil = now() + ms; if (el) el.classList.remove("tucked"); },
    onChange(fn) { listeners.push(fn); if (el) emit(); },
    /** Demo shortcuts for the panel beside the phone. */
    demo(action) {
      if (action === "reset") { st = fresh(); save(); rt.streak = 0; emit(); return; }
      if (Stage.active()) { if (action === "poke") Stage.poke(); if (action === "pet") { Stage.react("up", 1600); pulse("petting", 1600, Stage.node); burst("heart", 5, Stage.fx, true); } return; }
      if (rt.mode !== "window") return;
      rt.asleep = false; rt.pose = "";
      if (action === "lean") { rt.leaned = true; react("lean", 5400); say(LINES.lean, true); }
      if (action === "sleep") { rt.lastInput = now() - SLEEP_AT - 10; rt.reactUntil = 0; rt.gazeUntil = 0; rt.typingUntil = 0; rt.asleep = true; rt.nextZ = now(); setPose("sleep"); }
      if (action === "pet") { react("pet", 1900); burst("heart", 5); st.pets += 1; save(); }
      if (action === "poke") poke();
    }
  };
})();
