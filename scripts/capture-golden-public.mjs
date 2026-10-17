import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

/**
 * Non-authenticated capture of real public production pages. No student
 * materials, local storage or cookies are carried between device cases.
 * Golden code SHA is verified separately in the freeze manifest/runbook.
 */
const goldenSha = "726b1e7b061109b9c31b658f37fb97da0722e8d0";
const deployment = "dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn";
const origin = "https://studigo-ai.vercel.app";
const output = process.env.GOLDEN_PUBLIC_OUTPUT || "artifacts/phase3-visual/golden-public";
const viewports = [
  { id: "phone-320", width: 320, height: 720 },
  { id: "phone-390", width: 390, height: 844 },
  { id: "tablet-820", width: 820, height: 1180 },
  { id: "desktop-1440", width: 1440, height: 900 },
];
const routes = [
  { id: "home", path: "/" },
  { id: "signup", path: "/signup" },
];
await mkdir(output, { recursive: true });
const report = {
  kind: "live-public-production-baseline",
  goldenSha,
  productionDeployment: deployment,
  origin,
  capturedAt: new Date().toISOString(),
  cases: [],
  failures: [],
};
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        colorScheme: "light",
        locale: "en-US",
      });
      const page = await context.newPage();
      const row = { viewport: viewport.id, path: route.path, screenshot: null, status: null, overflow: null, pageTitle: null };
      try {
        const response = await page.goto(origin + route.path, { waitUntil: "domcontentloaded", timeout: 45000 });
        assert.ok(response, "Production returned no response");
        row.status = response.status();
        assert.ok(row.status >= 200 && row.status < 400, `Unexpected ${route.id} status ${row.status}`);
        await page.evaluate(async () => { await document.fonts.ready; });
        // Allow first-paint hydration/initial UI state, but never wait for app animation.
        await page.waitForTimeout(1100);
        row.pageTitle = await page.title();
        row.overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
        row.screenshot = `${viewport.id}-production-${route.id}.png`;
        await page.screenshot({ path: path.join(output, row.screenshot), fullPage: true, animations: "disabled" });
        assert.ok((await page.locator("body").innerText()).trim().length > 30, "Production page rendered no readable content");
      } catch (err) {
        row.error = err instanceof Error ? err.message : String(err);
        report.failures.push({ viewport: viewport.id, path: route.path, error: row.error });
      } finally {
        report.cases.push(row);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, "golden-public-manifest.json"), JSON.stringify(report, null, 2) + "\n");
}
if (report.failures.length) {
  console.error(JSON.stringify(report.failures, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Captured ${report.cases.length} real production public screenshots: ${origin} at ${goldenSha.slice(0, 8)}`);
}
