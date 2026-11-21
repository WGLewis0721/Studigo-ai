// LC-19: Calm mode and prefers-reduced-motion checks for the living companion (QA row A02).
// Needs the dev server (STUDIGO_QA_BASE, default http://127.0.0.1:3303). For desktop and phone
// viewports it runs three conditions (normal, Calm pref on, OS reduced motion) and writes
// results.json plus up to six PNG crops to design/living-companion/evidence/LC-19/.
// Exits 1 when any check FAILs. It never changes product code.
// --browser=chromium|webkit|firefox picks the engine (default chromium); PLAYWRIGHT_<ENGINE>_EXECUTABLE_PATH overrides the binary.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const origin = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3303";
const browserName = process.argv.find((arg) => arg.startsWith("--browser="))?.slice("--browser=".length) ?? "chromium";
const engines = { chromium, firefox, webkit };
if (!Object.hasOwn(engines, browserName)) {
  console.error("usage: node scripts/lc-calm-qa.mjs [--browser=chromium|webkit|firefox]");
  process.exit(2);
}
const repoRoot = resolve(import.meta.dirname, "..");
const outDir = resolve(repoRoot, "design/living-companion/evidence/LC-19");
const roomPath = "/dev/study?mode=quiz";
const roomKey = "studigo.companion.fixture";
const roomPrefs = { v: 2, speech: false, seated: false, tuck: true, dock: "br", pos: null, outfit: null, calm: false, host: "float" };

const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "phone", width: 390, height: 844 },
];
const conditions = [
  { id: "a", label: "normal", reducedMotion: "no-preference", calmPref: false },
  { id: "b", label: "Calm pref on", reducedMotion: "no-preference", calmPref: true },
  { id: "c", label: "OS reduced motion", reducedMotion: "reduce", calmPref: false },
];
const triggers = [
  { name: "setDone", kind: "event" },
  { name: "tickle", kind: "play" },
  { name: "celebrate", kind: "play" },
];
const limits = { hopPx: 4, motionPx: 0.2, motionDeg: 0.2, breathPx: 2, slidePx: 1, triggerMs: 3000, idleMs: 20000, sampleMs: 33 };
const beatPoses = ["celebrate", "support", "poke", "pet", "lean", "sleep"];
const lookPoses = ["left", "right", "up", "down", "up-left", "up-right", "down-left", "down-right"];

/* Runs in the page before any app script. Counts particles as they are added and keeps the rig's vertex buffer. */
function installProbes() {
  const fx = { total: 0, spark: 0, heart: 0, zzz: 0, other: 0 };
  window.__lcFx = fx;
  const kindOf = (node) => {
    if (node.textContent.trim() === "z") return "zzz";
    if (node.innerHTML.includes("M8 14.2")) return "heart";
    if (node.innerHTML.includes("M8 0c") || node.innerHTML.includes("<circle")) return "spark";
    return "other";
  };
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && node.classList.contains("fx")) {
          fx.total += 1;
          fx[kindOf(node)] += 1;
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
  const upload = WebGLRenderingContext.prototype.bufferSubData;
  WebGLRenderingContext.prototype.bufferSubData = function (target, offset, data) {
    if (target === this.ARRAY_BUFFER && data instanceof Float32Array && data.length === 1922) window.__lcMesh = data;
    return upload.apply(this, arguments);
  };
}

/* Runs in the page: fires one reaction (or none) and samples his window and rig every sampleMs for durationMs.
   Mesh units are the rig's 400-unit square, scaled to CSS px with the body box (0.28125 px per unit at default size). */
