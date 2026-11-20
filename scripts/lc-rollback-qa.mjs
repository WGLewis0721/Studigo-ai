import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptFile = fileURLToPath(import.meta.url);
const repo = join(dirname(scriptFile), "..");
const evidenceRel = "design/living-companion/evidence/LC-9";
const evidenceDir = join(repo, ...evidenceRel.split("/"));
const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3305";
const expect = process.argv.find((arg) => arg.startsWith("--expect="))?.slice("--expect=".length);
if (!["motion", "sprites", "off"].includes(expect)) {
  console.error("usage: node scripts/lc-rollback-qa.mjs --expect=motion|sprites|off");
  process.exit(2);
}

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
];
const ROUTES = [
  { name: "quiz", path: "/dev/study?mode=quiz", shot: true },
  { name: "quiz-phase3", path: "/dev/study?mode=quiz&ui=phase3", shot: false },
];
const PREFS_KEY = "studigo.companion.fixture";
const DEFAULT_MENU = { speech: false, tuck: true, calm: false, host: "true", outfit: "" };
const NO_WEBGL = `(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === "webgl" || type === "webgl2") return null;
    return original.call(this, type, ...rest);
  };
})();`;
const landedMotion = () => document.querySelector(".cmp")?.dataset.pose === "celebrate";
const landedSprite = () => document.querySelector('.cmpPose.on[data-pose="celebrate"]') !== null;

const startedAt = new Date().toISOString();
const checks = [];
const sessions = [];
const screenshots = [];
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const scopeOf = (vp, route, extra = {}) => ({ viewport: vp.name, route, ...extra });

function observe(page) {
  return page.evaluate(() => {
    const cmp = document.querySelector(".cmp");
    const canvas = document.querySelector(".cmpRig");
    return {
      companion: cmp !== null,
      dataMotion: cmp ? cmp.hasAttribute("data-motion") : null,
      rigCanvas: canvas !== null,
      rigReady: canvas ? canvas.hasAttribute("data-ready") : null,
      drawings: document.querySelectorAll(".cmpPose").length,
      eyelids: document.querySelectorAll(".cmpLid").length,
      hostChildren: document.querySelector(".cmpHost")?.children.length ?? null,
      devHook: typeof window.studigoCompanion,
      pose: cmp ? (cmp.dataset.pose ?? null) : null,
    };
  });
}

async function check(name, scope, body) {
  const began = Date.now();
  let entry;
  try {
    const detail = (await body()) ?? null;
    entry = { name, ...scope, pass: true, ms: Date.now() - began, detail };
  } catch (error) {
    entry = { name, ...scope, pass: false, ms: Date.now() - began, error: String(error?.message ?? error).split("\n").slice(0, 3).join(" ").slice(0, 500) };
  }
  checks.push(entry);
  const where = [scope.viewport, scope.route, scope.case].filter(Boolean).join(" ");
  console.log(`${entry.pass ? "PASS" : "FAIL"} [${where}] ${name}${entry.pass ? "" : ` :: ${entry.error}`}`);
  return entry.pass;
}

async function openSession(browser, vp, scope, init) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const record = { ...scope, pageErrors: [], consoleErrors: [], badResponses: [], warnings: [] };
  sessions.push(record);
  const clip = (text) => String(text).slice(0, 300);
  page.on("pageerror", (error) => { if (record.pageErrors.length < 20) record.pageErrors.push(clip(error?.message ?? error)); });
  page.on("console", (message) => {
    const list = message.type() === "error" ? record.consoleErrors : message.type() === "warning" ? record.warnings : null;
    if (list && list.length < 20) list.push(clip(message.text()));
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && record.badResponses.length < 20) record.badResponses.push(clip(`${response.status()} ${response.url()}`));
  });
  if (init) await page.addInitScript(init);
  return { context, page, record };
}

