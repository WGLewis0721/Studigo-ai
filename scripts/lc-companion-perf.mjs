import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const scriptFile = fileURLToPath(import.meta.url);
const repo = join(dirname(scriptFile), "..");
const evidenceDir = join(repo, "design", "living-companion", "evidence", "LC-1");
const outFile = join(evidenceDir, "perf.json");
const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3310";
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const label = opt("build", "on");
const ON = label === "on";
const only = new Set(opt("only", "all").split(",").filter(Boolean));
const want = (name) => only.has("all") || only.has(name);

const ROOM = "/demo/room?mode=quiz";
const LAUNCH = { headless: true, args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] };
const DESKTOP = { name: "1440x900 dpr1", width: 1440, height: 900, dpr: 1, mobile: false, cpu: 1 };
const PHONE = { name: "390x844 dpr3, CPU throttled 4x", width: 390, height: 844, dpr: 3, mobile: true, cpu: 4 };
const EVENTS = ["correct", "wrong", "correct", "setDone", "cardGood", "blindspot", "correct", "hintOpened", "cardMiss", "missionComplete"];
const IDLE_MS = 20_000;
const EVENT_GAP_MS = 1500;
const RIG_SIZE = 400;
const MARKERS = ["cmpRigBody", "cmpSill", "Giggly", "studigo.companion.", "Studigo's rig", "webglcontextlost"];
const COMPANION_MARKERS = ["cmpRigBody", "cmpSill", "Giggly"];
const METRICS = ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

const INSTRUMENT = `(() => {
  const S = (window.__lc = { frames: [], comp: [], long: [], uni: [], mesh: [], recordMesh: false, quiet: window.__lcQuiet === true, inBuf: false, names: new WeakMap(), cap: 60000 });
  try { new PerformanceObserver((list) => { for (const e of list.getEntries()) S.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
  const raf = window.requestAnimationFrame.bind(window);
  const own = () => { if (!S.quiet) S.frames.push(performance.now()); raf(own); };
  raf(own);
  window.requestAnimationFrame = (callback) => raf((time) => {
    S.inBuf = false;
    const start = performance.now();
    try { callback(time); } finally { if (S.inBuf && !S.quiet) S.comp.push([start, performance.now() - start]); }
  });
  const P = WebGLRenderingContext.prototype;
  const getUL = P.getUniformLocation;
  P.getUniformLocation = function (program, name) { const loc = getUL.call(this, program, name); if (loc) S.names.set(loc, name); return loc; };
  const u1 = P.uniform1f;
  P.uniform1f = function (loc, value) { const name = S.names.get(loc); if (name && !S.quiet && S.uni.length < S.cap) S.uni.push([performance.now(), name, value]); return u1.call(this, loc, value); };
  const bsd = P.bufferSubData;
  P.bufferSubData = function (target, offset, data) { S.inBuf = true; if (S.recordMesh && data && S.mesh.length < 6000) S.mesh.push([performance.now(), Float32Array.from(data)]); return bsd.call(this, target, offset, data); };
})();`;

const SHIM30 = `(() => {
  const period = 1000 / 30;
  const pending = new Map();
  const dead = new Set();
  let nextId = 1, timer = 0;
  const flush = () => {
    timer = 0;
    const batch = [...pending];
    pending.clear();
    const now = performance.now();
    for (const [id, callback] of batch) { if (dead.has(id)) { dead.delete(id); continue; } callback(now); }
  };
  window.requestAnimationFrame = (callback) => { const id = nextId++; pending.set(id, callback); if (!timer) timer = setTimeout(flush, period); return id; };
  window.cancelAnimationFrame = (id) => { if (!pending.delete(id)) dead.add(id); };
})();`;

const NO_WEBGL = `(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === "webgl" || type === "webgl2") return null;
    return original.call(this, type, ...rest);
  };
})();`;