async function sampleCompanion({ trigger, durationMs, sampleMs }) {
  const side = 31, grid = 30, rest = 400, span = 1.6;
  const restX = (n) => ((n % side) * rest) / grid;
  const restY = (n) => (Math.floor(n / side) * rest) / grid;
  const feet = [], headTop = [], tail = [];
  for (let i = 0; i < side; i += 1) feet.push(grid * side + i);
  for (let i = 12; i <= 20; i += 1) headTop.push(i);
  for (let j = 18; j <= 21; j += 1) for (let i = 0; i <= 4; i += 1) tail.push(j * side + i);
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const slope = (xs, ys) => {
    const n = xs.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let k = 0; k < n; k += 1) { sx += xs[k]; sy += ys[k]; sxy += xs[k] * ys[k]; sxx += xs[k] * xs[k]; }
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  };
  const cmp = document.querySelector(".cmp");
  const body = document.querySelector(".cmpBody");
  const rig = document.querySelector(".cmpRig");
  const rigBody = document.querySelector(".cmpRigBody");
  const win = document.querySelector(".cmpWin");
  const read = (t) => {
    const box = win.getBoundingClientRect();
    const on = rigBody.querySelector(".cmpPose.on");
    const sample = {
      t: Math.round(t),
      pose: cmp.dataset.pose || "",
      on: on ? on.dataset.pose : "",
      onTf: on ? getComputedStyle(on).transform : null,
      calm: cmp.hasAttribute("data-calm"),
      anim: getComputedStyle(body).animationName,
      win: { top: box.top, left: box.left },
      winTf: (() => {
        const matrix = getComputedStyle(win).transform;
        if (matrix === "none") return [0, 0];
        const v = matrix.slice(7, -1).split(",").map(Number);
        return [v[4], v[5]];
      })(),
      dom: null,
    };
    const matrix = getComputedStyle(rigBody).transform;
    if (matrix !== "none") {
      const v = matrix.slice(7, -1).split(",").map(Number);
      sample.dom = { a: v[0], angleDeg: (Math.atan2(v[1], v[0]) * 180) / Math.PI, dyPx: v[5] };
    }
    const mesh = window.__lcMesh;
    if (mesh) {
      const px = (rig.offsetWidth * (body.getBoundingClientRect().width / body.offsetWidth)) / (span * rest);
      const feetX = feet.map(restX), feetNow = feet.map((n) => mesh[2 * n]);
      sample.hopPx = (mean(feet.map((n) => mesh[2 * n + 1])) - rest) * px;
      sample.feetDxPx = mean(feetNow.map((x, k) => x - feetX[k])) * px;
      sample.feetSlope = slope(feetX, feetNow);
      sample.rollDeg = (Math.atan(slope(headTop.map(restX), headTop.map((n) => mesh[2 * n + 1]))) * 180) / Math.PI;
      sample.topDyPx = mean(headTop.map((n) => mesh[2 * n + 1])) * px;
      sample.tailDxPx = mean(tail.map((n) => mesh[2 * n] - restX(n))) * px;
      sample.tailDyPx = mean(tail.map((n) => mesh[2 * n + 1] - restY(n))) * px;
    }
    return sample;
  };
  for (const key of Object.keys(window.__lcFx)) window.__lcFx[key] = 0;
  const samples = [];
  const t0 = performance.now();
  if (trigger) {
    if (trigger.kind === "event") window.studigoCompanion.event(trigger.name);
    else window.studigoCompanion.play(trigger.name);
  }
  samples.push(read(0));
  await new Promise((resolveWindow, rejectWindow) => {
    const timer = window.setInterval(() => {
      const t = performance.now() - t0;
      try {
        samples.push(read(t));
      } catch (error) {
        window.clearInterval(timer);
        rejectWindow(error);
        return;
      }
      if (t >= durationMs) {
        window.clearInterval(timer);
        resolveWindow();
      }
    }, sampleMs);
  });
  return { samples, fx: { ...window.__lcFx } };
}

