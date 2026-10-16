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
const modes = ["coach", "materials", "quiz", "cards", "test", "mastery", "weak", "plan", "cram"];
const skins = ["legacy", "phase3"];
await mkdir(output, { recursive: true });
const report = { commit: process.env.GITHUB_SHA ?? "local", origin, cases: [], interactions: [], failures: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const mode of modes) {
      for (const skin of skins) {
        const url = `${origin}/dev/study?shell=1&mode=${encodeURIComponent(mode)}&ui=${skin}`;
        let entry = { viewport: viewport.name, mode, skin, url, screenshot: "", zoomScreenshot: "", horizontalOverflow: null, zoomOverflow: null, navButtons: null, keyboard: [], reducedMotion: null, error: null };
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
            navButtons: [...document.querySelectorAll(".studyGroups button")].filter(el => el.getClientRects().length > 0).length,
            reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
            longAnimations: document.getAnimations().filter(a => a.playState === "running" && Number(a.effect?.getTiming().duration) > 10).length,
          }));
          entry.horizontalOverflow = metrics.overflow;
          entry.navButtons = metrics.navButtons;
          entry.reducedMotion = metrics.reducedMotion;
          assert.ok(metrics.reducedMotion, "reduced-motion media query must be active");
          assert.equal(metrics.longAnimations, 0, "reduced-motion must stop long-running CSS animations");
          assert.ok(metrics.navButtons >= 5, "all five Study Room sections must remain visible");
          const file = path.join(output, `${viewport.name}-${mode}-${skin}.png`);
          await page.screenshot({ path: file, fullPage: true, animations: "disabled", timeout: 30_000 });
          entry.screenshot = file;
          assert.ok(metrics.overflow <= 2, `horizontal document overflow ${metrics.overflow}px`);
          // CSS zoom exercises enlarged controls and reflow. It is not OS/browser
          // text-only zoom, a screen reader, or native-device acceptance.
          await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
          entry.zoomOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
          entry.zoomScreenshot = path.join(output, `${viewport.name}-${mode}-${skin}-zoom200.png`);
          await page.screenshot({ path: entry.zoomScreenshot, fullPage: true, animations: "disabled" });
          assert.ok(entry.zoomOverflow <= 2, `200% CSS zoom horizontal overflow ${entry.zoomOverflow}px`);
          await page.evaluate(() => { document.documentElement.style.zoom = ""; });
          // Focus by Tab, then activate with Enter. Every visible section should
          // remain reachable without pointer clicks; aria-current must update.
          for (const name of ["Coach", "Practice", "Progress", "Plan", "Materials"]) {
            const button = page.locator(".studyGroups button:visible").filter({ hasText: name });
            await button.focus();
            await page.keyboard.press("Tab");
            await page.keyboard.press("Shift+Tab");
            assert.equal(await button.evaluate(el => document.activeElement === el), true, `${name} must remain in keyboard tab order`);
            const outline = await button.evaluate(el => getComputedStyle(el).outlineStyle);
            assert.notEqual(outline, "none", `${name} must show keyboard focus`);
            await page.keyboard.press("Enter");
            await page.waitForFunction(label => [...document.querySelectorAll('.studyGroups button[aria-current="page"]')].some(el => el.textContent?.includes(label)), name);
            entry.keyboard.push(name);
          }
        } catch (err) {
          entry.error = String(err);
          report.failures.push({ ...entry });
          console.error(`${viewport.name} ${mode} ${skin}: ${entry.error}`);
        }
        report.cases.push(entry);
      }
    }
    // Extra controls use the same synthetic room and never contact a learner API.
    const interaction = { viewport: viewport.name, settings: false, sourceShortcut: "hidden", syntheticQuiz: false, error: null };
    try {
      await page.goto(`${origin}/dev/study?shell=1&mode=coach&ui=phase3`, { waitUntil: "domcontentloaded" });
      const source = page.locator("button.sourceCount");
      if (await source.isVisible()) {
        await source.click();
        await page.locator('.studyGroups button[aria-current="page"]').filter({ hasText: "Materials" }).first().waitFor();
        interaction.sourceShortcut = "passed";
      }
      const settings = page.getByRole("button", { name: "Room settings", exact: true });
      await settings.click();
      const dialog = page.getByRole("dialog", { name: "Study Room settings" });
      await dialog.waitFor();
      const controls = dialog.locator('a[href]:visible, button:not([disabled]):visible, input:not([disabled]):not([type="hidden"]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible, [tabindex="0"]:visible');
      assert.ok(await controls.first().evaluate(el => el === document.activeElement), "settings must initially focus its first visible control");
      await controls.last().focus();
      await page.keyboard.press("Tab");
      assert.ok(await controls.first().evaluate(el => el === document.activeElement), "settings must wrap Tab to the first control");
      await page.keyboard.press("Shift+Tab");
      assert.ok(await controls.last().evaluate(el => el === document.activeElement), "settings must wrap Shift+Tab to the last control");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.ok(await settings.evaluate(el => el === document.activeElement), "Escape must restore focus to settings invoker");
      interaction.settings = true;
      let gradeCalls = 0;
      await page.route("**/api/quiz", route => route.fulfill({ json: { questions: [{ id: "synthetic-q1", kind: "multiple_choice", prompt: "Synthetic browser check: which action submits?", choices: ["Submit answer", "Choosing confidence"], difficulty: "easy", topic_id: null }] } }));
      await page.route("**/api/quiz/attempt", route => { gradeCalls++; return route.fulfill({ json: { isCorrect: true, score: 100, feedback: "Synthetic feedback only.", confidence: 3, correctChoice: 0, expectedAnswer: null, explanation: "", citations: [] } }); });
      await page.goto(`${origin}/dev/study?shell=1&mode=quiz&ui=phase3`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Start quiz" }).click();
      await page.locator(".choiceItem").first().click();
      await page.getByRole("button", { name: "Confident", exact: false }).click();
      assert.equal(gradeCalls, 0, "answer/confidence selection must not submit");
      await page.getByRole("button", { name: "Submit answer" }).click();
      await page.locator(".quizFeedback").waitFor();
      assert.equal(gradeCalls, 1, "explicit submit must grade once");
      interaction.syntheticQuiz = true;
    } catch (error) {
      interaction.error = String(error);
      report.failures.push({ ...interaction });
      console.error(`${viewport.name} interactions: ${interaction.error}`);
    }
    report.interactions.push(interaction);
    await context.close();
  }
} catch (error) {
  report.failures.push({ stage: "browser infrastructure", error: String(error) });
} finally {
  await browser?.close();
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}
console.log(`Phase 3 synthetic comparison: ${report.cases.length} cases, ${report.failures.length} failures`);
if (report.failures.length) {
  for (const failure of report.failures) console.error(`${failure.viewport} ${failure.mode} ${failure.skin}: ${failure.error}`);
  process.exitCode = 1;
}