function findHandle() {
  const host = document.querySelector(".cmpHost");
  let handle = null;
  if (host) {
    const key = Object.keys(host).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? host[key] : null;
    search: while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const v = hook.memoizedState;
        if (v && typeof v === "object" && "current" in v && v.current && typeof v.current.event === "function" && typeof v.current.setTone === "function") {
          handle = v.current;
          break search;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
  }
  window.__lc.handle = handle;
  return handle !== null;
}

const BLEND_IN_PAGE = () => new Promise((resolve) => {
  const body = document.querySelector(".cmpRigBody");
  const start = performance.now();
  let onAt = null, opacityAt = null, pose = null, opacity = null;
  const mo = new MutationObserver(() => { if (onAt === null && body.querySelector(".cmpPose.on")) onAt = performance.now() - start; });
  mo.observe(body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  const onEnd = (event) => {
    if (opacityAt === null && event.propertyName === "opacity" && event.target.classList.contains("on")) {
      opacityAt = performance.now() - start;
      pose = event.target.dataset.pose;
      opacity = getComputedStyle(event.target).opacity;
    }
  };
  body.addEventListener("transitionend", onEnd);
  window.__lc.handle.event("correct");
  setTimeout(() => {
    body.removeEventListener("transitionend", onEnd);
    mo.disconnect();
    resolve({ t0: start, onClassMs: onAt, opacityMs: opacityAt, pose, opacity });
  }, 900);
});

const TIMELINE_IN_PAGE = (name) => new Promise((resolve) => {
  const cmp = document.querySelector(".cmp");
  const rows = [];
  const start = performance.now();
  const mo = new MutationObserver(() => rows.push([Math.round(performance.now() - start), cmp.dataset.pose]));
  mo.observe(cmp, { attributes: true, attributeFilter: ["data-pose"] });
  window.__lc.handle.event(name);
  setTimeout(() => { mo.disconnect(); resolve(rows); }, 3000);
});

const MESH_SUMMARY = () => {
  const out = [];
  let prev = null;
  for (const [t, a] of window.__lc.mesh) {
    const n = a.length / 2;
    let sx = 0, sy = 0, sq = 0;
    for (let i = 0; i < a.length; i += 2) { sx += a[i]; sy += a[i + 1]; }
    if (prev) for (let i = 0; i < a.length; i += 2) { const dx = a[i] - prev[i], dy = a[i + 1] - prev[i + 1]; sq += dx * dx + dy * dy; }
    out.push([t, sx / n, sy / n, prev ? Math.sqrt(sq / n) : null]);
    prev = a;
  }
  return out;
};

const summarize = (values) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const at = (p) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))];
  const mean = v.reduce((sum, x) => sum + x, 0) / v.length;
  return { n: v.length, mean: round(mean), p50: round(at(0.5)), p95: round(at(0.95)), p99: round(at(0.99)), max: round(v[v.length - 1]) };
};

function frameWindow(times, from, to) {
  const gaps = [];
  for (let i = 1; i < times.length; i += 1) if (times[i - 1] >= from && times[i] <= to) gaps.push(times[i] - times[i - 1]);
  const stats = summarize(gaps) ?? {};
  return { frames: gaps.length, ...stats, fpsMean: stats.mean ? round(1000 / stats.mean) : null, over16_7: gaps.filter((g) => g > 16.7).length, over33_4: gaps.filter((g) => g > 33.4).length };
}

const callbackWindow = (comp, from, to) => summarize(comp.filter(([start]) => start >= from && start <= to).map(([, d]) => d));

function longWindow(long, from, to) {
  const inside = long.filter(([start]) => start >= from && start <= to);
  return { count: inside.length, maxMs: round(Math.max(0, ...inside.map(([, d]) => d))), totalMs: round(inside.reduce((sum, [, d]) => sum + d, 0)) };
}

async function metricSnapshot(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]));
}

function metricRate(a, b, seconds) {
  const out = {};
  for (const name of METRICS) out[name] = round(((b[name] - a[name]) * 1000) / seconds);
  return out;
}

function faceMetrics(samples) {
  const plateau = samples.filter(([ms]) => ms >= 330 && ms <= 500).map(([, v]) => v);
  if (plateau.length === 0) return null;
  const target = plateau.reduce((sum, v) => sum + v, 0) / plateau.length;
  const after = samples.filter(([ms]) => ms >= 0);
  let settle = null;
  for (const [ms, v] of after) if (Math.abs(v - target) <= 0.02) { settle = ms; break; }
  let maxStep = 0;
  for (let i = 1; i < after.length; i += 1) {
    if (settle !== null && after[i][0] > settle + 20) break;
    maxStep = Math.max(maxStep, Math.abs(after[i][1] - after[i - 1][1]));
  }
  return { target: round(target), firstDrawAfterEventMs: round(after[0]?.[0] ?? null), settledMs: round(settle), maxPerFrameStep: round(maxStep) };
}