async function load(page, path) {
  const response = await page.goto(base + path, { waitUntil: "load", timeout: 90_000 });
  assert.equal(response?.status(), 200, `GET ${path} returned ${response?.status() ?? "no response"}`);
  await page.waitForSelector(".roomDevice", { state: "attached", timeout: 60_000 });
}

async function fireCorrect(page, landed) {
  await page.waitForFunction(() => typeof window.studigoCompanion?.event === "function", null, { timeout: 10_000 });
  const sent = Date.now();
  await page.evaluate(() => window.studigoCompanion.event("correct"));
  await page.waitForFunction(landed, null, { timeout: 1_000, polling: "raf" });
  return Date.now() - sent;
}

async function shotCheck(page, vp, scope) {
  const file = `${expect}-${vp.name}.png`;
  await check(`screenshot ${file} saved, under 300 KB`, scope, async () => {
    await page.screenshot({ path: join(evidenceDir, file), animations: "disabled", caret: "hide" });
    const bytes = statSync(join(evidenceDir, file)).size;
    assert.ok(bytes < 300 * 1024, `${bytes} bytes`);
    screenshots.push(`${evidenceRel}/${file}`);
    return { bytes };
  });
}

async function motionChecks(page, vp, route) {
  const scope = scopeOf(vp, route.name);
  await check("companion carries data-motion", scope, async () => {
    await page.waitForSelector(".cmp", { state: "attached", timeout: 20_000 });
    const state = await observe(page);
    assert.equal(state.dataMotion, true, "motion default should put data-motion on .cmp");
    return state;
  });
  await check("rig canvas present and data-ready within 10 s", scope, async () => {
    await page.waitForSelector(".cmpRig[data-ready]", { state: "attached", timeout: 10_000 });
    const state = await observe(page);
    assert.equal(state.eyelids, 0, "rig markup should not carry the sprite eyelids");
    return state;
  });
  if (route.shot) await shotCheck(page, vp, scope);
  await check("correct answer makes him celebrate within 1 s", scope, async () => ({ ms: await fireCorrect(page, landedMotion) }));
}