const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const round = (value, digits = 2) => (isNum(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const uniq = (list) => [...new Set(list)];
const spread = (list) => (list.length ? Math.max(...list) - Math.min(...list) : null);
const peak = (list) => (list.length ? Math.max(...list.map((value) => Math.abs(value))) : null);
const sparkCount = (fx) => fx.spark + fx.heart + fx.other;

function summarizeTrigger(result) {
  const s = result.samples;
  const col = (key) => s.map((x) => x[key]).filter(isNum);
  const doms = s.map((x) => x.dom).filter(Boolean);
  const slopes = col("feetSlope");
  return {
    samples: s.length,
    fx: result.fx,
    sparksOrHearts: sparkCount(result.fx),
    hopMaxAbsPx: round(peak(col("hopPx"))),
    domHopMaxAbsPx: round(peak(doms.map((d) => d.dyPx))),
    feetDxMaxAbsPx: round(peak(col("feetDxPx"))),
    feetSlopeMin: slopes.length ? round(Math.min(...slopes), 3) : null,
    scaleXFlip: slopes.some((v) => v < 0) || doms.some((d) => d.a < 0),
    rollMaxAbsDeg: round(peak(col("rollDeg"))),
    domAngleMaxAbsDeg: round(peak(doms.map((d) => d.angleDeg))),
    windowLeftSpreadPx: round(spread(s.map((x) => x.win.left))),
    windowTopSpreadPx: round(spread(s.map((x) => x.win.top))),
    anim: uniq(s.map((x) => x.anim)),
    drawnPoses: uniq(s.map((x) => x.on).filter(Boolean)),
    onTransforms: uniq(s.map((x) => x.onTf).filter(Boolean)),
    calmSeen: uniq(s.map((x) => x.calm)),
    raw: s.map((x) => ({ t: x.t, pose: x.pose, on: x.on, calm: x.calm, hopPx: round(x.hopPx), dyPx: x.dom ? round(x.dom.dyPx) : null, angleDeg: x.dom ? round(x.dom.angleDeg) : null, scaleXSign: x.dom ? Math.sign(x.dom.a) : null, feetSlope: round(x.feetSlope, 3), rollDeg: round(x.rollDeg), winLeft: round(x.win.left), winTop: round(x.win.top) })),
  };
}

function summarizeIdle(result) {
  const s = result.samples;
  const col = (key) => s.map((x) => x[key]).filter(isNum);
  const drawn = uniq(s.map((x) => x.on).filter(Boolean));
  const poseChanges = [];
  let last = null;
  for (const x of s) {
    if (x.pose !== last) { poseChanges.push({ t: x.t, pose: x.pose }); last = x.pose; }
  }
  const motion = {
    topDyPx: round(spread(col("topDyPx"))),
    tailDxPx: round(spread(col("tailDxPx"))),
    tailDyPx: round(spread(col("tailDyPx"))),
    rollDeg: round(spread(col("rollDeg"))),
    hopPx: round(spread(col("hopPx"))),
    feetDxPx: round(spread(col("feetDxPx"))),
  };
  const continuous = [motion.topDyPx, motion.tailDxPx, motion.tailDyPx].some((v) => isNum(v) && v >= limits.motionPx)
    || (isNum(motion.rollDeg) && motion.rollDeg >= limits.motionDeg);
  return {
    samples: s.length,
    fx: result.fx,
    anim: uniq(s.map((x) => x.anim)),
    windowSpreadPx: round(Math.max(spread(s.map((x) => x.win.left)) ?? 0, spread(s.map((x) => x.win.top)) ?? 0)),
    windowSlidePx: round(Math.max(spread(s.map((x) => x.winTf[0])) ?? 0, spread(s.map((x) => x.winTf[1])) ?? 0)),
    drawnPoses: drawn,
    beatDrawings: drawn.filter((p) => beatPoses.includes(p)),
    lookDrawings: drawn.filter((p) => lookPoses.includes(p)),
    poseChanges,
    motionP2P: motion,
    continuous,
    decimated: s.filter((_, i) => i % 6 === 0).map((x) => ({ t: x.t, pose: x.pose, on: x.on, topDyPx: round(x.topDyPx), tailDxPx: round(x.tailDxPx), tailDyPx: round(x.tailDyPx), rollDeg: round(x.rollDeg) })),
  };
}

function attach(page, errors) {
  page.on("pageerror", (error) => errors.push({ kind: "pageerror", text: String(error.message).slice(0, 300) }));
  page.on("console", (message) => {
    if (message.type() === "error" && errors.length < 40) errors.push({ kind: "console", text: message.text().slice(0, 200) });
  });
}

async function loadRoom(page) {
  const response = await page.goto(`${origin}${roomPath}`, { waitUntil: "networkidle", timeout: 120_000 });
  if (response?.status() !== 200) throw new Error(`${roomPath} answered ${response?.status()}`);
  await page.waitForSelector(".cmp", { timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.studigoCompanion) && Boolean(window.__lcMesh), undefined, { timeout: 20_000 }).catch(() => {});
}

async function snapshot(page) {
  return page.evaluate((key) => {
    const cmp = document.querySelector(".cmp");
    return {
      state: cmp.dataset.state,
      dock: cmp.dataset.dock,
      motion: cmp.hasAttribute("data-motion"),
      calm: cmp.hasAttribute("data-calm"),
      systemReduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      visibility: document.visibilityState,
      k: Number(getComputedStyle(cmp).getPropertyValue("--k")),
      bodyAnim: getComputedStyle(document.querySelector(".cmpBody")).animationName,
      meshSeen: Boolean(window.__lcMesh),
      storage: localStorage.getItem(key),
    };
  }, roomKey);
}

async function applyCalmLive(page) {
  const started = Date.now();
  await page.evaluate(({ key, prefs }) => {
    const json = JSON.stringify({ ...prefs, calm: true });
    localStorage.setItem(key, json);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: json, storageArea: window.localStorage }));
  }, { key: roomKey, prefs: roomPrefs });
  const applied = await page.waitForFunction(() => document.querySelector(".cmp")?.hasAttribute("data-calm") === true, undefined, { timeout: 5000 })
    .then(() => true, () => false);
  return { calmAttr: applied, appliedMs: Date.now() - started };
}