function summarizeRequests(requests, since) {
  const inside = requests.filter((r) => r.at >= since);
  const byMethod = {};
  for (const r of inside) byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
  const dynamic = inside.filter((r) => !r.url.startsWith("/_next/") && !r.url.startsWith("/mascot/"));
  return { total: inside.length, byMethod, nonStaticRequests: dynamic.slice(0, 10).map((r) => `${r.method} ${r.url}`) };
}

async function open(browser, vp, { pre = [], init = [], reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion
  });
  for (const content of [...pre, INSTRUMENT, ...init]) await context.addInitScript({ content });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (vp.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: vp.cpu });
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`.slice(0, 300)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`.slice(0, 300)); });
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url().replace(base, ""), at: Date.now() }));
  return { context, page, cdp, errors, requests };
}

async function loadRoom(page, rig = ON) {
  const response = await page.goto(base + ROOM, { waitUntil: "load", timeout: 180_000 });
  if (response?.status() !== 200) throw new Error(`GET ${ROOM} returned ${response?.status()}`);
  await page.waitForSelector(".roomDevice", { state: "attached", timeout: 120_000 });
  if (rig) await page.waitForSelector(".cmpRig[data-ready]", { state: "attached", timeout: 120_000 });
}

async function blendReps(page, reps) {
  const rows = [];
  for (let i = 0; i < reps; i += 1) {
    await wait(3000);
    const r = await page.evaluate(BLEND_IN_PAGE);
    const samples = await page.evaluate((t0) => window.__lc.uni
      .filter(([t, name]) => name === "uSmile" && t >= t0 - 2 && t <= t0 + 900)
      .map(([t, , v]) => [t - t0, v]), r.t0);
    rows.push({ onClassMs: round(r.onClassMs), drawingOpacityMs: round(r.opacityMs), pose: r.pose, opacity: r.opacity, face: faceMetrics(samples) });
  }
  return {
    reps,
    drawingOpacityMs: summarize(rows.map((row) => row.drawingOpacityMs)),
    onClassMs: summarize(rows.map((row) => row.onClassMs)),
    faceSettledMs: summarize(rows.map((row) => row.face?.settledMs)),
    faceMaxPerFrameStep: summarize(rows.map((row) => row.face?.maxPerFrameStep)),
    rows
  };
}

async function bundleSuite(browser) {
  const s = await open(browser, DESKTOP);
  const js = new Map();
  const art = new Set();
  s.page.on("response", (response) => {
    const url = response.url().split("?")[0];
    if (url.includes("/_next/static/") && url.endsWith(".js")) js.set(url, response);
    if (url.includes("/mascot/companion/")) art.add(url.replace(base, ""));
  });
  try {
    await loadRoom(s.page, ON);
    const artAtLoad = [...art].sort();
    await wait(20_000);
    const chunks = [];
    for (const [url, response] of js) {
      const body = await response.body().catch(() => null);
      if (!body) continue;
      const text = body.toString("utf8");
      const markers = MARKERS.filter((m) => text.includes(m));
      chunks.push({
        file: url.replace(base, ""),
        rawBytes: body.length,
        gzipBytes: gzipSync(body).length,
        companion: COMPANION_MARKERS.some((m) => text.includes(m)),
        markers
      });
    }
    chunks.sort((a, b) => b.rawBytes - a.rawBytes);
    const total = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0);
    const companion = chunks.filter((c) => c.companion);
    const artFiles = [...art].sort().map((rel) => ({ file: rel, bytes: statSync(join(repo, "apps", "web", "public", rel)).size, requestedByRoomReady: artAtLoad.includes(rel) }));
    const artFolder = join(repo, "apps", "web", "public", "mascot", "companion");
    const webgl = ON ? await s.page.evaluate(() => {
      const canvas = document.querySelector(".cmpRig");
      const gl = canvas?.getContext("webgl");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return ext ? { renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), version: gl.getParameter(gl.VERSION) } : null;
    }) : null;
    return {
      webgl,
      routeJs: { chunks: chunks.length, rawBytes: total(chunks, "rawBytes"), gzipBytes: total(chunks, "gzipBytes") },
      companionChunks: companion,
      companionRawBytes: total(companion, "rawBytes"),
      companionGzipBytes: total(companion, "gzipBytes"),
      companionShareOfRouteJsRawPct: round((100 * total(companion, "rawBytes")) / Math.max(1, total(chunks, "rawBytes"))),
      artRequested: artFiles,
      artOnDiskBytes: readdirSync(artFolder).filter((n) => n.endsWith(".webp")).map((n) => ({ file: `/mascot/companion/${n}`, bytes: statSync(join(artFolder, n)).size })),
      outfitsOnDiskBytes: readdirSync(join(artFolder, "outfits")).map((n) => ({ file: `/mascot/companion/outfits/${n}`, bytes: statSync(join(artFolder, "outfits", n)).size })),
      note: "Chunk-level attribution: a chunk flagged companion can also hold other route code. Gzip is zlib default level 6 of the response body."
    };
  } finally {
    await s.context.close();
  }
}

