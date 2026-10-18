import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const output = "artifacts/phase3-visual/drawer-and-materials";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {})
});
const raw = "GOVERNMENT / STUDY MATERIALS Page 1 Our Government Vocabulary primary source — a record made by someone who was there secondary source — a later record made by someone else democracy — people vote to choose leaders";
const evidence = [{ blockKey: "synthetic-block", pageNumber: 1 }];
const edition = {
  version: 1, schemaVersion: 1, promptVersion: 1, level: "general", roomId: "fixture",
  topicIds: [], sourceSnapshot: "synthetic-browser-only",
  chapters: [{
    id: "chapter-1", title: raw, objective: "Study source facts", objectiveEvidence: evidence,
    facts: [{ id: "fact-1", text: ("Study only from the authorized source. ").repeat(11), evidence }],
    terms: [], examples: [], practice: [], answers: []
  }]
};
const results = [];
try {
  for (const [width, height, mode] of [[820, 700, "materials"], [1440, 900, "coach"], [1440, 720, "plan"]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference" });
    try {
      await context.route("**/api/guides/edition?*", route => route.fulfill({ json: { edition, updateAvailable: false } }));
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      const response = await page.goto(`${origin}/dev/study?shell=1&mode=${mode}&ui=phase3`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      await page.mouse.move(1, 1);
      const frame = page.locator(".modeFrame").first();
      const strip = frame.locator(".modeStrip");
      const drawerButton = frame.locator(".modeCollapseToggle");
      const fit = await page.evaluate(() => {
        const shell = document.querySelector(".roomWorkspace");
        const device = document.querySelector(".roomDevice");
        const screen = document.querySelector(".modeSurface");
        const bottom = shell?.getBoundingClientRect().bottom ?? Infinity;
        return {
          shellBottom: bottom, deviceBottom: device?.getBoundingClientRect().bottom ?? Infinity,
          viewport: window.innerHeight, scrollHeight: screen?.scrollHeight ?? 0,
          visibleHeight: screen?.clientHeight ?? 0,
          overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });
      assert.ok(fit.deviceBottom <= height + 2, `device fits viewport: ${JSON.stringify(fit)}`);
      assert.ok(fit.shellBottom <= height + 2, `last row inside frame: ${JSON.stringify(fit)}`);
      assert.ok(fit.visibleHeight >= 150, "scrollable room has usable height");
      assert.equal(fit.overflow, 0, "no horizontal overflow");
      // Coach intentionally scrolls its conversation, never the outer mode surface.
      // Materials and Plan must expose their final row through the page scroller.
      if (mode !== "coach" && fit.scrollHeight > fit.visibleHeight) {
        const surface = page.locator(".modeSurface");
        const scroller = await surface.evaluate(el => getComputedStyle(el).overflowY);
        assert.equal(scroller, "auto", "non-chat room content uses the scrollable screen");
        await surface.evaluate(el => { el.scrollTo({ top: el.scrollHeight, behavior: "instant" }); });
        const atBottom = await surface.evaluate(el => el.scrollTop + el.clientHeight + 2 >= el.scrollHeight);
        assert.equal(atBottom, true, "the last row is reachable by scrolling");
      }

      await page.waitForFunction(() => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true", undefined, { timeout: 6500 });
      assert.equal(await drawerButton.getAttribute("aria-expanded"), "false");
      assert.equal(await strip.getAttribute("inert"), "");
      const colors = await drawerButton.evaluate(el => ({
        border: getComputedStyle(el).borderLeftColor,
        rail: getComputedStyle(el.closest(".modeFrame").querySelector(".studigoRail")).backgroundColor
      }));
      assert.equal(colors.border, colors.rail, "Show controls border shares the page divider color");
      await page.screenshot({ path: `${output}/${width}-${mode}-closed.png`, animations: "disabled" });
      await drawerButton.click();
      assert.equal(await frame.getAttribute("data-collapsed"), "false");
      assert.equal(await strip.getAttribute("inert"), null);
      await page.screenshot({ path: `${output}/${width}-${mode}-open.png`, animations: "disabled" });
      if (mode === "materials") {
        const expanded = page.locator(".guideOutlineOriginal");
        await expanded.locator(":scope > summary").click();
        assert.ok(await expanded.locator(".guideSourcePoint").count() > 1, "expanded OCR has separate readable points");
        assert.ok(await expanded.locator(".guideSourceSection").count() >= 2, "original pages and headings are structured");
        assert.equal(await expanded.locator(".guideSourceVerbatim pre").innerText(), raw, "exact OCR wording preserved");
        await page.screenshot({ path: `${output}/${width}-materials-outline-expanded.png`, animations: "disabled" });
      }
      assert.deepEqual(errors, [], "no browser JS errors");
      results.push({ width, height, mode, fit, border: colors.border });
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/dev/study?shell=1&mode=coach&ui=phase3`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3250);
    assert.equal(await page.locator(".modeFrame").first().getAttribute("data-collapsed"), "false", "mobile mode controls do not auto-hide");
    assert.equal(await page.locator(".modeCollapseToggle").isVisible(), false, "mobile has no drawer toggle");
    await page.setViewportSize({ width: 820, height: 700 });
    await page.waitForFunction(() => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true", undefined, { timeout: 6500 });
    assert.equal(await page.locator(".modeStripInner").first().evaluate(el => getComputedStyle(el).animationName), "none", "reduced motion skips bounce");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator(".modeFrame").first().getAttribute("data-collapsed"), "false", "phone restores controls on resize");
  } finally { await context.close(); }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ cases: results, provenance: "Synthetic local fixture; no learner data or grading" }, null, 2));
  await browser.close();
}
console.log("Drawer, full-height Study Room, expanded Materials outline and phone regression passed.");