async function calmAttr(page) {
  return page.evaluate(() => document.querySelector(".cmp")?.hasAttribute("data-calm") === true);
}

async function storageCalm(page) {
  return page.evaluate((key) => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null")?.calm ?? null; } catch { return null; }
  }, roomKey);
}

/* A pref that never lands is recorded as a failed check by the caller, so the wait itself does not abort the run. */
async function waitForCalm(page, on) {
  await page.waitForFunction((want) => (document.querySelector(".cmp")?.hasAttribute("data-calm") === true) === want, on, { timeout: 5000 }).catch(() => {});
}

async function closeMenu(page) {
  await page.locator(".cmpSheetHead button").click();
  await page.locator(".cmpSheet").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
}

async function menuFlow(page, condition) {
  const sheet = page.locator(".cmpSheet");
  const box = sheet.locator('input[data-set="calm"]');
  await page.evaluate(() => { window.__lcMarker = "same-document"; });
  await page.locator(".cmpSill").click();
  await sheet.waitFor({ state: "visible", timeout: 5000 });
  const result = { checkedAtOpen: await box.isChecked(), disabledAtOpen: await box.isDisabled() };
  if (condition.id !== "a") {
    await closeMenu(page);
    return result;
  }
  await box.check();
  await waitForCalm(page, true);
  result.on = { calmAttr: await calmAttr(page), storageCalm: await storageCalm(page) };
  await closeMenu(page);
  result.on.celebrate = summarizeTrigger(await page.evaluate(sampleCompanion, { trigger: { kind: "play", name: "celebrate" }, durationMs: limits.triggerMs, sampleMs: limits.sampleMs }));
  await page.locator(".cmpSill").click();
  await sheet.waitFor({ state: "visible", timeout: 5000 });
  result.checkedAfterReopen = await box.isChecked();
  await box.uncheck();
  await waitForCalm(page, false);
  result.off = { calmAttr: await calmAttr(page), storageCalm: await storageCalm(page) };
  await closeMenu(page);
  result.off.celebrate = summarizeTrigger(await page.evaluate(sampleCompanion, { trigger: { kind: "play", name: "celebrate" }, durationMs: limits.triggerMs, sampleMs: limits.sampleMs }));
  result.sameDocument = await page.evaluate(() => window.__lcMarker === "same-document");
  return result;
}