async function profileSuite(browser) {
  const s = await open(browser, DESKTOP);
  try {
    await loadRoom(s.page, true);
    await wait(2000);
    await s.cdp.send("Profiler.enable");
    await s.cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    await s.cdp.send("Profiler.start");
    await wait(20_000);
    const { profile } = await s.cdp.send("Profiler.stop");
    const frames = new Map(profile.nodes.map((n) => [n.id, n.callFrame]));
    const self = new Map();
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    const byUrl = new Map();
    let total = 0, idle = 0, gc = 0, program = 0;
    for (const [id, us] of self) {
      total += us;
      const name = frames.get(id)?.functionName ?? "";
      if (name === "(idle)") { idle += us; continue; }
      if (name === "(program)") { program += us; continue; }
      if (name === "(garbage collector)") { gc += us; continue; }
      const url = frames.get(id)?.url || "(native)";
      byUrl.set(url, (byUrl.get(url) ?? 0) + us);
    }
    const busy = total - idle;
    const flags = new Map();
    for (const url of byUrl.keys()) {
      if (!url.startsWith(base)) { flags.set(url, false); continue; }
      const text = await fetch(url).then((r) => r.text());
      flags.set(url, COMPANION_MARKERS.some((m) => text.includes(m)));
    }
    const companionUs = [...byUrl].filter(([url]) => flags.get(url)).reduce((sum, [, us]) => sum + us, 0);
    return {
      seconds: 20,
      samplingIntervalUs: 500,
      totalMs: round(total / 1000),
      idlePct: round((100 * idle) / total),
      busyMs: round(busy / 1000),
      gcMs: round(gc / 1000),
      programMs: round(program / 1000),
      companionChunkBusyMs: round(companionUs / 1000),
      companionShareOfBusyPct: round((100 * companionUs) / busy),
      topChunks: [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([url, us]) => ({
        file: url.replace(base, ""),
        busyMs: round(us / 1000),
        sharePct: round((100 * us) / busy),
        companion: flags.get(url) === true
      })),
      note: "Attribution is per script chunk (minified, no source maps in production). Shares are of busy main-thread time, excluding idle, program and GC."
    };
  } finally {
    await s.context.close();
  }
}

async function frameSuite(browser, vp, withEvents) {
  const s = await open(browser, vp);
  try {
    await loadRoom(s.page, ON);
    const events = withEvents && ON && (await s.page.evaluate(findHandle));
    await s.cdp.send("Performance.enable");
    await wait(1000);
    const m0 = await metricSnapshot(s.cdp);
    const from = await s.page.evaluate(() => performance.now());
    await wait(IDLE_MS);
    const mid = await s.page.evaluate(() => performance.now());
    const m1 = await metricSnapshot(s.cdp);
    const eventsStartWall = Date.now();
    if (events) {
      for (const name of EVENTS) {
        await s.page.evaluate((n) => window.__lc.handle.event(n), name);
        await wait(EVENT_GAP_MS);
      }
    }
    const to = await s.page.evaluate(() => performance.now());
    const m2 = await metricSnapshot(s.cdp);
    const data = await s.page.evaluate(() => ({ frames: window.__lc.frames, comp: window.__lc.comp, long: window.__lc.long }));
    const idleSec = (mid - from) / 1000;
    const eventSec = (to - mid) / 1000;
    const result = {
      viewport: vp.name,
      idle: {
        seconds: round(idleSec),
        frame: frameWindow(data.frames, from, mid),
        companionCallbackMs: callbackWindow(data.comp, from, mid),
        longTasks: longWindow(data.long, from, mid),
        cpuMsPerSec: metricRate(m0, m1, idleSec)
      },
      overall: {
        seconds: round((to - from) / 1000),
        frame: frameWindow(data.frames, from, to),
        companionCallbackMs: callbackWindow(data.comp, from, to),
        longTasks: longWindow(data.long, from, to)
      },
      errors: s.errors.slice(0, 10)
    };
    if (events) {
      result.events = {
        count: EVENTS.length,
        seconds: round(eventSec),
        frame: frameWindow(data.frames, mid, to),
        companionCallbackMs: callbackWindow(data.comp, mid, to),
        longTasks: longWindow(data.long, mid, to),
        cpuMsPerSec: metricRate(m1, m2, eventSec),
        requests: summarizeRequests(s.requests, eventsStartWall)
      };
    }
    return result;
  } finally {
    await s.context.close();
  }
}

