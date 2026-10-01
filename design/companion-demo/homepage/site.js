/* Studigo homepage behavior.
   One Studigo, three places: inside the live phone in the hero, loose on the page
   (he leaps out when you scroll and reacts to each section), and on his stage in
   the closing field. The intro puts him in the phone to begin with. */
(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const now = () => performance.now();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const narrow = () => window.innerWidth < 961;

  const phone = $("#phone"), phoneFrame = $("#phoneFrame"), hero = $("#top"), ctaSpot = $("#ctaSpot");

  /* ---------- talking to the phone ---------- */
  let phoneReady = false, seq = 0;
  const pending = {}, readyWaiters = [];
  window.addEventListener("message", (event) => {
    if (event.source !== phone.contentWindow) return;
    const data = event.data || {};
    if (data.type === "studigo:ready") { phoneReady = true; readyWaiters.splice(0).forEach((fn) => fn()); }
    if (data.type === "studigo:left" && pending[data.id]) { pending[data.id](data.rect); delete pending[data.id]; }
  });
  const whenReady = () => new Promise((resolve) => { if (phoneReady) resolve(); else { readyWaiters.push(resolve); setTimeout(resolve, 2500); } });
  const tell = (message) => { try { phone.contentWindow.postMessage(message, "*"); } catch (error) { /* the phone is optional */ } };
  /** Ask him to step out of the phone; resolves with where his window is on this page. */
  function borrow() {
    return new Promise((resolve) => {
      const frame = () => phone.getBoundingClientRect();
      const guess = () => { const f = frame(); return { x: f.left + f.width * 0.67, y: f.top + f.height * 0.73, w: f.width * 0.22, h: f.width * 0.22 }; };
      const id = ++seq;
      const timer = setTimeout(() => { delete pending[id]; resolve(guess()); }, 450);
      pending[id] = (rect) => { clearTimeout(timer); const f = frame(); resolve({ x: f.left + rect.x, y: f.top + rect.y, w: rect.w, h: rect.h }); };
      tell({ type: "studigo:leave", id });
    });
  }

  /* ---------- Studigo on the page ---------- */
  const FULL = ["center", "left", "right", "up", "down", "up-right", "up-left", "down-right", "down-left", "wave", "leap", "celebrate", "read"];
  const MIRROR = { "up-left": "up-right", "down-left": "down-right" };
  const SHAPES = {
    heart: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 14.2 2.6 8.9a3.5 3.5 0 0 1 5-4.9l.4.4.4-.4a3.5 3.5 0 0 1 5 4.9Z"/></svg>',
    spark: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z"/></svg>'
  };
  const G = {
    el: $("#guide"), body: $("#guideBody"), bubble: $("#guideSay"), fx: $("#guideFx"), imgs: {},
    pose: "", rest: "center", box: { x: 0, y: 0, size: 160 }, where: "phone", flying: false, busyUntil: 0, gazeUntil: 0, press: null, said: {}, sayTimer: 0,
    mount() {
      this.body.innerHTML = FULL.map((pose) => `<img data-pose="${pose}" ${MIRROR[pose] ? "data-flip" : ""} src="../assets/full/${MIRROR[pose] || pose}.webp" alt="" draggable="false">`).join("");
      $$("img", this.body).forEach((img) => { this.imgs[img.dataset.pose] = img; });
      this.set("center");
      const el = this.el;
      el.addEventListener("pointerdown", (event) => { if (this.flying) return; event.preventDefault(); this.press = { x: event.clientX, y: event.clientY, mode: "press", last: 0 }; el.setPointerCapture(event.pointerId); });
      el.addEventListener("pointermove", (event) => {
        const press = this.press; if (!press) return;
        if (press.mode === "press" && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { press.mode = "pet"; this.set("up"); el.classList.add("petting"); }
        if (press.mode === "pet" && now() - press.last > 280) { press.last = now(); this.burst("heart", 1); }
      });
      const up = () => { const press = this.press; if (!press) return; this.press = null; el.classList.remove("petting"); if (press.mode === "pet") this.react("up", 700); else this.poke(); };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.poke(); } });
      this.bubble.addEventListener("click", (event) => { event.stopPropagation(); this.bubble.hidden = true; });
      this.bubble.addEventListener("pointerdown", (event) => event.stopPropagation());
    },
    set(name) {
      if (this.pose === name) return; this.pose = name;
      for (const key in this.imgs) this.imgs[key].classList.toggle("on", key === name);
      if (this.el.dataset.pose === name) { this.el.dataset.pose = ""; void this.el.offsetWidth; }
      this.el.dataset.pose = name;
    },
    react(name, ms) { this.busyUntil = now() + ms; this.pose = ""; this.set(name); },
    poke() { this.react("celebrate", 950); this.burst("spark", 7); },
    place(box, still) {
      this.box = box;
      if (still) this.el.classList.add("still");
      this.el.style.setProperty("--gs", box.size + "px"); this.el.style.setProperty("--gx", box.x + "px"); this.el.style.setProperty("--gy", box.y + "px");
      if (still) { void this.el.offsetWidth; this.el.classList.remove("still"); }
    },
    say(text, key) {
      if (key && this.said[key]) return; if (key) this.said[key] = true;
      this.bubble.textContent = text; this.bubble.hidden = true; void this.bubble.offsetWidth; this.bubble.hidden = false;
      clearTimeout(this.sayTimer); this.sayTimer = setTimeout(() => { this.bubble.hidden = true; }, 3000);
    },
    burst(kind, count) {
      if (reduced) return;
      const colors = kind === "heart" ? ["var(--berry)", "#ff7aa2"] : ["var(--dandelion)", "var(--kiwi)", "var(--tangerine)", "var(--teal)"];
      for (let i = 0; i < count; i += 1) {
        const node = document.createElement("span"); node.className = "gfx";
        const reach = this.box.size / 110;
        node.style.cssText = `--fx:${30 + Math.random() * 40}%;--fy:${18 + Math.random() * 30}%;--dx:${(Math.random() - 0.5) * 150 * reach}px;--dy:${(-40 - Math.random() * 80) * reach}px;--s:${0.8 + Math.random() * 0.8};--r:${(Math.random() - 0.5) * 120}deg;--t:${0.8 + Math.random() * 0.5}s;--c:${pick(colors)};animation-delay:${i * 35}ms`;
        node.innerHTML = SHAPES[kind];
        node.addEventListener("animationend", () => node.remove());
        this.fx.appendChild(node);
      }
    },
    look(x, y) {
      if (this.where === "phone" || this.flying || this.press || this.rest !== "center" || now() < this.busyUntil) return;
      const dx = x - (this.box.x + this.box.size / 2), dy = y - (this.box.y + this.box.size * 0.3);
      let pose = "center";
      if (Math.hypot(dx, dy) > this.box.size * 0.42) pose = { "0": "right", "1": "down-right", "2": "down", "3": "down-left", "4": "left", "-4": "left", "-3": "up-left", "-2": "up", "-1": "up-right" }[Math.round(Math.atan2(dy, dx) / (Math.PI / 4))];
      this.set(pose); this.gazeUntil = now() + 1500;
    },
    tick() { if (this.where === "phone" || this.flying || this.press) return; const t = now(); if (t > this.busyUntil && t > this.gazeUntil && this.pose !== this.rest) this.set(this.rest); },
    /** One leap from where he is to a new spot. */
    fly(to) {
      const from = this.box, el = this.el;
      if (reduced) { this.place(to, true); return Promise.resolve(); }
      return new Promise((resolve) => {
        this.flying = true; this.bubble.hidden = true;
        const mirror = to.x + to.size / 2 < from.x + from.size / 2;
        el.classList.toggle("mirror", mirror); el.classList.add("flying");
        this.place(to, true); el.style.transformOrigin = "0 0";
        this.pose = ""; this.set("leap");
        const s0 = from.size / to.size, lift = Math.max(12, Math.min(from.y, to.y) - 130);
        const at = (x, y, s, r) => `translate(${x}px, ${y}px) scale(${s}) rotate(${mirror ? -r : r}deg)`;
        let ended = false;
        const flight = el.animate([
          { transform: at(from.x, from.y, s0, 0), easing: "cubic-bezier(.4,0,.6,1)" },
          { transform: at(from.x, from.y + 14 * s0, s0 * 1.04, -6), offset: 0.14, easing: "cubic-bezier(.2,.7,.3,1)" },
          { transform: at(from.x + (to.x - from.x) * 0.45, lift, s0 + (1 - s0) * 0.5, 8), offset: 0.55, easing: "cubic-bezier(.5,0,.8,.6)" },
          { transform: at(to.x, to.y, 1, 2) }
        ], { duration: 880, fill: "forwards" });
        const land = () => {
          if (ended) return; ended = true; flight.cancel();
          el.style.transformOrigin = ""; el.classList.remove("flying", "mirror"); this.flying = false;
          this.pose = ""; this.set(this.rest); resolve();
        };
        flight.finished.then(land, land); setTimeout(land, 1150);
      });
    }
  };

  const dockBox = () => { const size = narrow() ? 112 : 172, pad = narrow() ? 4 : 22; return { size, x: window.innerWidth - size - pad, y: window.innerHeight - size - (narrow() ? 6 : 14) }; };
  const spotBox = () => { const r = ctaSpot.getBoundingClientRect(), size = r.width * 0.9; return { size, x: r.left + (r.width - size) / 2, y: r.bottom - 34 - size * 0.962 }; };
  const windowBox = (rect) => { const size = rect.w * 2.35; return { size, x: rect.x + rect.w / 2 - size / 2, y: rect.y + rect.h / 2 - size * 0.27 }; };

  /* ---------- where he should be, given the scroll position ---------- */
  let moving = false, section = null, introDone = false;
  async function go(target) {
    if (moving || G.where === target) return;
    moving = true;
    if (G.where === "phone") {
      const rect = await borrow();
      G.rest = "center"; G.place(windowBox(rect), true); G.el.hidden = false;
      await G.fly(target === "cta" ? spotBox() : dockBox());
    } else if (target === "phone") {
      G.rest = "center";
      await G.fly(windowBox(await borrow()));
      G.el.hidden = true; tell({ type: "studigo:return" });
    } else {
      await G.fly(target === "cta" ? spotBox() : dockBox());
    }
    G.where = target; moving = false;
    if (target === "cta") { G.rest = "wave"; G.set("wave"); G.burst("spark", 10); }
    if (target === "dock") applySection(true);
    onScroll();
  }
  function applySection(arrived) {
    if (G.where !== "dock" || !section) return;
    const pose = section.dataset.guide;
    G.rest = pose === "read" ? "read" : "center";
    if (pose === "wave") G.react("wave", 1700);
    else if (pose === "celebrate") { G.react("celebrate", 1300); G.burst("spark", 9); }
    else if (!arrived || pose === "read") { G.pose = ""; G.set(G.rest); }
    if (section.dataset.say) setTimeout(() => { if (G.where === "dock") G.say(section.dataset.say, section.dataset.say); }, 350);
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      if (!reduced && !narrow()) phoneFrame.style.transform = `translateY(${(-y * 0.05).toFixed(1)}px) rotate(${clamp(y * 0.004, 0, 2.2).toFixed(2)}deg)`;
      if (!introDone || moving) return;
      const pr = phoneFrame.getBoundingClientRect();
      const visible = clamp((Math.min(pr.bottom, window.innerHeight) - Math.max(pr.top, 0)) / pr.height, 0, 1);
      const cr = ctaSpot.getBoundingClientRect();
      const atCta = cr.top < window.innerHeight * 0.74 && cr.bottom > window.innerHeight * 0.34;
      const inPhone = G.where === "phone" ? visible > 0.45 : visible > 0.82;
      const target = inPhone ? "phone" : atCta ? "cta" : "dock";
      if (target !== G.where) go(target);
      else if (G.where === "cta") G.place(spotBox(), true);
      else if (G.where === "dock") G.place(dockBox(), true);
    });
  }

  /* ---------- the intro: the device wakes, he leaps in, then jumps into the phone ---------- */
  const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("in"); reveal.unobserve(entry.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  const startPage = () => { $$(".rv").forEach((node) => reveal.observe(node)); introDone = true; onScroll(); };
  async function intro() {
    let seen = false;
    try { seen = sessionStorage.getItem("studigo.intro") === "1"; } catch (error) { /* storage is optional */ }
    if (reduced || seen || window.scrollY > 40) { startPage(); return; }
    const overlay = $("#intro"), screenEl = $("#introScreen");
    let skipped = false;
    const pause = async (ms) => { const end = now() + ms; while (!skipped && now() < end) await wait(40); };
    $("#introSkip").addEventListener("click", () => { skipped = true; });
    document.body.classList.add("introOn");
    G.el.style.zIndex = "95";
    whenReady().then(borrow);
    await pause(260);
    overlay.classList.add("wake");
    await pause(900);
    if (!skipped) {
      const sr = screenEl.getBoundingClientRect(), size = sr.width * 0.86;
      const stand = { size, x: sr.left + (sr.width - size) / 2, y: sr.bottom - 34 - size * 0.962 };
      G.rest = "wave";
      G.place({ size: size * 0.7, x: stand.x - window.innerWidth * 0.42, y: window.innerHeight * 0.72 }, true); G.el.hidden = false;
      await G.fly(stand);
      G.burst("spark", 12);
      await pause(1250);
    }
    try { sessionStorage.setItem("studigo.intro", "1"); } catch (error) { /* storage is optional */ }
    document.body.classList.remove("introOn"); overlay.classList.add("out"); overlay.style.display = "grid";
    setTimeout(() => { overlay.style.display = ""; overlay.classList.remove("wake", "out"); }, 700);
    $$(".hero .rv").forEach((node) => node.classList.add("in"));
    G.rest = "center";
    if (!skipped) { await whenReady(); await G.fly(windowBox(await borrow())); }
    G.el.hidden = true; G.el.style.zIndex = ""; tell({ type: "studigo:return" });
    G.where = "phone";
    startPage();
  }

  /* ---------- the rest of the page ---------- */
  function shells() {
    $("#shells").addEventListener("click", (event) => {
      const button = event.target.closest("[data-shell]"); if (!button) return;
      $$("#shells [data-shell]").forEach((item) => item.setAttribute("aria-checked", item === button));
      hero.dataset.room = button.dataset.shell;
      tell({ type: "studigo:tone", tone: button.dataset.shell });
    });
  }
  /** The big portrait follows the cursor: the same head-turn clip the current homepage scrubs. */
  function meetVideo() {
    const video = $("#meetVideo"), holder = $("#meetScreen");
    if (!fine || reduced) return;
    let target = 0, smooth = 0, last = -1, armed = false;
    const arm = () => {
      if (armed) return; armed = true;
      video.src = "../assets/track.mp4"; video.load();
      video.addEventListener("loadeddata", () => { video.currentTime = video.duration / 2; });
      video.addEventListener("seeked", () => holder.classList.add("live"), { once: true });
      const loop = () => {
        smooth += (target - smooth) * 0.12;
        if (video.duration) { const t = 0.03 + ((smooth + 1) / 2) * (video.duration - 0.06); if (Math.abs(t - last) > 0.012) { last = t; video.currentTime = t; } }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };
    new IntersectionObserver((entries, observer) => { if (entries[0].isIntersecting) { arm(); observer.disconnect(); } }, { rootMargin: "400px" }).observe(holder);
    window.addEventListener("pointermove", (event) => {
      const r = holder.getBoundingClientRect(), radius = clamp(window.innerWidth * 0.5, 400, 900);
      const x = clamp((event.clientX - (r.left + r.width / 2)) / radius, -1, 1);
      target = Math.abs(x) < 0.04 ? 0 : x;
    }, { passive: true });
  }
  /** Modes: the device holds still while the room changes mode and color. */
  function modes() {
    const grid = $(".modesGrid"), steps = $$(".modeStep"), device = $("#modeDevice"), host = $("#modeHost"), name = $("#modeName");
    let current = null;
    const show = (step) => {
      if (step === current) return; current = step;
      steps.forEach((item) => item.classList.toggle("on", item === step));
      device.dataset.tone = step.dataset.tone; name.textContent = step.dataset.mode;
      host.innerHTML = `<div class="modeScreenCopy" data-tone="${step.dataset.tone}">${$(".modeScreen", step).innerHTML}</div>`;
    };
    const setup = () => {
      const pinned = !narrow();
      grid.classList.toggle("pinned", pinned);
      if (pinned && !current) show(steps[0]);
      if (!pinned) steps.forEach((item) => item.classList.add("on"));
    };
    setup(); window.addEventListener("resize", setup);
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting && grid.classList.contains("pinned")) show(entry.target); }), { rootMargin: "-46% 0px -46% 0px" });
    steps.forEach((step) => observer.observe(step));
  }
  function sections() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting && entry.target !== section) { section = entry.target; applySection(false); } });
    }, { rootMargin: "-40% 0px -40% 0px" });
    $$("[data-guide]").forEach((node) => observer.observe(node));
  }

  G.mount(); shells(); meetVideo(); modes(); sections();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("pointermove", (event) => { if (fine) G.look(event.clientX, event.clientY); }, { passive: true });
  window.addEventListener("pointerdown", (event) => { if (!event.target.closest("#guide")) G.look(event.clientX, event.clientY); }, { passive: true });
  setInterval(() => G.tick(), 300);
  intro();
})();