async function cropCelebrate(page, file) {
  await page.evaluate(() => window.studigoCompanion.play("celebrate"));
  await page.waitForTimeout(350);
  const box = await page.locator(".cmp").boundingBox();
  const view = page.viewportSize();
  const x = Math.max(0, box.x - 90), y = Math.max(0, box.y - 150);
  const width = Math.min(view.width - x, box.width + 180), height = Math.min(view.height - y, box.height + 190);
  await page.screenshot({ path: resolve(outDir, file), clip: { x, y, width, height } });
  return file;
}

async function runCondition(browser, viewport, condition) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: condition.reducedMotion });
  await context.addInitScript(installProbes);
  const run = { viewport: viewport.id, width: viewport.width, height: viewport.height, condition: condition.id, label: condition.label, reducedMotion: condition.reducedMotion, errors: [] };
  try {
    let page = await context.newPage();
    attach(page, run.errors);
    await loadRoom(page);
    if (condition.calmPref) {
      run.liveApply = await applyCalmLive(page);
      await loadRoom(page);
      run.loadTimeCalm = await calmAttr(page);
    }
    await page.waitForTimeout(1800);
    run.start = await snapshot(page);
    run.triggers = {};
    for (const trigger of triggers) {
      const result = await page.evaluate(sampleCompanion, { trigger, durationMs: limits.triggerMs, sampleMs: limits.sampleMs });
      run.triggers[trigger.name] = summarizeTrigger(result);
    }
    run.menu = await menuFlow(page, condition);
    run.crop = await cropCelebrate(page, `${viewport.id}-${condition.id}-celebrate.png`);
    await page.close();
    page = await context.newPage();
    attach(page, run.errors);
    await loadRoom(page);
    await page.waitForTimeout(1800);
    run.idleStart = await snapshot(page);
    run.idle = summarizeIdle(await page.evaluate(sampleCompanion, { trigger: null, durationMs: limits.idleMs, sampleMs: limits.sampleMs }));
    run.idleCalm = run.idleStart.calm;
    return run;
  } finally {
    await context.close();
  }
}