async function blendSuite(browser, vp, reps, reducedMotion) {
  const s = await open(browser, vp, { reducedMotion });
  try {
    await loadRoom(s.page, true);
    await s.page.evaluate(findHandle);
    return await blendReps(s.page, reps);
  } finally {
    await s.context.close();
  }
}

const QUIET_PRE = "window.__lcQuiet = true;";

async function memorySuite(browser, vp) {
  const s = await open(browser, vp, { pre: [QUIET_PRE] });
  try {
    await loadRoom(s.page, ON);
    const heap = async () => {
      await s.cdp.send("HeapProfiler.collectGarbage");
      const usage = await s.cdp.send("Runtime.getHeapUsage");
      const js = await s.page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
      return { usedBytes: usage.usedSize, totalBytes: usage.totalSize, jsHeapUsedSize: js };
    };
    const start = await heap();
    const surfaces = await s.page.evaluate(() => {
      const canvas = document.querySelector(".cmpRig");
      const images = [...document.querySelectorAll(".cmpPose")].filter((img) => img.complete && img.naturalWidth > 0);
      return {
        canvasPixels: canvas ? [canvas.width, canvas.height] : null,
        canvasBackingStoreBytes: canvas ? canvas.width * canvas.height * 4 : 0,
        decodedDrawings: images.length,
        decodedDrawingBytes: images.reduce((sum, img) => sum + img.naturalWidth * img.naturalHeight * 4, 0)
      };
    });
    await wait(60_000);
    const after = await heap();
    const harnessEntries = await s.page.evaluate(() => ({ frames: window.__lc.frames.length, comp: window.__lc.comp.length, uniformWrites: window.__lc.uni.length }));
    return { quietHarness: true, start, after60s: after, deltaUsedBytes: after.usedBytes - start.usedBytes, surfaces, harnessEntries, errors: s.errors.slice(0, 5) };
  } finally {
    await s.context.close();
  }
}

async function webglSuite(browser, reps, { init, waitFor, label: name }) {
  const rows = [];
  for (let i = 0; i < reps; i += 1) {
    const s = await open(browser, DESKTOP, { init });
    try {
      await s.page.goto(base + ROOM, { waitUntil: "load", timeout: 180_000 });
      const row = await s.page.evaluate(waitFor, 60_000);
      rows.push({ ...row, errors: s.errors.slice(0, 5) });
    } finally {
      await s.context.close();
    }
  }
  return { mode: name, reps, visibleMs: summarize(rows.map((r) => r.visibleMs)), loadEventMs: summarize(rows.map((r) => r.loadEventMs)), rows };
}

const SPRITES_VISIBLE = (limitMs) => new Promise((resolve, reject) => {
  const limit = performance.now() + limitMs;
  const check = () => {
    const img = document.querySelector('.cmpPose[data-pose="center"]');
    const style = img ? getComputedStyle(img) : null;
    if (img && img.complete && img.naturalWidth > 0 && style.opacity === "1" && style.visibility === "visible") {
      resolve({
        visibleMs: performance.now(),
        loadEventMs: performance.getEntriesByType("navigation")[0]?.loadEventEnd ?? null,
        rigCanvas: document.querySelector(".cmpRig") !== null,
        dataMotion: document.querySelector(".cmp")?.hasAttribute("data-motion") ?? null,
        drawings: document.querySelectorAll(".cmpPose").length,
        eyelids: document.querySelectorAll(".cmpLid").length
      });
      return;
    }
    if (performance.now() > limit) { reject(new Error("sprites never became visible")); return; }
    requestAnimationFrame(check);
  };
  check();
});