async function spriteChecks(page, vp, route) {
  const scope = scopeOf(vp, route.name);
  await check("companion present without data-motion", scope, async () => {
    await page.waitForSelector(".cmp", { state: "attached", timeout: 20_000 });
    const state = await observe(page);
    assert.equal(state.companion, true);
    assert.equal(state.dataMotion, false, "motion off should leave data-motion off");
    return state;
  });
  await check("no rig canvas, 15 drawings and 2 eyelids", scope, async () => {
    const state = await observe(page);
    assert.equal(state.rigCanvas, false, "rig canvas should not exist with motion off");
    assert.equal(state.drawings, 15);
    assert.equal(state.eyelids, 2);
    return state;
  });
  await check("center drawing decoded", scope, async () => {
    await page.waitForFunction(() => {
      const img = document.querySelector('.cmpPose[data-pose="center"]');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, null, { timeout: 10_000 });
  });
  if (route.shot) await shotCheck(page, vp, scope);
  await check("correct answer shows celebrate drawing within 1 s", scope, async () => ({ ms: await fireCorrect(page, landedSprite) }));
}

async function offChecks(page, vp, route) {
  const scope = scopeOf(vp, route.name);
  await check("no companion element, empty host, no dev hook", scope, async () => {
    const state = await observe(page);
    assert.equal(state.companion, false, ".cmp should not exist with the companion off");
    assert.equal(state.hostChildren, 0, ".cmpHost should have no children");
    assert.equal(state.devHook, "undefined");
    return state;
  });
  await check("room renders: Study Room sections visible", scope, async () => {
    await page.getByRole("navigation", { name: "Study Room sections" }).waitFor({ state: "visible", timeout: 20_000 });
  });
  await check("quiz topic checkbox toggles and restores", scope, async () => {
    const box = page.getByRole("checkbox", { name: /^Select / }).first();
    await box.waitFor({ state: "visible", timeout: 20_000 });
    const before = await box.isChecked();
    await box.click({ timeout: 10_000 });
    const after = await box.isChecked();
    assert.notEqual(after, before, "checkbox did not change state");
    await box.click({ timeout: 10_000 });
    assert.equal(await box.isChecked(), before, "checkbox did not restore");
    return { before, after };
  });
  if (route.shot) await shotCheck(page, vp, scope);
}

async function routeChecks(browser, vp, route) {
  const scope = scopeOf(vp, route.name);
  const { context, page, record } = await openSession(browser, vp, scope);
  try {
    const loaded = await check(`GET ${route.path} returns 200`, scope, () => load(page, route.path));
    if (loaded) {
      if (expect === "motion") await motionChecks(page, vp, route);
      else if (expect === "sprites") await spriteChecks(page, vp, route);
      else await offChecks(page, vp, route);
    }
    await check("no uncaught page errors or console errors", scope, async () => {
      assert.deepEqual(record.pageErrors, []);
      assert.deepEqual(record.consoleErrors, []);
    });
  } finally {
    await context.close();
  }
}

async function webglUnavailableChecks(browser, vp) {
  const scope = scopeOf(vp, "quiz", { case: "webgl-unavailable" });
  const { context, page, record } = await openSession(browser, vp, scope, NO_WEBGL);
  try {
    if (!(await check("page loads with WebGL disabled", scope, () => load(page, "/dev/study?mode=quiz")))) return;
    await check("sprites take over: no rig canvas, no data-motion, 15 drawings", scope, async () => {
      await page.waitForSelector(".cmp", { state: "attached", timeout: 20_000 });
      await page.waitForFunction(() => document.querySelectorAll(".cmpLid").length === 2, null, { timeout: 10_000 });
      const state = await observe(page);
      assert.equal(state.rigCanvas, false);
      assert.equal(state.dataMotion, false);
      assert.equal(state.drawings, 15);
      return state;
    });
    await check("correct answer still reacts with sprites", scope, async () => ({ ms: await fireCorrect(page, landedSprite) }));
    await check("no uncaught page errors", scope, async () => {
      assert.deepEqual(record.pageErrors, []);
    });
  } finally {
    await context.close();
  }
}

async function lostContextChecks(browser, vp) {
  const scope = scopeOf(vp, "quiz", { case: "lost-webgl-context" });
  const { context, page, record } = await openSession(browser, vp, scope);
  try {
    if (!(await check("page loads", scope, () => load(page, "/dev/study?mode=quiz")))) return;
    await check("sprites replace the rig within 1 s of context loss", scope, async () => {
      await page.waitForSelector(".cmpRig[data-ready]", { state: "attached", timeout: 10_000 });
      const lost = await page.evaluate(() => {
        const gl = document.querySelector(".cmpRig").getContext("webgl");
        const ext = gl && gl.getExtension("WEBGL_lose_context");
        if (!ext) return false;
        ext.loseContext();
        return true;
      });
      assert.equal(lost, true, "WEBGL_lose_context unavailable, so the loss could not be simulated");
      const sent = Date.now();
      await page.waitForFunction(() => {
        const cmp = document.querySelector(".cmp");
        return document.querySelector(".cmpRig") === null
          && document.querySelectorAll(".cmpLid").length === 2
          && cmp !== null && !cmp.hasAttribute("data-motion");
      }, null, { timeout: 1_000, polling: "raf" });
      return { ms: Date.now() - sent, ...(await observe(page)) };
    });
    await check("correct answer still reacts after the switch", scope, async () => ({ ms: await fireCorrect(page, landedSprite) }));
    await check("no uncaught page errors", scope, async () => {
      assert.deepEqual(record.pageErrors, []);
    });
  } finally {
    await context.close();
  }
}

async function menuDefaults(page) {
  await page.locator(".cmp .cmpSill").click({ timeout: 10_000 });
  await page.locator(".cmpSheet").waitFor({ state: "visible", timeout: 5_000 });
  const values = await page.evaluate(() => {
    const sheet = document.querySelector(".cmpSheet");
    return {
      speech: sheet.querySelector('input[data-set="speech"]').checked,
      tuck: sheet.querySelector('input[data-set="tuck"]').checked,
      calm: sheet.querySelector('input[data-set="calm"]').checked,
      host: sheet.querySelector('button[data-host-choice="float"]').getAttribute("aria-pressed"),
      outfit: sheet.querySelector('select[data-set="outfit"]').value,
    };
  });
  await page.locator(".cmpSheetHead button[data-card='close']").click({ timeout: 5_000 });
  await page.locator(".cmpSheet").waitFor({ state: "detached", timeout: 5_000 });
  assert.deepEqual(values, DEFAULT_MENU);
  return values;
}

async function corruptPrefsChecks(browser, vp) {
  const scope = scopeOf(vp, "quiz", { case: "corrupt-prefs" });
  const { context, page, record } = await openSession(browser, vp, scope);
  try {
    if (!(await check("page loads", scope, () => load(page, "/dev/study?mode=quiz")))) return;
    await check("malformed saved prefs survive a reload and the room renders", scope, async () => {
      await page.evaluate((key) => window.localStorage.setItem(key, "{bad"), PREFS_KEY);
      await page.reload({ waitUntil: "load", timeout: 90_000 });
      await page.waitForSelector(".roomDevice", { state: "attached", timeout: 60_000 });
      assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), PREFS_KEY), "{bad");
    });
    if (expect === "off") {
      await check("no companion in off mode with malformed prefs", scope, async () => {
        const state = await observe(page);
        assert.equal(state.companion, false);
        return state;
      });
    } else {
      await check("companion mounts on defaults", scope, async () => {
        await page.waitForSelector(".cmp", { state: "attached", timeout: 20_000 });
        if (expect === "motion") await page.waitForSelector(".cmpRig[data-ready]", { state: "attached", timeout: 10_000 });
        const state = await observe(page);
        assert.equal(state.dataMotion, expect === "motion");
        return state;
      });
      await check("his menu shows the default choices", scope, () => menuDefaults(page));
    }
    await check("no uncaught page errors with malformed prefs", scope, async () => {
      assert.deepEqual(record.pageErrors, []);
    });
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const chromiumVersion = browser.version();
  try {
    for (const vp of VIEWPORTS) {
      for (const route of ROUTES) await routeChecks(browser, vp, route);
      if (expect === "motion") {
        await webglUnavailableChecks(browser, vp);
        await lostContextChecks(browser, vp);
      }
      await corruptPrefsChecks(browser, vp);
    }
    return chromiumVersion;
  } finally {
    await browser.close();
  }
}

let chromiumVersion = null;
let fatal = null;
try {
  chromiumVersion = await main();
} catch (error) {
  fatal = String(error?.stack ?? error).slice(0, 1200);
}

const failed = checks.filter((entry) => !entry.pass).length;
const report = {
  id: "LC-9",
  expect,
  base,
  headBranch: git("rev-parse", "--abbrev-ref", "HEAD"),
  headSha: git("rev-parse", "HEAD"),
  scriptSha256: createHash("sha256").update(readFileSync(scriptFile)).digest("hex"),
  serverEnv: process.env.LC_QA_SERVER_ENV ?? "(not recorded)",
  node: process.version,
  chromium: chromiumVersion,
  startedAt,
  finishedAt: new Date().toISOString(),
  result: fatal || failed ? "FAIL" : "PASS",
  fatal,
  summary: { checks: checks.length, passed: checks.length - failed, failed },
  checks,
  screenshots,
  sessions,
};
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, `${expect}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`LC-9 ${expect}: ${report.result} (${checks.length - failed}/${checks.length} checks passed)`);
process.exitCode = fatal || failed ? 1 : 0;