function buildChecks(run) {
  const checks = [];
  const add = ({ check, group, measured, expected, ok, control = false, note = "" }) => {
    let verdict;
    if (ok === null) verdict = "OBSERVED";
    else if (control) verdict = ok ? "PASS (control)" : "FAIL (control)";
    else verdict = ok ? "PASS" : "FAIL";
    checks.push({ viewport: run.viewport, condition: run.condition, check, group, measured, expected, verdict, note });
  };
  const isCalm = run.condition !== "a";
  const t = run.triggers, idle = run.idle, names = triggers.map((x) => x.name), menu = run.menu;
  const m = idle.motionP2P;
  const countPrev = idle.poseChanges.length;

  add({ check: "rig mounted and window showing", group: "setup", measured: `mesh ${run.start.meshSeen}, state ${run.start.state}, motion ${run.start.motion}`, expected: "mesh seen, state window, motion on", ok: run.start.meshSeen && run.start.state === "window" && run.start.motion, control: true });
  add({ check: "Calm flag matches condition", group: "setup", measured: `calm attr ${run.start.calm}, OS reduced ${run.start.systemReduced}`, expected: isCalm ? "calm on" : "calm off", ok: run.start.calm === isCalm && run.start.systemReduced === (run.condition === "c"), control: true });
  if (run.condition === "b") {
    add({ check: "saved Calm pref applies live (StorageEvent) and at load", group: "setup", measured: `live ${run.liveApply.calmAttr} in ${run.liveApply.appliedMs} ms; at load ${run.loadTimeCalm}; menu box checked ${menu.checkedAtOpen}`, expected: "calm on both ways; menu box checked", ok: run.liveApply.calmAttr && run.loadTimeCalm === true && menu.checkedAtOpen === true });
  }
  add({ check: "no uncaught page errors", group: "errors", measured: `${run.errors.filter((e) => e.kind === "pageerror").length} uncaught`, expected: "0", ok: run.errors.filter((e) => e.kind === "pageerror").length === 0 });

  const particleText = names.map((n) => `${n} ${t[n].sparksOrHearts}`).join(", ");
  if (run.condition === "a") {
    add({ check: "control: reactions create sparks", group: "particles", measured: particleText, expected: "setDone and celebrate above 0", ok: t.setDone.sparksOrHearts > 0 && t.celebrate.sparksOrHearts > 0, control: true });
  } else {
    add({ check: "no sparks or hearts after setDone, tickle, celebrate", group: "particles", measured: particleText, expected: "0 each (zzz allowed)", ok: names.every((n) => t[n].sparksOrHearts === 0) });
  }

  const hopText = names.map((n) => `${n} rig ${t[n].hopMaxAbsPx ?? "-"} px, drawn ${t[n].domHopMaxAbsPx ?? "-"} px`).join("; ");
  if (run.condition === "a") {
    add({ check: "control: whole-body vertical hop visible", group: "hop", measured: hopText, expected: `at least ${limits.hopPx} px`, ok: Math.max(t.setDone.hopMaxAbsPx ?? 0, t.celebrate.hopMaxAbsPx ?? 0) >= limits.hopPx, control: true });
  } else {
    add({ check: "no hop: whole-body vertical translate under 4 px", group: "hop", measured: hopText, expected: `under ${limits.hopPx} px`, ok: names.every((n) => (t[n].hopMaxAbsPx ?? 0) < limits.hopPx && (t[n].domHopMaxAbsPx ?? 0) < limits.hopPx) });
  }

  const spinText = names.map((n) => `${n} flip ${t[n].scaleXFlip}`).join(", ");
  if (run.condition === "a") {
    add({ check: "control: scaleX sign flip (spin) visible", group: "spin", measured: `${spinText}; min feet slope ${t.celebrate.feetSlopeMin}`, expected: "flip during celebrate", ok: t.celebrate.scaleXFlip === true, control: true });
  } else {
    add({ check: "no spin: scaleX never changes sign", group: "spin", measured: spinText, expected: "no flip", ok: names.every((n) => !t[n].scaleXFlip) });
  }

  const anims = uniq([...names.flatMap((n) => t[n].anim), ...idle.anim]);
  add({ check: ".cmpBody animationName is none", group: "anim", measured: anims.join(", "), expected: "none only", ok: anims.length === 1 && anims[0] === "none" });

  add({ check: "max rotation and vertical translation (info)", group: "info", measured: names.map((n) => `${n} roll ${t[n].rollMaxAbsDeg ?? "-"} deg, drawn ${t[n].domAngleMaxAbsDeg ?? "-"} deg`).join("; "), expected: "recorded", ok: null });
  add({ check: "celebrate drawing transform and window slide (info)", group: "info", measured: `drawing ${t.celebrate.onTransforms.join(" | ") || "none"}; window left spread ${t.celebrate.windowLeftSpreadPx} px`, expected: "recorded", ok: null });

  add({ check: "idle 20 s: beat-driven drawings", group: "idle-beat", measured: idle.beatDrawings.join(", ") || "none", expected: isCalm ? "none" : "recorded", ok: isCalm ? idle.beatDrawings.length === 0 : null });
  const lookText = `${idle.lookDrawings.join(", ") || "none"}; ${countPrev} pose changes`;
  if (run.condition === "a") {
    add({ check: "control: idle glances draw head turns", group: "idle-look", measured: lookText, expected: "at least one look drawing", ok: idle.lookDrawings.length > 0, control: true });
  } else {
    add({ check: "idle 20 s: no autonomous head-turn drawings", group: "idle-look", measured: lookText, expected: "none (A02 literal)", ok: idle.lookDrawings.length === 0 });
  }
  const motionText = `top of head ${m.topDyPx} px, tail x ${m.tailDxPx} px, tail y ${m.tailDyPx} px, head roll ${m.rollDeg} deg, hop ${m.hopPx} px (peak to peak over 20 s)`;
  if (run.condition === "a") {
    add({ check: "control: idle motion is measurable", group: "idle-continuous", measured: motionText, expected: "continuous motion present", ok: idle.continuous, control: true });
  } else {
    // LC-DEC-040 amends A02: slow breath and blinks stay in calm; sway, flicker, glances, hops, spins, slides and particles go.
    const under = (value, limit) => !isNum(value) || value < limit;
    const atMost = (value, limit) => !isNum(value) || value <= limit;
    add({ check: "idle 20 s: no tail sway and no head roll", group: "idle-continuous", measured: `tail x ${m.tailDxPx} px, head roll ${m.rollDeg} deg (peak to peak over 20 s)`, expected: `tail x under ${limits.motionPx} px and roll under ${limits.motionDeg} deg`, ok: under(m.tailDxPx, limits.motionPx) && under(m.rollDeg, limits.motionDeg) });
    add({ check: "idle 20 s: breathing no more than 2 px at default size", group: "idle-continuous", measured: `top of head ${m.topDyPx} px, tail y ${m.tailDyPx} px (peak to peak over 20 s)`, expected: `${limits.breathPx} px or less`, ok: atMost(m.topDyPx, limits.breathPx) && atMost(m.tailDyPx, limits.breathPx) });
    add({ check: "idle 20 s: no hop and no slide of his window (transform)", group: "idle-continuous", measured: `hop ${m.hopPx} px, window transform spread ${idle.windowSlidePx} px`, expected: `hop under ${limits.hopPx} px, transform spread under ${limits.slidePx} px`, ok: under(m.hopPx, limits.hopPx) && under(idle.windowSlidePx, limits.slidePx) });
    add({ check: "idle 20 s: his window layout moves with the page (info)", group: "info", measured: `layout spread ${idle.windowSpreadPx} px; the desktop header drawer folds in idle and moves the room`, expected: "recorded", ok: null });
    add({ check: "idle 20 s: no sparks or hearts (zzz only)", group: "particles", measured: `${sparkCount(idle.fx)} sparks or hearts`, expected: "0", ok: sparkCount(idle.fx) === 0 });
    add({ check: "flame flicker (info)", group: "info", measured: "not in the rig probe; covered by companion-motion.test.ts ('calm mode: no flame flicker')", expected: "recorded", ok: null });
  }

  if (run.condition === "a") {
    const pass = menu.checkedAtOpen === false && menu.on.calmAttr === true && menu.on.storageCalm === true && menu.on.celebrate.sparksOrHearts === 0
      && menu.off.calmAttr === false && menu.off.storageCalm === false && menu.off.celebrate.sparksOrHearts > 0
      && menu.checkedAfterReopen === true && menu.sameDocument === true;
    add({ check: "menu Calm toggle flips the saved pref, stops and restores sparks, no reload", group: "toggle", measured: `box ${menu.checkedAtOpen} at open; on: saved ${menu.on.storageCalm}, sparks ${menu.on.celebrate.sparksOrHearts}; off: saved ${menu.off.storageCalm}, sparks ${menu.off.celebrate.sparksOrHearts}; same document ${menu.sameDocument}`, expected: "on: 0 sparks; off: sparks back", ok: pass });
  }
  if (run.condition === "c") {
    add({ check: "menu Calm box is checked and disabled under OS reduced motion", group: "toggle", measured: `checked ${menu.checkedAtOpen}, disabled ${menu.disabledAtOpen}; calm attr ${run.start.calm}`, expected: "checked and disabled", ok: menu.checkedAtOpen === true && menu.disabledAtOpen === true });
  }
  return checks;
}