const RIG_VISIBLE = (limitMs) => new Promise((resolve, reject) => {
  const limit = performance.now() + limitMs;
  const check = () => {
    const canvas = document.querySelector(".cmpRig[data-ready]");
    if (canvas && getComputedStyle(canvas).opacity === "1") {
      resolve({
        visibleMs: performance.now(),
        loadEventMs: performance.getEntriesByType("navigation")[0]?.loadEventEnd ?? null,
        dataMotion: document.querySelector(".cmp")?.hasAttribute("data-motion") ?? null,
        eyelids: document.querySelectorAll(".cmpLid").length
      });
      return;
    }
    if (performance.now() > limit) { reject(new Error("rig never became visible")); return; }
    requestAnimationFrame(check);
  };
  check();
});

async function lostSuite(browser, reps) {
  const rows = [];
  for (let i = 0; i < reps; i += 1) {
    const s = await open(browser, DESKTOP);
    try {
      await loadRoom(s.page, true);
      await s.page.evaluate(findHandle);
      await wait(1000);
      const lost = await s.page.evaluate(() => {
        const gl = document.querySelector(".cmpRig").getContext("webgl");
        const ext = gl.getExtension("WEBGL_lose_context");
        window.__lc.loseExt = ext;
        const t = performance.now();
        ext.loseContext();
        return new Promise((resolve, reject) => {
          const limit = performance.now() + 5000;
          const check = () => {
            if (!document.querySelector(".cmpRig") && document.querySelectorAll(".cmpLid").length === 2) { resolve({ toSpritesMs: Math.round((performance.now() - t) * 10) / 10 }); return; }
            if (performance.now() > limit) { reject(new Error("sprites did not replace the rig")); return; }
            requestAnimationFrame(check);
          };
          check();
        });
      });
      const restored = await s.page.evaluate(() => {
        const t = performance.now();
        window.__lc.loseExt.restoreContext();
        return new Promise((resolve, reject) => {
          const limit = performance.now() + 5000;
          const check = () => {
            const cmp = document.querySelector(".cmp");
            if (document.querySelector(".cmpRig") && document.querySelectorAll(".cmpLid").length === 0 && cmp?.hasAttribute("data-motion")) { resolve({ toRigMs: Math.round((performance.now() - t) * 10) / 10 }); return; }
            if (performance.now() > limit) { reject(new Error("rig did not come back")); return; }
            requestAnimationFrame(check);
          };
          check();
        });
      });
      const reaction = await s.page.evaluate(() => {
        const t = performance.now();
        window.__lc.handle.event("correct");
        return new Promise((resolve) => {
          const check = () => {
            if (document.querySelector('.cmpRigBody .cmpPose.on[data-pose="celebrate"]')) { resolve(Math.round((performance.now() - t) * 10) / 10); return; }
            if (performance.now() - t > 1000) { resolve(null); return; }
            requestAnimationFrame(check);
          };
          check();
        });
      });
      rows.push({ ...lost, ...restored, reactionAfterRestoreMs: reaction, errors: s.errors.slice(0, 5) });
    } finally {
      await s.context.close();
    }
  }
  return {
    reps,
    toSpritesMs: summarize(rows.map((r) => r.toSpritesMs)),
    toRigMs: summarize(rows.map((r) => r.toRigMs)),
    reactionAfterRestoreMs: summarize(rows.map((r) => r.reactionAfterRestoreMs)),
    rows
  };
}

async function hzSuite(browser) {
  const out = {};
  for (const hz of [30, 60]) {
    const s = await open(browser, DESKTOP, { pre: hz === 30 ? [SHIM30] : [] });
    try {
      await loadRoom(s.page, true);
      await s.page.evaluate(findHandle);
      await wait(5000);
      const timeline = await s.page.evaluate(TIMELINE_IN_PAGE, "setDone");
      await wait(500);
      const gaps = await s.page.evaluate(() => {
        const tail = window.__lc.frames.slice(-200);
        return tail.slice(1).map((t, i) => t - tail[i]);
      });
      out[`${hz}Hz`] = {
        event: "setDone (celebrate beat: drawing 0-700 ms, rig 700-1400 ms, drawing 1400-2300 ms)",
        poseChanges: timeline,
        expectedChangesMs: [0, 700, 1400, 2300],
        endsAtCenter: timeline.length ? timeline[timeline.length - 1][1] === "center" : null,
        frameIntervalMs: summarize(gaps),
        errors: s.errors.slice(0, 5)
      };
    } finally {
      await s.context.close();
    }
  }
  return out;
}

