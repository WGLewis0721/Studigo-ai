import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Automated rows of the Living Companion QA matrix (LC-21). Synthetic fixture only.
// The base URL must be a loopback address; nothing here writes learner state.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "design", "living-companion", "evidence", "LC-21");
const BASE = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3302";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(BASE).hostname)) {
  throw new Error(`STUDIGO_QA_BASE must be a loopback address, got ${BASE}`);
}
const ONLY = process.env.LC_QA_ONLY ? new Set(process.env.LC_QA_ONLY.split(",").map((id) => id.trim())) : null;
const want = (...ids) => !ONLY || ids.some((id) => ONLY.has(id));

const PREFS_KEY = "studigo.companion.fixture";
const SCALE_KEY = "studigo.companion.scale";
const EVENTS = ["correct", "wrong", "blindspot", "setDone", "cardGood", "cardMiss", "correctFast", "stall", "hintOpened", "missionComplete", "sessionReturn"];
const DESKTOP = { name: "desktop", size: "1440x900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const PHONE = { name: "phone", size: "390x844", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SWEEP = [["left", -1, 0], ["right", 1, 0], ["up", 0, -1], ["down", 0, 1], ["up-left", -1, -1], ["up-right", 1, -1], ["down-left", -1, 1], ["down-right", 1, 1]];
const NETWORK_OR_SENSOR = /\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket\s*\(|getUserMedia|mediaDevices|enumerateDevices|geolocation|supabase/;
const COORD_KEYS = /(clientX|clientY|pageX|pageY|screenX|screenY|offsetX|offsetY|pointer|mouse|cursor)=|[?&](x|y)=/i;
const NO_WEBGL = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl/i.test(String(type))) return null;
    return original.call(this, type, ...rest);
  };
};

const results = [];
const shots = [];
let browser;

class Verdict {
  constructor() {
    this.fails = [];
    this.opens = [];
    this.oks = [];
  }
  ok(condition, text) {
    (condition ? this.oks : this.fails).push(text);
    return Boolean(condition);
  }
  open(text) {
    this.opens.push(text);
  }
  status() {
    return this.fails.length ? "FAIL" : this.opens.length ? "OPEN" : "PASS";
  }
  note() {
    return [
      ...this.fails.map((text) => `FAIL: ${text}`),
      ...this.opens.map((text) => `OPEN: ${text}`),
      ...this.oks.map((text) => `ok: ${text}`)
    ].join(" | ");
  }
}

function record(id, vp, room, verdict, measured = {}, flags = null) {
  const entry = { id, viewport: vp.name, size: vp.size, room, status: verdict.status(), note: verdict.note(), measured, flags };
  results.push(entry);
  console.log(`${entry.status} ${id} ${vp.name} ${room}: ${entry.note}`);
}

function recordStatic(id, status, note, measured = {}) {
  results.push({ id, viewport: "static", size: "", room: "n/a", status, note, measured, flags: null });
  console.log(`${status} ${id} static: ${note}`);
}

function recordOpen(id, owner, reason) {
  const note = `owner: ${owner}. ${reason}`;
  results.push({ id, viewport: "n/a", size: "", room: "n/a", status: "OPEN", note, measured: {}, flags: null });
  console.log(`OPEN ${id}: ${note}`);
}

async function run(id, check) {
  try {
    await check();
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0];
    results.push({ id, viewport: "n/a", size: "", room: "n/a", status: "FAIL", note: `FAIL: script error, not a product verdict: ${message}`, measured: {}, flags: null });
    console.log(`FAIL ${id}: script error: ${message}`);
  }
}

const centerOf = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
const insideViewport = (r, vw) => r.left >= 0 && r.top >= 0 && r.right <= vw.width && r.bottom <= vw.height;
const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function pageUrl({ mode = "quiz", room = "phase3", learn } = {}) {
  const query = new URLSearchParams({ mode, ui: room === "phase3" ? "phase3" : "legacy" });
  if (learn) query.set("learn", learn);
  return `${BASE}/dev/study?${query}`;
}

async function waitForCompanion(page) {
  await page.waitForFunction(() => Boolean(document.querySelector(".cmp")) && Boolean(window.studigoCompanion), null, { timeout: 120_000 });
}

async function openRoom(vp, options = {}) {
  const { contextExtra = {}, initScript, ...target } = options;
  const context = await browser.newContext({
    viewport: vp.viewport,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    reducedMotion: "no-preference",
    ...contextExtra
  });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(pageUrl(target), { waitUntil: "load", timeout: 180_000 });
  await waitForCompanion(page);
  await page.waitForTimeout(500);
  return { context, page, errors };
}

const rectOf = (page, selector) => page.evaluate((sel) => {
  const node = document.querySelector(sel);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}, selector);

const snapshot = (page) => page.evaluate(() => {
  const box = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    win: box(".cmpWin"), stage: box(".cmpStage"), cmp: box(".cmp"), slot: box(".cmpStripSlot"),
    rail: box(".studigoRail"), frame: box(".modeFrame"), tab: box(".cmpTab"), grip: box(".cmpGrip"), hit: box(".cmpHit")
  };
});

async function holdDrawerOpen(page) {
  const rail = await rectOf(page, ".studigoRail");
  if (rail && rail.width > 0) await page.mouse.move(rail.left + rail.width / 2, rail.top + rail.height / 2);
}

async function setPrefs(page, patch) {
  await page.evaluate(({ key, patch }) => {
    let current = {};
    try {
      current = JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
    } catch {
      current = {};
    }
    const next = { ...current, ...patch, v: 2 };
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(next) }));
  }, { key: PREFS_KEY, patch });
  await page.waitForTimeout(400);
}

const readPrefs = (page) => page.evaluate((key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return "corrupt";
  }
}, PREFS_KEY);

async function waitForStrip(page, on) {
  await page.waitForFunction((wantOn) => {
    const slot = document.querySelector(".cmpStripSlot");
    const cmp = document.querySelector(".cmp");
    if (!slot || !cmp) return false;
    const inStrip = cmp.parentElement?.classList.contains("cmpStrip") === true;
    const inFloat = cmp.parentElement?.classList.contains("cmpHost") === true;
    return slot.hasAttribute("data-on") === wantOn && (wantOn ? inStrip : inFloat);
  }, on, { timeout: 8000 });
  await page.waitForTimeout(700);
}

function flagsOf(page) {
  return page.evaluate((key) => {
    const cmp = document.querySelector(".cmp");
    const parent = cmp ? cmp.parentElement : null;
    let prefs;
    try {
      prefs = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      prefs = "corrupt";
    }
    let placement = null;
    if (parent) placement = parent.classList.contains("cmpStrip") ? "strip" : parent.classList.contains("cmpHost") ? "float" : parent.className;
    return {
      phase3Ui: document.querySelector(".roomDevice")?.getAttribute("data-ui") === "phase3",
      motionAttr: cmp ? cmp.hasAttribute("data-motion") : null,
      rigCanvases: document.querySelectorAll(".cmpRig").length,
      placement,
      prefHost: prefs && typeof prefs === "object" ? (prefs.host ?? "unset") : String(prefs),
      viewport: `${innerWidth}x${innerHeight}`
    };
  }, PREFS_KEY);
}

async function dragBy(page, dx, dy) {
  const grip = await rectOf(page, ".cmpGrip");
  const gx = grip.left + grip.width / 2, gy = grip.top + grip.height / 2;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + dx, gy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(900);
}

async function touchDragBy(context, page, dx, dy) {
  const cdp = await context.newCDPSession(page);
  const grip = await rectOf(page, ".cmpGrip");
  const sx = grip.left + grip.width / 2, sy = grip.top + grip.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 1 }] });
  let mid = null;
  for (let i = 1; i <= 12; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx + (dx * i) / 12, y: sy + (dy * i) / 12, id: 1 }] });
    await page.waitForTimeout(16);
    if (i === 6) mid = await snapshot(page);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(900);
  const end = await snapshot(page);
  await cdp.detach();
  return { mid, end };
}

async function focusHit(page) {
  await page.evaluate(() => document.querySelector(".cmpHit")?.focus({ preventScroll: true }));
}

async function findFreeSpot(page) {
  return page.evaluate(() => {
    const surface = document.querySelector(".modeSurface");
    const cmp = document.querySelector(".cmp");
    if (!surface || !cmp) return null;
    const k = parseFloat(cmp.style.getPropertyValue("--k")) || 1;
    const w = 116 * k, h = 138 * k;
    const s = surface.getBoundingClientRect();
    const frame = document.querySelector(".modeFrame")?.getBoundingClientRect();
    const top = Math.max(s.top, frame ? frame.bottom : 0) + 8;
    const floor = Math.min(s.bottom, innerHeight) - 8;
    const left = Math.max(s.left, 0) + 10;
    const right = Math.min(s.right, innerWidth) - 10;
    const controls = Array.from(surface.querySelectorAll("button:not(:disabled), input:not(:disabled), select, textarea, a[href], label"))
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    let best = null;
    for (let x = left; x <= right - w; x += 10) {
      for (let y = top; y <= floor - h; y += 10) {
        const nearSide = x - left < 70 || right - w - x < 70;
        const nearRow = y - top < 70 || floor - h - y < 70;
        if (nearSide && nearRow) continue;
        let clearance = 9999;
        for (const r of controls) {
          const dx = Math.max(r.left - (x + w), x - r.right, 0);
          const dy = Math.max(r.top - (y + h), y - r.bottom, 0);
          clearance = Math.min(clearance, Math.hypot(dx, dy));
        }
        if (clearance >= 14 && (!best || clearance > best.clearance)) best = { x, y, clearance: Math.round(clearance) };
      }
    }
    return best;
  });
}