const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const playwrightVersion = JSON.parse(readFileSync(resolve(repoRoot, "node_modules/playwright/package.json"), "utf8")).version;
mkdirSync(outDir, { recursive: true });

const report = {
  id: "LC-19",
  row: "A02",
  baseUrl: origin,
  date: new Date().toISOString(),
  sha: git("rev-parse", "HEAD"),
  productChangesVsSha: git("status", "--porcelain", "--", "apps", "packages", "services", "supabase").split("\n").filter(Boolean),
  machine: { os: `${os.type()} ${os.release()}`, arch: os.arch(), node: process.version, playwright: playwrightVersion },
  limits,
  runs: [],
  checks: [],
};

const browser = await engines[browserName].launch({ headless: true, executablePath: process.env[`PLAYWRIGHT_${browserName.toUpperCase()}_EXECUTABLE_PATH`] || undefined });
report.browser = { name: browserName, version: browser.version() };
if (browserName === "chromium") report.chromium = browser.version();
let exitCode = 0;
try {
  for (const viewport of viewports) {
    for (const condition of conditions) {
      const label = `${viewport.id}/${condition.id} (${condition.label})`;
      try {
        const run = await runCondition(browser, viewport, condition);
        report.runs.push(run);
        report.checks.push(...buildChecks(run));
        console.log(`done ${label}`);
      } catch (error) {
        report.checks.push({ viewport: viewport.id, condition: condition.id, check: "run completed", group: "setup", measured: String(error.message).slice(0, 300), expected: "run completes", verdict: "FAIL", note: "" });
        console.log(`FAILED ${label}: ${error.message}`);
      }
    }
  }
} finally {
  await browser.close();
}