async function tabSuite(browser) {
  const s = await open(browser, DESKTOP);
  try {
    await loadRoom(s.page, true);
    await s.page.evaluate(findHandle);
    await s.page.evaluate(() => { window.__lc.recordMesh = true; });
    await wait(4000);
    const boxCss = await s.page.evaluate(() => document.querySelector(".cmpRigBody").getBoundingClientRect().width);
    const hideAt = await s.page.evaluate(() => {
      const t = performance.now();
      for (const [key, value] of [["visibilityState", "hidden"], ["hidden", true]]) Object.defineProperty(document, key, { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
      return t;
    });
    const hiddenState = await s.page.evaluate(() => ({ visibilityState: document.visibilityState, hidden: document.hidden }));
    await wait(10_000);
    const showAt = await s.page.evaluate(() => {
      const t = performance.now();
      for (const [key, value] of [["visibilityState", "visible"], ["hidden", false]]) Object.defineProperty(document, key, { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
      return t;
    });
    await wait(3000);
    const mesh = await s.page.evaluate(MESH_SUMMARY);
    const comp = await s.page.evaluate(() => window.__lc.comp.map(([t]) => t));
    const scale = boxCss / RIG_SIZE;
    const pre = mesh.filter(([t]) => t < hideAt);
    const post = mesh.filter(([t]) => t > showAt);
    const normalSteps = pre.slice(1).map((row) => row[3]).filter(Number.isFinite);
    const p95 = summarize(normalSteps)?.p95 ?? null;
    const first = post[0];
    const lastPre = pre[pre.length - 1];
    return {
      hiddenSeconds: 10,
      hiddenState,
      simulation: "document.visibilityState and document.hidden overridden, then visibilitychange dispatched. bringToFront() did not hide the first page in headless Chromium.",
      companionCallbacksWhileHidden: comp.filter((t) => t >= hideAt && t <= showAt).length,
      cssPxPerRigUnit: round(scale),
      normalStepRigPx: summarize(normalSteps),
      resumeFirstStepRigPx: round(first?.[3] ?? null),
      resumeFirstFiveStepsRigPx: post.slice(0, 5).map((row) => round(row[3])),
      resumeFirstStepCssPx: round((first?.[3] ?? 0) * scale),
      normalStepP95CssPx: round(p95 === null ? null : p95 * scale),
      centroidShiftAcrossResumeCssPx: first && lastPre ? round(Math.hypot(first[1] - lastPre[1], first[2] - lastPre[2]) * scale) : null,
      verdict: first && p95 !== null && first[3] <= p95 ? "first resumed step is within the normal per-frame range (no teleport)" : "first resumed step exceeds the normal per-frame p95"
    };
  } finally {
    await s.context.close();
  }
}

async function reducedSuite(browser) {
  const out = {};
  for (const mode of ["normal", "reduced"]) {
    const s = await open(browser, DESKTOP, { reducedMotion: mode === "reduced" ? "reduce" : "no-preference" });
    try {
      await loadRoom(s.page, true);
      await s.page.evaluate(findHandle);
      const boxCss = await s.page.evaluate(() => document.querySelector(".cmpRigBody").getBoundingClientRect().width);
      await s.page.evaluate(() => {
        window.__lc.recordMesh = true;
        window.__lc.fxAdded = 0;
        new MutationObserver((records) => { for (const r of records) window.__lc.fxAdded += r.addedNodes.length; }).observe(document.querySelector(".cmpFx"), { childList: true });
      });
      await wait(6000);
      for (const name of ["correct", "setDone", "correct"]) {
        await s.page.evaluate((n) => window.__lc.handle.event(n), name);
        await wait(4000);
      }
      const mesh = await s.page.evaluate(MESH_SUMMARY);
      const flags = await s.page.evaluate(() => ({ fxAdded: window.__lc.fxAdded, calmAttribute: document.querySelector(".cmp").hasAttribute("data-calm") }));
      const scale = boxCss / RIG_SIZE;
      const medX = summarize(mesh.map((row) => row[1])).p50;
      const medY = summarize(mesh.map((row) => row[2])).p50;
      const offsets = mesh.map((row) => Math.hypot(row[1] - medX, row[2] - medY) * scale);
      out[mode] = {
        frames: mesh.length,
        translationCssPx: { maxFromMedian: round(Math.max(...offsets)), p95FromMedian: summarize(offsets)?.p95 ?? null },
        particlesAdded: flags.fxAdded,
        calmAttribute: flags.calmAttribute
      };
      if (mode === "reduced") out[mode].blend = await blendReps(s.page, 5);
    } finally {
      await s.context.close();
    }
  }
  return out;
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const script = readFileSync(scriptFile, "utf8");
  const doc = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : { id: "LC-1", task: "H-A", measuredOn: "2026-11-20", builds: {} };
  doc.script = { path: "scripts/lc-companion-perf.mjs", sha256: sha256(script) };
  doc.git = { branch: git("rev-parse", "--abbrev-ref", "HEAD"), headSha: git("rev-parse", "HEAD") };
  doc.machine = { cpu: cpus()[0]?.model ?? null, logicalCores: cpus().length, ramBytes: totalmem(), osRelease: release(), node: process.version };
  doc.launch = LAUNCH;
  doc.harness = {
    studigoCompanionHook: "window.studigoCompanion is set only when NODE_ENV is development (companion.tsx). Production builds are measured through the same CompanionHandle, read from React's fiber tree (read-only) and calling its public event() and play().",
    frameTiming: "a requestAnimationFrame collector and a wrapper around page rAF callbacks; a callback counts as companion work when it calls WebGL bufferSubData",
    uniformTrace: "WebGLRenderingContext uniform1f wrappers record uSmile and the other drawn channels per frame",
    shim30: "rAF callbacks delivered from a 30 Hz timer (simulated cadence, not a 30 Hz panel)"
  };
  doc.builds[label] = doc.builds[label] ?? {};
  doc.builds[label].build = { label, exitCode: opt("build-exit", null), command: opt("build-cmd", null) };
  doc.builds[label].suites = doc.builds[label].suites ?? {};
  const suites = doc.builds[label].suites;
  const save = () => writeFileSync(outFile, `${JSON.stringify(doc, null, 2)}\n`);
  const record = async (baseName, body) => {
    const name = baseName + opt("suffix", "");
    if (!want(baseName)) return;
    const began = Date.now();
    try {
      suites[name] = { ok: true, scriptSha256: sha256(script), ...(await body()) };
    } catch (error) {
      suites[name] = { ok: false, scriptSha256: sha256(script), error: String(error?.message ?? error).split("\n").slice(0, 3).join(" ").slice(0, 400) };
    }
    suites[name].ms = Date.now() - began;
    console.log(`${suites[name].ok ? "OK  " : "FAIL"} ${name} (${suites[name].ms} ms)${suites[name].ok ? "" : ` :: ${suites[name].error}`}`);
    save();
  };

  const browser = await chromium.launch(LAUNCH);
  doc.builds[label].chromium = browser.version();
  try {
    await record("bundle", () => bundleSuite(browser));
    if (suites.bundle?.webgl) doc.machine.webgl = suites.bundle.webgl;
    await record("frames-desktop", () => frameSuite(browser, DESKTOP, true));
    await record("frames-phone", () => frameSuite(browser, PHONE, true));
    await record("memory-desktop", () => memorySuite(browser, DESKTOP));
    if (ON) {
      await record("profile", () => profileSuite(browser));
      await record("blend-desktop", () => blendSuite(browser, DESKTOP, 10, "no-preference"));
      await record("blend-phone", () => blendSuite(browser, PHONE, 5, "no-preference"));
      await record("reduced-motion", () => reducedSuite(browser));
      await record("webgl-off", () => webglSuite(browser, 3, { init: [NO_WEBGL], waitFor: SPRITES_VISIBLE, label: "WebGL blocked (sprites)" }));
      await record("rig-visible", () => webglSuite(browser, 3, { init: [], waitFor: RIG_VISIBLE, label: "WebGL available (rig)" }));
      await record("lost-context", () => lostSuite(browser, 3));
      await record("hz", () => hzSuite(browser));
      await record("tab-resume", () => tabSuite(browser));
    }
  } finally {
    await browser.close();
    save();
  }
  console.log(`wrote ${outFile}`);
}

await main();