async function overlapReport(page, selectors) {
  return page.evaluate((sels) => {
    const win = document.querySelector(".cmpWin");
    const cmp = document.querySelector(".cmp");
    if (!win || !cmp || cmp.hidden || cmp.getAttribute("data-state") !== "window") return null;
    const w = win.getBoundingClientRect();
    const hits = [];
    let checked = 0;
    for (const sel of sels) {
      for (const node of document.querySelectorAll(sel)) {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        checked += 1;
        const area = Math.max(0, Math.min(w.right, r.right) - Math.max(w.left, r.left)) * Math.max(0, Math.min(w.bottom, r.bottom) - Math.max(w.top, r.top));
        if (area > 0) hits.push({ sel, label: (node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 40), area: Math.round(area) });
      }
    }
    return { checked, hits };
  }, selectors);
}

async function clipAround(page, selector, pad = 36) {
  const r = await rectOf(page, selector);
  const vw = page.viewportSize();
  const left = Math.max(0, Math.floor(r.left - pad)), top = Math.max(0, Math.floor(r.top - pad));
  const right = Math.min(vw.width, Math.ceil(r.right + pad)), bottom = Math.min(vw.height, Math.ceil(r.bottom + pad));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

async function shoot(page, name, clip) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, clip, scale: "css" });
  const { size } = await stat(file);
  shots.push({ file: `design/living-companion/evidence/LC-21/${name}.png`, bytes: size, overLimit: size > 300 * 1024 });
  return size;
}

async function scanCompanionSource() {
  const files = [];
  for (const name of await readdir(path.join(ROOT, "apps", "web", "components", "companion"))) {
    if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(path.join("apps", "web", "components", "companion", name));
  }
  for (const name of await readdir(path.join(ROOT, "apps", "web", "lib"))) {
    if (/^(companion-.*|quiet-feedback)\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(path.join("apps", "web", "lib", name));
  }
  for (const name of await readdir(path.join(ROOT, "apps", "web", "lib", "companion-motion"))) {
    if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(path.join("apps", "web", "lib", "companion-motion", name));
  }
  const hits = [];
  for (const rel of files) {
    const lines = (await readFile(path.join(ROOT, rel), "utf8")).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (NETWORK_OR_SENSOR.test(line)) hits.push(`${rel.split(path.sep).join("/")}:${index + 1}`);
    });
  }
  return { files: files.length, hits };
}

async function L02() {
  if (!want("L02")) return;
  const files = ["apps/web/components/room/quiz-panel.tsx", "apps/web/components/room/cards-panel.tsx", "apps/web/components/room/learn-mission.tsx"];
  const header = /^\s*(export\s+)?(async\s+)?function\s+\w+|^\s*(const|let)\s+\w+\s*=\s*(async\s*)?(\(|function)/;
  const quizLines = (await readFile(path.join(ROOT, files[0]), "utf8")).split(/\r?\n/);
  const nextAt = quizLines.findIndex((line) => line.includes("onClick={next}"));
  const nextGated = nextAt > 0 && quizLines.slice(Math.max(0, nextAt - 12), nextAt).some((line) => /\bresult\s*\?/.test(line));
  const sites = [];
  for (const rel of files) {
    const lines = (await readFile(path.join(ROOT, rel), "utf8")).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (!/\bcompanion\.event\(|\bcompanionEvent\(/.test(text)) return;
      let start = index;
      while (start > 0 && !header.test(lines[start])) start -= 1;
      const enclosing = lines[start].trim().slice(0, 60);
      const awaitedCommit = lines.slice(start, index).some((line) => /\bawait\b/.test(line));
      const inlineClick = /onClick=/.test(text);
      const gatedByResult = enclosing.includes("function next") && nextGated;
      const verified = !inlineClick && ((awaitedCommit && index - start <= 60) || gatedByResult);
      sites.push({ file: rel, line: index + 1, call: text.trim().slice(0, 90), enclosing, awaitedCommit, gatedByResult, inlineClick, verified });
    });
  }
  const pending = sites.filter((site) => !site.verified);
  const note = `${sites.length} call sites; ${sites.length - pending.length} follow an awaited commit or a result-gated control; need owner review: ${pending.map((site) => `${site.file}:${site.line}`).join(", ") || "none"}`;
  recordStatic("L02", pending.length ? "OPEN" : "PASS", note, { sites });
}

function focusInfo(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    if (!node || !node.closest(".cmp, .cmpTab")) return null;
    const cs = getComputedStyle(node);
    return { cls: String(node.className), focusVisible: node.matches(":focus-visible"), outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, opacity: cs.opacity };
  });
}

async function settledWindow(page) {
  let previous = null;
  for (let i = 0; i < 20; i += 1) {
    const rect = await rectOf(page, ".cmpWin");
    if (previous && rect && Math.abs(rect.left - previous.left) < 0.5 && Math.abs(rect.top - previous.top) < 0.5) return rect;
    previous = rect;
    await page.waitForTimeout(150);
  }
  return previous;
}

function recordScriptError(id, vp, room, error, measured = {}) {
  const message = String(error?.message ?? error).split("\n")[0];
  results.push({ id, viewport: vp.name, size: vp.size, room, status: "FAIL", note: `FAIL: script error in this variant, not a product verdict: ${message}`, measured, flags: null });
  console.log(`FAIL ${id} ${vp.name} ${room}: script error: ${message}`);
}