const literalGroups = ["particles", "hop", "spin", "anim", "idle-look", "idle-continuous"];
const specGroups = ["particles", "hop", "spin", "anim", "idle-beat", "toggle"];
const rowVerdict = (groups) => {
  const failing = report.checks.filter((c) => groups.includes(c.group) && c.verdict === "FAIL" && (c.condition !== "a" || c.group === "toggle")).map((c) => `${c.viewport}/${c.condition}: ${c.check}`);
  return { verdict: failing.length ? "FAIL" : "PASS", failing };
};
const controlFailures = report.checks.filter((c) => c.verdict === "FAIL (control)").map((c) => `${c.viewport}/${c.condition}: ${c.check}`);
const counts = {};
for (const c of report.checks) counts[c.verdict] = (counts[c.verdict] ?? 0) + 1;
report.summary = { counts, controlFailures };
report.a02 = {
  rowText: "Gentle, not frozen (LC-DEC-040): calm keeps slow breath (2 px at most) and blinks; no tail sway, flame flicker, idle glances, hops, spins, slides or particles except zzz.",
  literalRowText: rowVerdict(literalGroups),
  specSection12: rowVerdict(specGroups),
  note: "The literal verdict reads the amended LC-DEC-040 wording. The strict no-physics wording it replaces failed only on breath (1.09 to 1.25 px). Flame flicker is not in the rig probe.",
};

const failCount = report.checks.filter((c) => c.verdict.startsWith("FAIL")).length;
if (failCount > 0 || controlFailures.length > 0) exitCode = 1;
report.exitCode = exitCode;
writeFileSync(resolve(outDir, "results.json"), `${JSON.stringify(report, null, 2)}\n`);

for (const c of report.checks) console.log(`${c.viewport.padEnd(8)} ${c.condition} ${c.verdict.padEnd(16)} ${c.check} | ${c.measured}`);
console.log(JSON.stringify({ counts, a02: { literal: report.a02.literalRowText.verdict, spec12: report.a02.specSection12.verdict }, exitCode }));
process.exitCode = exitCode;
