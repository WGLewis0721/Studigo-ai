import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

// Never use an authenticated room here: all specimens are public synthetic fixtures
// and the dev-only route rejects production traffic.
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const output = process.env.PHASE3_VISUAL_DIR ?? "artifacts/phase3-visual";
const widths = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const modes = ["coach", "materials", "quiz", "mastery", "plan"];
const skins = ["legacy", "phase3"];
await mkdir(output, { recursive: true });
const report = { commit: process.env.GITHUB_SHA ?? "local", origin, cases: [], failures: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const mode of modes) {
      for (const skin of skins) {
        const url = `${origin}/dev/study?bare=1&mode=${encodeURIComponent(mode)}&ui=${skin}`;
        let entry = { viewport: viewport.name, mode, skin, url, screenshot: "", horizontalOverflow: null, navButtons: null, error: null };
        try {
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
          assert.equal(response?.status(), 200, "synthetic fixture must return HTTP 200");
          const device = page.locator(".roomDevice");
          await device.waitFor({ state: "attached", timeout: 45_000 });
          const attrs = await device.getAttribute("data-ui");
          assert.equal(attrs === "phase3", skin === "phase3", "visual gate does not match requested comparison");
          await page.evaluate(() => document.fonts.ready);
          const metrics = await page.evaluate(() => ({
            overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            navButtons: document.querySelectorAll(".studyGroups button").length,
          }));
          entry.horizontalOverflow = metrics.overflow;
          entry.navButtons = metrics.navButtons;
          assert.ok(metrics.navButtons >= 5, "all five Study Room sections must remain mounted");
          const file = path.join(output, `${viewport.name}-${mode}-${skin}.png`);
          await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 30_000 });
          entry.screenshot = file;
          assert.ok(metrics.overflow <= 2, `horizontal document overflow ${metrics.overflow}px`);
        } catch (err) {
          entry.error = String(err);
          report.failures.push({ ...entry });
        }
        report.cases.push(entry);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}
console.log(`Phase 3 synthetic comparison: ${report.cases.length} cases, ${report.failures.length} failures`);
if (report.failures.length) {
  for (const failure of report.failures) console.error(`${failure.viewport} ${failure.mode} ${failure.skin}: ${failure.error}`);
  process.exitCode = 1;
}