async function UI01() {
  if (!want("UI01")) return;
  for (const vp of [DESKTOP, PHONE]) for (const room of ["legacy", "phase3"]) {
    const { context, page } = await openRoom(vp, { room });
    try {
      const v = new Verdict();
      const m = {};
      await holdDrawerOpen(page);
      await settledWindow(page);
      const s0 = await snapshot(page);
      const dx = -170, dy = -70;
      const gx = s0.grip.left + s0.grip.width / 2, gy = s0.grip.top + s0.grip.height / 2;
      await page.mouse.move(gx, gy);
      await page.mouse.down();
      await page.mouse.move(gx + dx / 2, gy + dy / 2, { steps: 6 });
      const mid = await snapshot(page);
      await page.mouse.move(gx + dx, gy + dy, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      const end = await snapshot(page);
      const c0 = centerOf(s0.win), cm = centerOf(mid.win), ce = centerOf(end.win);
      const rel = (s) => ({ x: centerOf(s.stage).x - centerOf(s.win).x, y: centerOf(s.stage).y - centerOf(s.win).y });
      const r0 = rel(s0), rm = rel(mid);
      m.midDelta = { x: Math.round(cm.x - c0.x), y: Math.round(cm.y - c0.y) };
      m.dragonDrift = { x: +(rm.x - r0.x).toFixed(1), y: +(rm.y - r0.y).toFixed(1) };
      m.endDelta = { x: Math.round(ce.x - c0.x), y: Math.round(ce.y - c0.y) };
      v.ok(cm.x - c0.x < -40 && cm.y - c0.y < -15, `frame follows the pointer mid-drag (${m.midDelta.x}, ${m.midDelta.y} px)`);
      v.ok(Math.abs(rm.x - r0.x) <= 3 && Math.abs(rm.y - r0.y) <= 3, "dragon stays in his frame while dragging");
      v.ok(insideViewport(end.win, page.viewportSize()), "frame is inside the viewport after the drop");
      if (room === "legacy") {
        v.ok(Math.abs(ce.x - c0.x - dx) <= 6 && Math.abs(ce.y - c0.y - dy) <= 6, "legacy room: the drop lands where the pointer let go");
      }
      await focusHit(page);
      const surfaceBox = await rectOf(page, ".modeSurface");
      const safeLeft = Math.max(surfaceBox ? surfaceBox.left : 0, 0) + 10;
      const safeRight = Math.min(surfaceBox ? surfaceBox.right : page.viewportSize().width, page.viewportSize().width) - 10;
      const start = await snapshot(page);
      const towardLeft = centerOf(start.win).x > (safeLeft + safeRight) / 2;
      const key = towardLeft ? "ArrowLeft" : "ArrowRight";
      const lefts = [Math.round(start.win.left)];
      m.focusDuringKeys = [];
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press(key);
        await page.waitForTimeout(600);
        lefts.push(Math.round((await snapshot(page)).win.left));
        m.focusDuringKeys.push(await page.evaluate(() => document.activeElement?.className?.toString().slice(0, 30) ?? null));
      }
      const finalLeft = lefts[lefts.length - 1];
      const expectedLeft = towardLeft ? Math.max(start.win.left - 80, safeLeft) : Math.min(start.win.left + 80, safeRight - start.win.width);
      m.keyboardKey = key;
      m.keyboardLeftSteps = lefts;
      m.safeArea = [Math.round(safeLeft), Math.round(safeRight)];
      m.keyboardDx = finalLeft - lefts[0];
      m.posAfterKeys = (await readPrefs(page))?.pos ?? null;
      v.ok(Math.abs(finalLeft - lefts[0]) >= 16, `arrow keys nudge him (${key}, ${m.keyboardDx} px over 5 presses)`);
      v.ok(Math.abs(finalLeft - expectedLeft) <= 3, `keyboard stops at the safe edge (left ${finalLeft}, expected ${Math.round(expectedLeft)}; safe area ${Math.round(safeLeft)} to ${Math.round(safeRight)})`);
      if (vp.isMobile) {
        const t0 = await snapshot(page);
        const { mid } = await touchDragBy(context, page, -90, -40);
        if (mid && mid.win) {
          const startCx = centerOf(t0.win).x, width = t0.win.width;
          const expectedMidX = Math.max(startCx - 45, 4 + width / 2);
          const midCx = centerOf(mid.win).x;
          m.touchMid = { startCenterX: Math.round(startCx), midCenterX: Math.round(midCx), expectedMidX: Math.round(expectedMidX) };
          v.ok(Math.abs(midCx - expectedMidX) <= 4, `touch drag follows the finger mid-gesture (centre ${Math.round(midCx)}, expected ${Math.round(expectedMidX)} with the 4 px viewport margin)`);
        } else {
          v.open("touch drag was not driven in this emulation; real-touch proof is owed to A06");
        }
      }
      record("UI01", vp, room, v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI02_03() {
  if (!want("UI02", "UI03")) return;
  for (const vp of [DESKTOP, PHONE]) for (const room of ["legacy", "phase3"]) {
    const { context, page } = await openRoom(vp, { room });
    try {
      const v2 = new Verdict(), v3 = new Verdict();
      const m2 = {}, m3 = {};
      await holdDrawerOpen(page);
      await settledWindow(page);
      const spot = await findFreeSpot(page);
      if (!spot) {
        v2.open("no free non-corner spot exists in this fixture layout");
      } else {
        const r0 = await rectOf(page, ".cmpWin");
        await dragBy(page, spot.x - r0.left, spot.y - r0.top);
        const end = await rectOf(page, ".cmpWin");
        const expected = { x: spot.x + end.width / 2, y: spot.y + end.height / 2 };
        const got = centerOf(end);
        m2.spot = spot;
        m2.expectedCenter = { x: Math.round(expected.x), y: Math.round(expected.y) };
        m2.gotCenter = { x: Math.round(got.x), y: Math.round(got.y) };
        const placed = Math.abs(got.x - expected.x) <= 4 && Math.abs(got.y - expected.y) <= 4;
        if (placed) {
          v2.ok(true, "frame stays where it was dropped");
        } else {
          v2.ok(false, room === "phase3"
            ? "Phase 3 seats him in a corner and ignores the saved spot (engine placeInRoom reads prefs.pos only when !safeRoom)"
            : `frame ended away from the drop point by (${Math.round(got.x - expected.x)}, ${Math.round(got.y - expected.y)}) px`);
        }
        const prefs = await readPrefs(page);
        const pos = prefs && prefs.pos;
        const extreme = (value) => value <= 0.001 || value >= 0.999;
        const normalized = Boolean(pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1 && !(extreme(pos.x) && extreme(pos.y)));
        m2.savedPos = pos ?? null;
        v2.ok(normalized, normalized ? `saved as a normalized non-corner position (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})` : "no normalized non-corner position saved");
      }
      const before = centerOf(await rectOf(page, ".cmpWin"));
      await page.reload({ waitUntil: "load", timeout: 180_000 });
      await waitForCompanion(page);
      await page.waitForTimeout(900);
      const afterReload = centerOf(await rectOf(page, ".cmpWin"));
      m3.reloadDelta = { x: +(afterReload.x - before.x).toFixed(1), y: +(afterReload.y - before.y).toFixed(1) };
      v3.ok(Math.abs(afterReload.x - before.x) <= 3 && Math.abs(afterReload.y - before.y) <= 3, `reload restores the same place (${m3.reloadDelta.x}, ${m3.reloadDelta.y} px)`);
      const full = page.viewportSize();
      const small = { width: Math.round(full.width * 0.6), height: Math.round(full.height * 0.8) };
      await page.setViewportSize(small);
      await page.waitForTimeout(1000);
      const shrunk = await rectOf(page, ".cmpWin");
      v3.ok(insideViewport(shrunk, small), `after resizing to ${small.width}x${small.height} he is fully inside the viewport`);
      await page.setViewportSize(full);
      await page.waitForTimeout(1000);
      const back = centerOf(await rectOf(page, ".cmpWin"));
      m3.restoreDelta = { x: +(back.x - before.x).toFixed(1), y: +(back.y - before.y).toFixed(1) };
      v3.ok(Math.abs(back.x - before.x) <= 4 && Math.abs(back.y - before.y) <= 4, `returns to the same place after resizing back (${m3.restoreDelta.x}, ${m3.restoreDelta.y} px)`);
      v3.open("keyboard open/close and real viewport rotation are not automated here");
      record("UI02", vp, room, v2, m2, await flagsOf(page));
      record("UI03", vp, room, v3, m3, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI04() {
  if (!want("UI04")) return;
  const cases = [
    { vp: DESKTOP, room: "legacy", mode: "quiz", selectors: [".confidenceButtons button", ".studyGroups button"] },
    { vp: DESKTOP, room: "phase3", mode: "quiz", selectors: [".roomStudioSubmit", ".studyGroups button"] },
    { vp: DESKTOP, room: "legacy", mode: "coach", selectors: [".chatSend", ".chatComposer textarea", ".chatComposer input", ".studyGroups button"] },
    { vp: DESKTOP, room: "phase3", mode: "coach", selectors: [".chatSend", ".chatComposer textarea", ".chatComposer input", ".studyGroups button"] },
    { vp: PHONE, room: "phase3", mode: "quiz", selectors: [".roomStudioSubmit", ".studyGroups button"] },
    { vp: PHONE, room: "phase3", mode: "coach", selectors: [".chatSend", ".chatComposer textarea", ".studyGroups button"] }
  ];
  for (const c of cases) {
    const { context, page } = await openRoom(c.vp, { room: c.room, mode: c.mode });
    try {
      const v = new Verdict();
      if (c.vp === DESKTOP) await holdDrawerOpen(page);
      await page.waitForTimeout(800);
      const report = await overlapReport(page, c.selectors);
      if (!report) v.open("companion is seated in this state, so nothing can be covered");
      else if (report.checked === 0) v.open("none of the target controls rendered in this state");
      else v.ok(report.hits.length === 0, report.hits.length ? `overlaps ${report.hits.map((h) => `${h.sel} "${h.label}" (${h.area} px2)`).join(", ")}` : `no overlap with ${report.checked} controls`);
      record("UI04", c.vp, `${c.room} ${c.mode}`, v, { report }, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await openRoom(DESKTOP, { room: "phase3", mode: "quiz" });
    try {
      const v = new Verdict();
      await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        const block = document.createElement("button");
        block.id = "qa-occluder";
        block.type = "button";
        block.setAttribute("aria-label", "Synthetic occupied space (QA)");
        block.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none;";
        surface.appendChild(block);
      });
      await page.waitForFunction(() => document.querySelector(".cmp")?.hidden === true, null, { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(700);
      const seat = await page.evaluate(() => {
        const tab = document.querySelector(".cmpTab");
        const r = tab.getBoundingClientRect();
        return { cmpHidden: document.querySelector(".cmp").hidden, tabVisible: !tab.hidden && r.width > 0 && r.height > 0, tab: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } };
      });
      v.ok(seat.cmpHidden, "no safe corner: he is seated (window hidden)");
      v.ok(seat.tabVisible, "bring-back tab (.cmpTab) is visible while he is seated");
      await shoot(page, "UI04-phase3-seated-no-safe-corner", await clipAround(page, ".cmpTab", 140));
      let summoned = null;
      if (seat.tabVisible) {
        await page.click(".cmpTab");
        await page.waitForTimeout(800);
        summoned = await page.evaluate(() => document.querySelector(".cmp").hidden === false);
        v.ok(summoned, "the bring-back tab summons him again");
      }
      record("UI04", DESKTOP, "phase3 quiz (no safe corner)", v, { seat, summoned }, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI05() {
  if (!want("UI05")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await holdDrawerOpen(page);
      m.sizeHandleShown = await page.evaluate(() => {
        const b = document.querySelector(".cmpSize");
        return Boolean(b && getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0);
      });
      if (m.sizeHandleShown) {
        m.kBefore = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".cmp")).getPropertyValue("--k")) || 1);
        await page.hover(".cmpWin");
        await page.click(".cmpSize");
        await page.waitForTimeout(800);
        m.kAfter = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".cmp")).getPropertyValue("--k")) || 1);
        m.savedScale = await page.evaluate((key) => localStorage.getItem(key), SCALE_KEY);
        v.ok(m.kAfter > m.kBefore + 0.2, `resize handle steps size ${m.kBefore} -> ${m.kAfter}`);
      } else {
        v.open("resize handle is hidden on coarse pointers by design; pinch resize is not automated here");
      }
      await page.hover(".cmpWin");
      await page.click(".cmpSill");
      await page.waitForSelector(".cmpSheet", { state: "visible", timeout: 5000 });
      const opened = await page.evaluate(() => ({ expanded: document.querySelector(".cmpSill").getAttribute("aria-expanded"), role: document.querySelector(".cmpSheet")?.getAttribute("role") }));
      m.opened = opened;
      v.ok(opened.expanded === "true" && opened.role === "dialog", "menu opens as a dialog and the sill reports it");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const closed = await page.evaluate(() => ({
        gone: !document.querySelector(".cmpCard"),
        expanded: document.querySelector(".cmpSill").getAttribute("aria-expanded"),
        focusOnSill: document.activeElement?.classList.contains("cmpSill") === true
      }));
      m.closed = closed;
      v.ok(closed.gone && closed.expanded === "false", "Escape closes the menu");
      v.ok(closed.focusOnSill, "focus returns to Studigo's menu button");
      record("UI05", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI06() {
  if (!want("UI06")) return;
  for (const [vp, room] of [[DESKTOP, "phase3"], [PHONE, "phase3"], [DESKTOP, "legacy"]]) {
    const { context, page } = await openRoom(vp, { room });
    try {
      const v = new Verdict();
      const m = {};
      m.slotRendered = await page.evaluate(() => Boolean(document.querySelector(".cmpStripSlot")));
      if (!m.slotRendered) {
        v.open("this room renders no strip slot");
        record("UI06", vp, room, v, m, await flagsOf(page));
        continue;
      }
      await holdDrawerOpen(page);
      await setPrefs(page, { host: "strip" });
      await waitForStrip(page, true);
      m.layout = await page.evaluate(() => {
        const cmp = document.querySelector(".cmp");
        const slot = document.querySelector(".cmpStripSlot");
        const rail = document.querySelector(".studigoRail");
        const menu = document.querySelector(".cmpStripMenu");
        return {
          cmpCount: document.querySelectorAll(".cmp").length,
          hostCount: document.querySelectorAll(".cmpHost").length,
          inSlot: Boolean(slot && slot.contains(cmp)),
          slotDirectlyAboveRail: slot?.nextElementSibling === rail,
          previousSibling: slot?.previousElementSibling?.className?.toString() ?? null,
          menuGapRight: menu && slot ? Math.round(slot.getBoundingClientRect().right - menu.getBoundingClientRect().right) : null,
          slotHeight: slot ? Math.round(slot.getBoundingClientRect().height) : null
        };
      });
      v.ok(m.layout.cmpCount === 1, "exactly one companion in the DOM");
      v.ok(m.layout.inSlot, "companion sits inside the strip slot");
      v.ok(m.layout.slotDirectlyAboveRail, "the strip slot sits directly above the Studigo rail");
      v.ok(m.layout.menuGapRight !== null && m.layout.menuGapRight <= 40, `strip menu sits at the right edge (gap ${m.layout.menuGapRight} px)`);
      const tops = [];
      for (let i = 0; i < 30; i += 1) {
        tops.push((await rectOf(page, ".studigoRail")).top);
        await page.waitForTimeout(50);
      }
      m.railSpread = +(Math.max(...tops) - Math.min(...tops)).toFixed(2);
      v.ok(m.railSpread <= 1, `rail does not move while idle (spread ${m.railSpread} px over 1.5 s)`);
      if (vp === DESKTOP && room === "phase3") await shoot(page, "desktop-UI06-strip", await clipAround(page, ".cmpStripSlot", 40));
      record("UI06", vp, room, v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI07() {
  if (!want("UI07")) return;
  {
    const { context, page } = await openRoom(DESKTOP, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      const frame = () => page.evaluate(() => {
        const f = document.querySelector(".modeFrame");
        const s = document.querySelector(".cmpStripSlot");
        return { collapsed: f.getAttribute("data-collapsed"), headerH: Math.round(f.getBoundingClientRect().height), slotH: Math.round(s.getBoundingClientRect().height) };
      });
      await holdDrawerOpen(page);
      m.stripOff = await frame();
      await setPrefs(page, { host: "strip" });
      await waitForStrip(page, true);
      await holdDrawerOpen(page);
      m.stripOn = await frame();
      v.ok(m.stripOn.headerH - m.stripOff.headerH >= 50, `strip adds its band to the header (${m.stripOff.headerH} -> ${m.stripOn.headerH} px)`);
      await page.evaluate(() => window.studigoCompanion.event("setDone"));
      const tops = [], states = new Set();
      for (let i = 0; i < 50; i += 1) {
        const s = await page.evaluate(() => ({
          top: document.querySelector(".studigoRail").getBoundingClientRect().top,
          c: document.querySelector(".modeFrame").getAttribute("data-collapsed")
        }));
        tops.push(s.top);
        states.add(s.c);
        await page.waitForTimeout(50);
      }
      m.railSpread = +(Math.max(...tops) - Math.min(...tops)).toFixed(2);
      m.collapsedDuringSample = [...states];
      v.ok(m.railSpread <= 1, `rail top steady through a celebration (${m.railSpread} px over 2.5 s)`);
      v.ok(states.size === 1 && states.has("false"), "drawer stayed open during the sample");
      await page.mouse.move(4, DESKTOP.viewport.height - 4);
      await page.waitForFunction(() => document.querySelector(".modeFrame").getAttribute("data-collapsed") === "true", null, { timeout: 9000 });
      await page.waitForTimeout(800);
      m.tucked = await frame();
      v.ok(m.tucked.slotH === 0, `strip folds away with the drawer (slot ${m.tucked.slotH} px)`);
      await page.click(".modeCollapseToggle");
      await page.waitForTimeout(800);
      m.reopened = await frame();
      v.ok(m.reopened.slotH >= 50, `Show controls brings the strip back (slot ${m.reopened.slotH} px)`);
      m.headerRatioTucked = +(m.tucked.headerH / m.reopened.headerH).toFixed(2);
      record("UI07", DESKTOP, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await openRoom(PHONE, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await page.waitForTimeout(3600);
      m.collapsed = await page.evaluate(() => document.querySelector(".modeFrame").getAttribute("data-collapsed"));
      m.toggles = await page.locator(".modeCollapseToggle").count();
      m.modeStripHeight = await page.evaluate(() => Math.round(document.querySelector(".modeStrip").getBoundingClientRect().height));
      v.ok(m.collapsed === "false" && m.toggles === 0, "phone keeps the full header: no drawer and no Show controls");
      v.ok(m.modeStripHeight > 40, `phone header controls stay full size (${m.modeStripHeight} px)`);
      record("UI07", PHONE, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function UI08() {
  if (!want("UI08")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await holdDrawerOpen(page);
      await setPrefs(page, { host: "strip" });
      await waitForStrip(page, true);
      await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        surface.style.setProperty("height", "360px", "important");
        surface.style.setProperty("max-height", "360px", "important");
        surface.style.setProperty("overflow-y", "auto", "important");
        const spacer = document.createElement("div");
        spacer.setAttribute("data-qa-spacer", "");
        spacer.style.cssText = "height:2400px;flex:0 0 2400px;";
        surface.appendChild(spacer);
        surface.scrollTop = 0;
      });
      await page.waitForTimeout(600);
      const before = await snapshot(page);
      await page.evaluate(() => {
        document.querySelector(".modeSurface").scrollTop = 320;
      });
      await page.waitForTimeout(700);
      const after = await snapshot(page);
      m.scrollTop = await page.evaluate(() => document.querySelector(".modeSurface").scrollTop);
      v.ok(m.scrollTop >= 250, `page content scrolled (${m.scrollTop} px)`);
      const drift = (a, b) => Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top));
      m.drift = { strip: drift(before.slot, after.slot), rail: drift(before.rail, after.rail), frame: drift(before.frame, after.frame), dragon: drift(before.win, after.win) };
      v.ok(m.drift.strip <= 1 && m.drift.rail <= 1 && m.drift.frame <= 1, `strip, rail and header hold still (drift ${JSON.stringify(m.drift)})`);
      v.ok(m.drift.dragon <= 1, `dragon stays put with the strip (drift ${m.drift.dragon} px)`);
      record("UI08", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

/* The figure is drawn in a 400 x 400 art box (.cmpRigBody, or .cmpBody for the sprite renderer); the
   tips of his frills sit at y 46 in the rest drawing. The stage box itself may extend above the strip on
   purpose, so clipping is judged on the drawn head, not on the box. */
const ART_HEAD_TOP = 46 / 400;
const drawnHeadTop = (page) => page.evaluate((ratio) => {
  const box = (document.querySelector(".cmp .cmpRigBody") ?? document.querySelector(".cmp .cmpBody")).getBoundingClientRect();
  return box.top + box.height * ratio;
}, ART_HEAD_TOP);

async function UI09() {
  if (!want("UI09")) return;
  const { context, page } = await openRoom(PHONE, { room: "phase3" });
  try {
    const v = new Verdict();
    const m = {};
    await setPrefs(page, { host: "strip" });
    await waitForStrip(page, true);
    const s = await snapshot(page);
    m.slot = { top: Math.round(s.slot.top), height: Math.round(s.slot.height) };
    m.stage = { top: Math.round(s.stage.top), bottom: Math.round(s.stage.bottom) };
    m.railTop = Math.round(s.rail.top);
    m.headTop = Math.round(await drawnHeadTop(page));
    v.ok(m.headTop >= s.slot.top - 0.5, `drawn head top ${m.headTop} is not clipped above the strip top ${Math.round(s.slot.top)}`);
    v.ok(s.stage.bottom <= s.rail.top + 1, `figure stays above the rail (bottom ${Math.round(s.stage.bottom)}, rail ${Math.round(s.rail.top)})`);
    await page.evaluate(() => {
      const surface = document.querySelector(".modeSurface");
      const inView = (b) => {
        const r = b.getBoundingClientRect();
        return r.width > 20 && r.height > 20 && r.top > 0 && r.bottom < innerHeight;
      };
      const buttons = Array.from(surface.querySelectorAll("button:not(:disabled)"));
      if (!buttons.some(inView) && buttons[0]) buttons[0].scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(500);
    m.control = await page.evaluate(() => {
      const surface = document.querySelector(".modeSurface");
      const candidates = Array.from(surface.querySelectorAll("button:not(:disabled)")).filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 20 && r.height > 20 && r.top > 0 && r.bottom < innerHeight;
      });
      const btn = candidates[0];
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        label: (btn.getAttribute("aria-label") || btn.textContent || "").trim().slice(0, 40),
        clickable: Boolean(hit && (hit === btn || btn.contains(hit))),
        coveredByCompanion: Boolean(hit && hit.closest(".cmp")),
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      };
    });
    if (!m.control) {
      v.open("no practice button was found in the fixture surface");
    } else {
      v.ok(m.control.clickable && !m.control.coveredByCompanion, `practice control "${m.control.label}" is clickable and not covered`);
      m.controlOverlap = Math.round(overlapArea(m.control.rect, s.win));
      v.ok(m.controlOverlap === 0, `practice control does not overlap his window (${m.controlOverlap} px2)`);
    }
    await shoot(page, "phone-UI09-strip", await clipAround(page, ".cmpStripSlot", 12));
    record("UI09", PHONE, "phase3 quiz strip", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

async function UI10() {
  if (!want("UI10")) return;
  for (const [vp, room] of [[DESKTOP, "phase3"], [PHONE, "phase3"], [DESKTOP, "legacy"]]) {
    const { context, page } = await openRoom(vp, { room });
    try {
      const v = new Verdict();
      const m = {};
      const tally = () => page.evaluate(() => ({
        companions: document.querySelectorAll(".cmp").length,
        rigCanvases: document.querySelectorAll(".cmpRig").length,
        hosts: document.querySelectorAll(".cmpHost").length
      }));
      await setPrefs(page, { speech: true, outfit: "goggles", calm: true });
      m.float = await tally();
      m.hasStrip = await page.evaluate(() => Boolean(document.querySelector(".cmpStripSlot")));
      if (m.hasStrip) {
        await setPrefs(page, { host: "strip" });
        await waitForStrip(page, true);
        m.strip = await tally();
        await setPrefs(page, { host: "float" });
        await waitForStrip(page, false);
      }
      m.back = await tally();
      const prefs = await readPrefs(page);
      m.prefs = { speech: prefs?.speech, outfit: prefs?.outfit, calm: prefs?.calm, host: prefs?.host };
      const samples = [m.float, m.strip, m.back].filter(Boolean);
      v.ok(samples.every((s) => s.companions === 1 && s.hosts === 1), "exactly one companion and one host in every placement");
      v.ok(new Set(samples.map((s) => s.rigCanvases)).size === 1, `rig canvases constant across placements (${samples.map((s) => s.rigCanvases).join("/")})`);
      v.ok(prefs && prefs.speech === true && prefs.outfit === "goggles" && prefs.calm === true, "speech, outfit and calm survive float -> strip -> float");
      if (!m.hasStrip) v.open("this room renders no strip slot, so only the float placement was checked");
      record("UI10", vp, room, v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function L01() {
  if (!want("L01")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      const read = () => page.evaluate(() => ({
        thinkingClass: document.querySelector(".cmp").classList.contains("thinking"),
        anim: getComputedStyle(document.querySelector(".cmpWin")).animationName
      }));
      await page.evaluate(() => window.studigoCompanion.thinking(true));
      await page.waitForTimeout(400);
      m.on = await read();
      await page.evaluate(() => window.studigoCompanion.thinking(false));
      await page.waitForTimeout(400);
      m.off = await read();
      v.ok(m.on.thinkingClass, "thinking(true) adds .cmp.thinking");
      v.ok(m.on.anim === "cmpThink", `thinking loop animates (${m.on.anim})`);
      v.ok(!m.off.thinkingClass, "thinking(false) removes .cmp.thinking");
      v.ok(m.off.anim === "none", `thinking loop stops (${m.off.anim})`);
      record("L01", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function L03() {
  if (!want("L03")) return;
  const source = await scanCompanionSource();
  const { context, page } = await openRoom(DESKTOP, { room: "phase3", mode: "coach", learn: "mission" });
  try {
    const v = new Verdict();
    const m = { sourceFiles: source.files, sourceHits: source.hits };
    v.ok(source.hits.length === 0, `companion source has no network, storage-write or sensor call (${source.hits.length} hits)`);
    const writes = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    const hint = page.locator('button[aria-label="Give me a hint"]');
    m.hintControls = await hint.count();
    if (m.hintControls > 0) {
      await hint.first().click();
      await page.waitForTimeout(500);
    }
    for (const name of EVENTS) await page.evaluate((n) => window.studigoCompanion.event(n), name);
    await page.waitForTimeout(800);
    m.writes = writes;
    v.ok(writes.length === 0, `no write request from the hint or the 11 companion events (${writes.length})`);
    v.open("formative lesson progress and unchanged mastery need the owner's product check; only the absence of writes is automated");
    record("L03", DESKTOP, "learn mission", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

async function L04() {
  if (!want("L04")) return;
  for (const [vp, room] of [[DESKTOP, "legacy"], [DESKTOP, "phase3"], [PHONE, "phase3"]]) {
    const { context, page, errors } = await openRoom(vp, { room });
    try {
      const v = new Verdict();
      const m = {};
      const before = errors.length;
      const sent = [];
      for (let i = 0; i < 20; i += 1) {
        const name = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        sent.push(name);
        await page.evaluate((n) => window.studigoCompanion.event(n), name);
        await page.waitForTimeout(100);
      }
      const lastAt = Date.now();
      const sample = () => page.evaluate(() => {
        const cmp = document.querySelector(".cmp");
        return {
          present: document.querySelectorAll(".cmp").length,
          pose: cmp ? cmp.getAttribute("data-pose") : null,
          rig: document.querySelectorAll(".cmpRig").length,
          onAll: document.querySelectorAll(".cmpPose.on").length,
          onNonCenter: document.querySelectorAll('.cmpPose.on:not([data-pose="center"])').length
        };
      });
      let settledMs = null, last = null;
      while (Date.now() - lastAt < 3000) {
        last = await sample();
        const atRest = last.present === 1 && last.pose === "center" && last.onNonCenter === 0 && (last.rig === 1 ? last.onAll === 0 : true);
        if (atRest) {
          settledMs = Date.now() - lastAt;
          break;
        }
        await page.waitForTimeout(100);
      }
      m.sent = sent.length;
      m.distinctEvents = new Set(sent).size;
      m.settledMs = settledMs;
      m.last = last;
      v.ok(Boolean(last) && last.present === 1, "one companion still present after the burst");
      v.ok(settledMs !== null, settledMs !== null ? `back at rest ${settledMs} ms after the last event` : "did not return to rest within 3 s");
      const fresh = errors.slice(before);
      v.ok(fresh.length === 0, fresh.length ? `errors: ${fresh.slice(0, 3).join(" / ")}` : "no console or page errors during the burst");
      record("L04", vp, room, v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function L05() {
  if (!want("L05")) return;
  const tally = (page) => page.evaluate(() => ({ companions: document.querySelectorAll(".cmp").length, hosts: document.querySelectorAll(".cmpHost").length }));
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page, errors } = await openRoom(vp, { room: "phase3", mode: "quiz" });
    const v = new Verdict();
    const m = {};
    try {
      const before = errors.length;
      await page.goto(pageUrl({ mode: "coach", room: "phase3" }), { waitUntil: "load", timeout: 180_000 });
      await waitForCompanion(page);
      await page.waitForTimeout(600);
      m.otherFixture = await tally(page);
      await page.goto(pageUrl({ mode: "quiz", room: "phase3" }), { waitUntil: "load", timeout: 180_000 });
      await waitForCompanion(page);
      await page.waitForTimeout(600);
      m.back = await tally(page);
      const nav = page.locator(".studyGroups button:visible:not([aria-current]):not(:disabled)");
      m.navButtons = await nav.count();
      await holdDrawerOpen(page);
      if (m.navButtons > 0) {
        m.navClicked = await nav.nth(0).click({ timeout: 8000 }).then(() => true, (error) => {
          m.navClickError = String(error.message).split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5).join(" / ");
          return false;
        });
        await page.waitForTimeout(900);
      }
      m.afterSwitch = await tally(page);
      await page.evaluate(() => window.studigoCompanion.event("correct"));
      await page.waitForTimeout(300);
      const fresh = errors.slice(before);
      v.ok(m.otherFixture.companions === 1 && m.back.companions === 1 && m.afterSwitch.companions === 1, "exactly one companion after each navigation");
      v.ok(m.back.hosts === 1, "one host element after returning");
      v.ok(fresh.length === 0, fresh.length ? `errors: ${fresh.slice(0, 3).join(" / ")}` : "no console or page errors across the navigations");
      if (m.navClicked === false) v.open(`the second section button could not be clicked in this state, so the in-room switch was not exercised (${m.navClickError})`);
      v.open("cross-room isolation and stale events between rooms need a second room fixture; only one synthetic room exists");
      record("L05", vp, "phase3 quiz", v, m, await flagsOf(page));
    } catch (error) {
      recordScriptError("L05", vp, "phase3 quiz", error, m);
    } finally {
      await context.close();
    }
  }
}

async function L06() {
  if (!want("L06")) return;
  const { context, page } = await openRoom(DESKTOP, { room: "phase3", mode: "coach", learn: "mission" });
  try {
    const v = new Verdict();
    const m = {};
    m.citations = await page.evaluate(() => {
      const win = document.querySelector(".cmpWin");
      const w = win ? win.getBoundingClientRect() : null;
      return Array.from(document.querySelectorAll(".lessonCitations button, .lessonCitations a, .lessonCitations [role='button']")).map((node) => {
        const r = node.getBoundingClientRect();
        const area = w ? Math.max(0, Math.min(w.right, r.right) - Math.max(w.left, r.left)) * Math.max(0, Math.min(w.bottom, r.bottom) - Math.max(w.top, r.top)) : 0;
        return { label: (node.textContent || node.getAttribute("aria-label") || "").trim().slice(0, 40), visible: r.width > 0, overlap: Math.round(area) };
      });
    });
    if (m.citations.length === 0) v.open("no citation controls are rendered in the synthetic Learn fixture");
    else v.ok(m.citations.every((c) => c.overlap === 0), `citation controls are not covered by him (${m.citations.length} checked)`);
    v.open("RLS and source disclosure need a signed-in room with real files; only overlap is automated");
    record("L06", DESKTOP, "learn mission", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

async function L07() {
  if (!want("L07")) return;
  const source = await scanCompanionSource();
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = { sourceFiles: source.files, sourceHits: source.hits };
      v.ok(source.hits.length === 0, `companion source has no fetch, beacon, socket or sensor call (${source.hits.length} hits)`);
      const requests = [];
      page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() ?? "" }));
      page.on("websocket", (socket) => requests.push({ url: socket.url(), method: "WS", body: "" }));
      await holdDrawerOpen(page);
      const started = Date.now();
      let step = 0;
      while (Date.now() - started < 10_000) {
        const x = 40 + ((step * 137) % (vp.viewport.width - 80));
        const y = 150 + ((step * 89) % (vp.viewport.height - 240));
        await page.mouse.move(x, y, { steps: 3 });
        step += 1;
        if (step === 15) await page.click(".cmpHit");
        if (step === 30) {
          await page.click(".cmpSill");
          await page.keyboard.press("Escape");
        }
        if (step === 45) await dragBy(page, -40, -20);
      }
      await page.waitForTimeout(400);
      const origin = new URL(BASE).host;
      const hosts = [...new Set(requests.map((r) => {
        try {
          return new URL(r.url).host;
        } catch {
          return r.url;
        }
      }))];
      const foreign = hosts.filter((h) => h !== origin);
      const writes = requests.filter((r) => !["GET", "HEAD", "WS"].includes(r.method)).map((r) => `${r.method} ${r.url}`);
      const leaks = requests.filter((r) => COORD_KEYS.test(r.url) || COORD_KEYS.test(r.body)).map((r) => r.url);
      m.requests = requests.length;
      m.hosts = hosts;
      m.foreignHosts = foreign;
      m.writes = writes;
      m.coordinateLeaks = leaks;
      v.ok(foreign.length === 0, `no third-party host during 10 s of pointer and companion use (hosts: ${hosts.join(", ")})`);
      v.ok(leaks.length === 0, "no request carries pointer coordinates");
      v.ok(writes.length === 0, "no write request during the pointer test");
      record("L07", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function A01() {
  if (!want("A01")) return;
  for (const [vp, room] of [[DESKTOP, "legacy"], [DESKTOP, "phase3"], [PHONE, "phase3"]]) {
    const { context, page } = await openRoom(vp, { room });
    const v = new Verdict();
    const m = {};
    try {
      await holdDrawerOpen(page);
      await page.evaluate(() => document.activeElement?.blur());
      const need = vp === DESKTOP ? ["cmpHit", "cmpSill", "cmpSize", "cmpMin"] : ["cmpHit", "cmpSill", "cmpMin"];
      const tracked = [...need, "cmpTab"];
      m.stateAtLoad = await page.evaluate(() => ({ hidden: document.querySelector(".cmp").hidden, state: document.querySelector(".cmp").getAttribute("data-state") }));
      const reached = {};
      m.trail = [];
      for (let i = 0; i < 320 && Object.keys(reached).length < tracked.length; i += 1) {
        await page.keyboard.press("Tab");
        if (i < 40 || i % 40 === 39) {
          m.trail.push({
            tab: i + 1,
            hidden: await page.evaluate(() => document.querySelector(".cmp").hidden),
            surfaceScrollTop: await page.evaluate(() => document.querySelector(".modeSurface")?.scrollTop ?? null),
            windowY: await page.evaluate(() => window.scrollY)
          });
        }
        const info = await focusInfo(page);
        if (!info) continue;
        const key = tracked.find((k) => info.cls.includes(k));
        if (key && !reached[key]) {
          await page.waitForTimeout(350);
          reached[key] = { index: i, ...(await focusInfo(page)) };
        }
      }
      m.tabIndex = Object.fromEntries(tracked.map((k) => [k, reached[k] ? reached[k].index : null]));
      m.stateAfterTab = await page.evaluate(() => ({ hidden: document.querySelector(".cmp").hidden, state: document.querySelector(".cmp").getAttribute("data-state") }));
      for (const key of need) {
        const r = reached[key];
        v.ok(Boolean(r), `Tab reaches ${key}`);
        if (r) v.ok(r.focusVisible && r.outlineStyle !== "none" && parseFloat(r.outlineWidth) > 0 && parseFloat(r.opacity) > 0, `focus ring visible on ${key} (${r.outlineStyle} ${r.outlineWidth})`);
      }
      m.names = await page.evaluate(() => ({
        hit: document.querySelector(".cmpHit")?.getAttribute("aria-label") ?? null,
        sill: document.querySelector(".cmpSill")?.getAttribute("aria-label") ?? null,
        size: document.querySelector(".cmpSize")?.getAttribute("aria-label") ?? null,
        min: document.querySelector(".cmpMin")?.getAttribute("aria-label") ?? null,
        grip: document.querySelector(".cmpGrip")?.getAttribute("aria-label") ?? null,
        gripTabIndex: document.querySelector(".cmpGrip")?.getAttribute("tabindex") ?? null
      }));
      v.ok(["hit", "sill", "min"].every((k) => Boolean(m.names[k])) && (vp === PHONE || Boolean(m.names.size)), "accessible names on the pet area, menu, resize and minimize controls");
      v.ok(m.names.gripTabIndex === "-1", "the drag grip is not a Tab stop; arrow keys on the pet area are its keyboard path");
      if (m.stateAfterTab.hidden) {
        m.seatedAfterTab = true;
        const tabShown = await page.evaluate(() => {
          const t = document.querySelector(".cmpTab");
          return Boolean(t && !t.hidden && t.getBoundingClientRect().width > 0);
        });
        if (tabShown) {
          await page.click(".cmpTab");
          await page.waitForTimeout(800);
        }
        m.restoredFromSeat = await page.evaluate(() => !document.querySelector(".cmp").hidden);
      }
      await page.evaluate(() => document.querySelector(".cmpSill").focus());
      await page.keyboard.press("Enter");
      const opened = await page.waitForSelector(".cmpSheet", { state: "visible", timeout: 5000 }).then(() => true, () => false);
      m.enter = await page.evaluate(() => ({
        active: document.activeElement?.className?.toString().slice(0, 40) ?? null,
        activeInCard: Boolean(document.activeElement?.closest(".cmpCard")),
        cards: document.querySelectorAll(".cmpCard").length,
        expanded: document.querySelector(".cmpSill").getAttribute("aria-expanded"),
        cmpHidden: document.querySelector(".cmp").hidden
      }));
      m.enterOpened = opened;
      if (opened) await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      m.escape = await page.evaluate(() => ({ cards: document.querySelectorAll(".cmpCard").length, active: document.activeElement?.className?.toString().slice(0, 40) ?? null }));
      if (m.escape.cards > 0) {
        await page.evaluate(() => document.querySelector('.cmpCard [data-card="close"]')?.click());
        await page.waitForTimeout(300);
        m.closedByClick = true;
      }
      m.focusAfterEscape = await page.evaluate(() => document.activeElement?.className?.toString() ?? null);
      v.ok(opened && m.escape.cards === 0 && String(m.focusAfterEscape).includes("cmpSill"), opened ? "keyboard Enter opens the menu, Escape closes it and focus returns to the sill" : "keyboard Enter did not open the menu (see enter diagnostics)");
      m.cardsBeforeMinimize = await page.evaluate(() => document.querySelectorAll(".cmpCard").length);
      m.windowYBeforeMinimize = await page.evaluate(() => window.scrollY);
      await page.hover(".cmpWin");
      await page.click(".cmpMin");
      await page.waitForTimeout(700);
      m.afterMinimize = await page.evaluate(() => {
        const t = document.querySelector(".cmpTab");
        const r = t.getBoundingClientRect();
        return { focus: document.activeElement?.className?.toString() ?? null, tabVisible: !t.hidden && r.width > 0 };
      });
      v.ok(m.afterMinimize.tabVisible && String(m.afterMinimize.focus).includes("cmpTab"), "minimize shows the bring-back tab and moves focus to it");
      await page.click(".cmpTab");
      await page.waitForTimeout(800);
      m.summon = await page.evaluate(() => ({ windowY: window.scrollY, hidden: document.querySelector(".cmp").hidden }));
      v.ok(!m.summon.hidden, "the bring-back tab restores him after a minimize (see summon: windowY and hidden)");
      record("A01", vp, room, v, m, await flagsOf(page));
    } catch (error) {
      recordScriptError("A01", vp, room, error, m);
    } finally {
      await context.close();
    }
  }
}

async function A02() {
  if (!want("A02")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3", contextExtra: { reducedMotion: "reduce" } });
    try {
      const v = new Verdict();
      const m = {};
      m.calm = await page.evaluate(() => document.querySelector(".cmp").hasAttribute("data-calm"));
      v.ok(m.calm === true, "reduced-motion preference turns on calm mode");
      const targets = [".cmpWin", ".cmpBody", ".cmpRigBody", ".cmpStage"];
      const translations = () => page.evaluate((selectors) => selectors.map((selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const matrix = getComputedStyle(node).transform;
        const match = matrix && matrix !== "none" ? matrix.match(/^matrix(3d)?\((.+)\)$/) : null;
        if (!match) return [0, 0];
        const n = match[2].split(",").map(Number);
        return match[1] ? [n[12], n[13]] : [n[4], n[5]];
      }), targets);
      const base = await translations();
      await page.evaluate(() => window.studigoCompanion.event("setDone"));
      let maxMove = 0, maxSparks = 0, samples = 0;
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const now = await translations();
        base.forEach((origin, i) => {
          if (origin && now[i]) maxMove = Math.max(maxMove, Math.abs(now[i][0] - origin[0]), Math.abs(now[i][1] - origin[1]));
        });
        maxSparks = Math.max(maxSparks, await page.evaluate(() => document.querySelectorAll(".cmpFx .fx").length));
        samples += 1;
        await page.waitForTimeout(50);
      }
      m.maxCssMove = +maxMove.toFixed(2);
      m.maxSparks = maxSparks;
      m.samples = samples;
      m.bodyAnimation = await page.evaluate(() => getComputedStyle(document.querySelector(".cmpBody")).animationName);
      v.ok(maxSparks === 0, `no sparks or hearts during the celebration (max ${maxSparks})`);
      v.ok(maxMove <= 2, `no CSS hop: largest translate change ${m.maxCssMove} px over ${samples} samples`);
      v.ok(m.bodyAnimation === "none", `body animation is off (${m.bodyAnimation})`);
      v.open("rig-level motion is drawn in WebGL, so DOM checks cannot see mesh movement; owner visual check needed");
      record("A02", vp, "phase3 quiz, reduced motion", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function A03() {
  if (!want("A03")) return;
  const cases = [
    { name: "desktop", viewport: { width: 720, height: 450 }, isMobile: false, hasTouch: false },
    { name: "phone", viewport: { width: 195, height: 422 }, isMobile: true, hasTouch: true }
  ];
  for (const c of cases) {
    const context = await browser.newContext({ viewport: c.viewport, deviceScaleFactor: 2, isMobile: c.isMobile, hasTouch: c.hasTouch, reducedMotion: "no-preference" });
    try {
      const page = await context.newPage();
      await page.goto(pageUrl({ mode: "quiz", room: "phase3" }), { waitUntil: "load", timeout: 180_000 });
      await waitForCompanion(page);
      await page.waitForTimeout(900);
      const v = new Verdict();
      const m = { viewport: `${c.viewport.width}x${c.viewport.height} at device scale 2 (200% zoom equivalent)` };
      m.overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const culprits = Array.from(document.querySelectorAll("body *"))
          .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 6)
          .map((node) => ({ tag: node.tagName, cls: String(node.className).slice(0, 50), inCompanion: Boolean(node.closest(".cmp")) }));
        return { scrollWidth: docEl.scrollWidth, clientWidth: docEl.clientWidth, culprits };
      });
      m.companion = await page.evaluate(() => {
        const cmp = document.querySelector(".cmp");
        const win = document.querySelector(".cmpWin");
        if (!cmp || cmp.hidden || !win) return { seated: true };
        const r = win.getBoundingClientRect();
        const primary = document.querySelector(".roomStudioSubmit, .confidenceButtons button");
        const pr = primary ? primary.getBoundingClientRect() : null;
        const overlap = pr ? Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left)) * Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top)) : null;
        return {
          seated: false,
          inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          overlapPrimary: overlap === null ? null : Math.round(overlap),
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
        };
      });
      const pageOverflow = m.overflow.scrollWidth > m.overflow.clientWidth;
      const companionOverflow = m.overflow.culprits.some((culprit) => culprit.inCompanion);
      v.ok(!pageOverflow, pageOverflow ? `horizontal overflow ${m.overflow.scrollWidth} > ${m.overflow.clientWidth} (culprits: ${m.overflow.culprits.map((x) => x.cls || x.tag).join(", ")})` : "no horizontal overflow");
      v.ok(!companionOverflow, "no companion element causes overflow");
      if (!m.companion.seated) {
        v.ok(m.companion.inside, "companion fits inside the zoomed viewport");
        v.ok(m.companion.overlapPrimary === 0 || m.companion.overlapPrimary === null, `companion does not cover the primary control (overlap ${m.companion.overlapPrimary} px2)`);
      } else {
        v.open("companion is seated at this zoom; nothing to fit");
      }
      await setPrefs(page, { host: "strip" });
      await waitForStrip(page, true);
      m.stripMode = await page.evaluate(() => {
        const cmp = document.querySelector(".cmp");
        const slot = document.querySelector(".cmpStripSlot");
        const stage = document.querySelector(".cmpStage");
        const s = slot.getBoundingClientRect();
        const st = stage.getBoundingClientRect();
        return {
          docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          inSlot: slot.contains(cmp),
          slotTop: Math.round(s.top),
          stageTop: Math.round(st.top),
          menuWidth: Math.round(document.querySelector(".cmpStripMenu")?.getBoundingClientRect().width ?? 0)
        };
      });
      v.ok(m.stripMode.docOverflow <= 0, `strip mode at 200%: no horizontal overflow (${m.stripMode.docOverflow} px)`);
      m.stripMode.headTop = Math.round(await drawnHeadTop(page));
      v.ok(m.stripMode.inSlot && m.stripMode.headTop >= m.stripMode.slotTop - 0.5, `strip mode at 200%: drawn head (${m.stripMode.headTop}) sits inside the strip (top ${m.stripMode.slotTop}) and is not clipped above`);
      record("A03", { name: c.name, size: `${c.viewport.width}x${c.viewport.height}` }, "phase3 quiz, 200% zoom", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function A04() {
  if (!want("A04")) return;
  const { context, page } = await openRoom(DESKTOP, { room: "phase3" });
  try {
    const v = new Verdict();
    const m = {};
    await holdDrawerOpen(page);
    await page.evaluate(() => {
      window.__qaRafCalls = 0;
      const raw = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        window.__qaRafCalls += 1;
        return raw(callback);
      };
    });
    await settledWindow(page);
    m.drawerBefore = await page.evaluate(() => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") ?? null);
    const before = await snapshot(page);
    const other = await context.newPage();
    await other.setContent("<p>second tab</p>");
    await other.bringToFront();
    await page.waitForTimeout(500);
    m.visibility = await page.evaluate(() => ({ hidden: document.hidden, state: document.visibilityState }));
    await page.evaluate(() => {
      window.__qaRafCalls = 0;
    });
    await page.waitForTimeout(2000);
    m.rafCallsWhileHidden = await page.evaluate(() => window.__qaRafCalls);
    await page.bringToFront();
    await holdDrawerOpen(page);
    await settledWindow(page);
    m.drawerAfter = await page.evaluate(() => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") ?? null);
    const after = await snapshot(page);
    await other.close();
    m.jumpPx = before.win && after.win ? Math.round(Math.max(Math.abs(before.win.left - after.win.left), Math.abs(before.win.top - after.win.top))) : null;
    v.ok(m.jumpPx !== null && m.jumpPx <= 2, `no position jump after returning (${m.jumpPx} px)`);
    if (m.visibility.hidden) {
      v.ok(m.rafCallsWhileHidden <= 5, `companion schedules no frames while hidden (${m.rafCallsWhileHidden} requestAnimationFrame calls in 2 s)`);
    } else {
      v.open(`headless Chromium kept this page visible (document.hidden=${m.visibility.hidden}), so the background freeze was not reproduced; the count of ${m.rafCallsWhileHidden} is visible-state data`);
    }
    record("A04", DESKTOP, "phase3 quiz", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

async function A05() {
  if (!want("A05")) return;
  {
    const { context, page, errors } = await openRoom(DESKTOP, { room: "phase3", initScript: NO_WEBGL });
    try {
      const v = new Verdict();
      const m = {};
      await page.waitForTimeout(800);
      m.rigCanvases = await page.locator(".cmpRig").count();
      m.posesInDom = await page.locator(".cmpPose").count();
      m.motionAttr = await page.evaluate(() => document.querySelector(".cmp").hasAttribute("data-motion"));
      v.ok(m.rigCanvases === 0, "no WebGL canvas: the rig is not drawn");
      v.ok(m.posesInDom > 0 && m.motionAttr === false, `falls back to the drawn sprites (${m.posesInDom} poses, no data-motion)`);
      v.ok(!errors.some((e) => e.startsWith("pageerror")), "no uncaught page error without WebGL");
      record("A05", DESKTOP, "phase3 quiz, WebGL blocked", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page, errors } = await openRoom(DESKTOP, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await page.evaluate((key) => localStorage.setItem(key, "{bad"), PREFS_KEY);
      await page.reload({ waitUntil: "load", timeout: 180_000 });
      await waitForCompanion(page);
      await page.waitForTimeout(800);
      m.prefsRaw = await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY);
      m.companions = await page.locator(".cmp").count();
      m.state = await page.evaluate(() => document.querySelector(".cmp").getAttribute("data-state"));
      v.ok(m.companions === 1, "room renders with one companion after corrupt prefs");
      v.ok(m.state === "window" || m.state === "seat", `companion placed (${m.state})`);
      v.ok(!errors.some((e) => e.startsWith("pageerror")), "no uncaught page error with corrupt prefs");
      record("A05", DESKTOP, "phase3 quiz, corrupt prefs", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function V01() {
  if (!want("V01")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      await page.waitForTimeout(1600);
      const v = new Verdict();
      const m = {};
      m.bytes = await shoot(page, `${vp.name}-V01-rest`, await clipAround(page, ".cmp", 40));
      v.ok(true, "rest screenshot captured");
      v.open("owner judges silhouette, eye color, frills, vest and tail; the six moods are not automated");
      record("V01", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function V02() {
  if (!want("V02")) return;
  const { context, page } = await openRoom(DESKTOP, { room: "phase3" });
  try {
    const v = new Verdict();
    const m = { shotBytes: {} };
    await page.evaluate(() => {
      window.__poseSwaps = 0;
      const observer = new MutationObserver((entries) => {
        for (const entry of entries) if (entry.attributeName === "class") window.__poseSwaps += 1;
      });
      document.querySelectorAll(".cmpPose").forEach((node) => observer.observe(node, { attributes: true, attributeFilter: ["class"] }));
    });
    const vw = page.viewportSize();
    for (const [name, dx, dy] of SWEEP) {
      const c = centerOf(await rectOf(page, ".cmpWin"));
      const tx = Math.min(vw.width - 6, Math.max(6, c.x + dx * 560));
      const ty = Math.min(vw.height - 6, Math.max(6, c.y + dy * 440));
      await page.mouse.move(tx, ty, { steps: 14 });
      await page.waitForTimeout(900);
      m.shotBytes[name] = await shoot(page, `desktop-V02-${name}`, await clipAround(page, ".cmp", 40));
    }
    m.discreteDrawingSwaps = await page.evaluate(() => window.__poseSwaps);
    v.ok(true, "eight sweep screenshots captured");
    v.open(`owner judges eye tracking and head-turn smoothness; this is the known V02 versus drawn-head-turn conflict. Measured discrete drawing swaps: ${m.discreteDrawingSwaps}`);
    record("V02", DESKTOP, "phase3 quiz", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

async function V05() {
  if (!want("V05")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await page.evaluate(() => window.studigoCompanion.event("setDone"));
      const t0 = Date.now();
      await page.waitForTimeout(150);
      const at150 = Date.now() - t0;
      m.shot150 = { atMs: at150, bytes: await shoot(page, `${vp.name}-V05-celebrate-150ms`, await clipAround(page, ".cmp", 40)) };
      await page.waitForTimeout(Math.max(0, 600 - (Date.now() - t0)));
      const at600 = Date.now() - t0;
      m.shot600 = { atMs: at600, bytes: await shoot(page, `${vp.name}-V05-celebrate-600ms`, await clipAround(page, ".cmp", 40)) };
      v.ok(true, "celebration captured at about 150 ms and 600 ms");
      v.open("owner judges anticipation, spring, tail lag and settle; timing is approximate because screenshot latency is included");
      record("V05", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function V06() {
  if (!want("V06")) return;
  for (const vp of [DESKTOP, PHONE]) {
    const { context, page } = await openRoom(vp, { room: "phase3" });
    try {
      const v = new Verdict();
      const m = {};
      await page.evaluate(() => window.studigoCompanion.event("wrong"));
      await page.waitForTimeout(700);
      m.bytes = await shoot(page, `${vp.name}-V06-wrong`, await clipAround(page, ".cmp", 40));
      v.ok(true, "wrong-answer pose captured");
      v.open("owner judges that the pose is supportive, calm and not shaming");
      record("V06", vp, "phase3 quiz", v, m, await flagsOf(page));
    } finally {
      await context.close();
    }
  }
}

async function V07() {
  if (!want("V07")) return;
  const { context, page } = await openRoom(DESKTOP, { room: "phase3" });
  try {
    const v = new Verdict();
    const m = {};
    await page.waitForTimeout(62_000);
    m.pose = await page.evaluate(() => document.querySelector(".cmp").getAttribute("data-pose"));
    m.posesOn = await page.evaluate(() => document.querySelectorAll(".cmpPose.on").length);
    m.bytes = await shoot(page, "desktop-V07-idle-62s", await clipAround(page, ".cmp", 40));
    v.ok(true, "idle screenshot captured at 62 s");
    v.open("owner judges the lean at 60 s and whether idle reads as calm; the 5-minute idle run is not done");
    record("V07", DESKTOP, "phase3 quiz", v, m, await flagsOf(page));
  } finally {
    await context.close();
  }
}

function openOnlyRows() {
  recordOpen("A06", "owner", "needs physical iPhone Safari and iPad Safari with pointer, touch, virtual keyboard, scroll and frame cost; not run");
  recordOpen("A07", "owner", "only headless Chromium (Playwright) ran here; desktop Safari, Firefox and Edge screenshots and motion capture are not run");
  recordOpen("A08", "H-A (lc/11-measurements)", "frame time, blend time, memory and bundle size need measurement on real hardware; no budget was invented here");
  recordOpen("A09", "H-F (lc/23-rollback)", "emergency-off and motion-off recovery are owned by the rollback task");
  recordOpen("V03", "owner", "blinks across all gaze directions need a visual judgement; not automated");
  recordOpen("V04", "owner", "tap/pet versus drag feel needs a person on a device; the drag mechanics are covered by UI01 only");
  recordOpen("V08", "owner or H-A", "30/60/120 Hz consistency and tab-resume dt need hardware refresh rates; not run");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const started = new Date().toISOString();
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const browserVersion = browser.version();
  try {
    await run("L02", L02);
    await run("UI01", UI01);
    await run("UI02", UI02_03);
    await run("UI04", UI04);
    await run("UI05", UI05);
    await run("UI06", UI06);
    await run("UI07", UI07);
    await run("UI08", UI08);
    await run("UI09", UI09);
    await run("UI10", UI10);
    await run("L01", L01);
    await run("L03", L03);
    await run("L04", L04);
    await run("L05", L05);
    await run("L06", L06);
    await run("L07", L07);
    await run("A01", A01);
    await run("A02", A02);
    await run("A03", A03);
    await run("A04", A04);
    await run("A05", A05);
    await run("V01", V01);
    await run("V02", V02);
    await run("V05", V05);
    await run("V06", V06);
    await run("V07", V07);
    if (!ONLY) openOnlyRows();
  } finally {
    await browser.close();
  }

  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim();
  } catch {
    commit = "unknown";
  }
  const summary = { PASS: 0, FAIL: 0, OPEN: 0 };
  for (const entry of results) summary[entry.status] = (summary[entry.status] ?? 0) + 1;
  const report = {
    generatedAt: started,
    commit,
    baseUrl: BASE,
    browser: { name: "chromium (playwright)", version: browserVersion },
    command: "node scripts/lc-companion-qa.mjs",
    subset: ONLY ? [...ONLY] : "full matrix",
    flags: "dev server with NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1; NEXT_PUBLIC_STUDIGO_COMPANION_MOTION and NEXT_PUBLIC_STUDIGO_COMPANION unset (motion on, companion on); development build, so window.studigoCompanion exists",
    viewports: { desktop: "1440x900, deviceScaleFactor 1", phone: "390x844, deviceScaleFactor 2, isMobile, hasTouch" },
    summary,
    results,
    screenshots: shots
  };
  await writeFile(path.join(OUT, "results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PASS ${summary.PASS}  FAIL ${summary.FAIL}  OPEN ${summary.OPEN}`);
  process.exitCode = summary.FAIL > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
