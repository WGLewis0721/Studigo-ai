import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
const modes = process.env.PHASE3_VISUAL_INTERACTIONS_ONLY === "1" ? [] : ["coach", "materials", "quiz", "cards", "test", "mastery", "weak", "plan", "cram"];
const skins = ["legacy", "phase3"];
const evidence = [{ blockKey: "synthetic-block", pageNumber: 1 }];
const syntheticEdition = { version: 1, schemaVersion: 1, promptVersion: 1, level: "general", roomId: "fixture", topicIds: [], sourceSnapshot: "synthetic-browser-only", chapters: [{
  id: "synthetic-chapter", title: "Synthetic science study guide", objective: "Explain inherited traits", objectiveEvidence: evidence,
  facts: [{ id: "fact-1", text: "Inherited traits pass from parents to offspring.", evidence }], terms: [{ id: "term-1", term: "Trait", definition: "A characteristic of an organism.", evidence }],
  examples: [], practice: [{ id: "q-1", prompt: "What is an inherited trait?", answerId: "a-1", evidence }], answers: [{ id: "a-1", questionId: "q-1", text: "A characteristic passed from parents to offspring.", evidence }]
}] };

await mkdir(output, { recursive: true });
const sourceTree = () => execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const report = { sourceTreeBefore: sourceTree(), sourceTreeAfter: null, browserVersion: null, forcedColors: process.env.PHASE3_VISUAL_FORCED_COLORS ?? "none", commit: process.env.GITHUB_SHA ?? "local", origin, cases: [], interactions: [], home: [], failures: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  report.browserVersion = browser.version();
  for (const viewport of widths) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
      forcedColors: report.forcedColors,
    });
    // Synthetic responses are explicitly local browser fixtures; no grading,
    // source authorization, generation or learner persistence is exercised.
    await context.route("**/api/guides/edition?*", route => route.fulfill({ json: { edition: syntheticEdition, updateAvailable: false } }));
    await context.route("**/api/guides/source?*", route => route.fulfill({ json: { blockKey: "synthetic-block", pageNumber: 1, text: "Synthetic source: inherited traits pass from parents to offspring.", document: { id: "source", name: "Synthetic source.pdf", mimeType: "application/pdf" } } }));
    const page = await context.newPage();
    for (const mode of modes) {
      for (const skin of skins) {
        const url = `${origin}/dev/study?shell=1&mode=${encodeURIComponent(mode)}&ui=${skin}`;
        let entry = { viewport: viewport.name, mode, skin, url, screenshot: "", zoomScreenshot: "", horizontalOverflow: null, zoomOverflow: null, navButtons: null, keyboard: [], reducedMotion: null, error: null };
        try {
          const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
          assert.equal(response?.status(), 200, "synthetic fixture must return HTTP 200");
          const device = page.locator(".roomDevice");
          await device.waitFor({ state: "attached", timeout: 45_000 });
          const attrs = await device.getAttribute("data-ui");
          assert.equal(attrs === "phase3", skin === "phase3", "visual gate does not match requested comparison");
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].filter(image => image.currentSrc && image.getClientRects().length > 0).map(image => image.decode()));
          });
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
          if (mode === "materials" && skin === "phase3") {
            const exports = page.locator(".materialsGuide .studyGuideDownload button");
            assert.equal(await exports.count(), 2, "generated guide must offer two distinct download formats");
            assert.match(await exports.nth(0).innerText(), /PDF/i, "PDF format must remain visible");
            assert.match(await exports.nth(1).innerText(), /Word/i, "Word format must remain visible");
            assert.match(await exports.nth(0).getAttribute("aria-label") ?? "", /PDF/);
            assert.match(await exports.nth(1).getAttribute("aria-label") ?? "", /Word/);
          }
          if (viewport.width <= 700 && mode === "materials" && skin === "phase3") {
            // Overflow-only checks miss a floating mascot covering real source text.
            const collisions = await page.evaluate(() => {
              const mascot = document.querySelector(".cmp:not(.ghost)");
              if (!(mascot instanceof HTMLElement) || mascot.getClientRects().length === 0) {
                return ["companion window is missing"];
              }
              const windowBox = mascot.getBoundingClientRect();
              return [".materialsIntro h2", ".materialsReadout"].flatMap(selector => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) return [selector + " is missing"];
                const rect = element.getBoundingClientRect();
                return rect.left < windowBox.right && rect.right > windowBox.left &&
                  rect.top < windowBox.bottom && rect.bottom > windowBox.top ? [selector] : [];
              });
            });
            assert.deepEqual(collisions, [], "Materials title and readable-file status must remain clear of Studigo");
          }
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
    const interaction = { viewport: viewport.name, settings: false, sourceShortcut: "hidden", syntheticQuiz: false, sourceInspector: false, error: null };
    try {
      await page.goto(`${origin}/dev/study?shell=1&mode=coach&ui=phase3`, { waitUntil: "networkidle" });
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
      await page.goto(`${origin}/dev/study?shell=1&mode=quiz&ui=phase3`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Start quiz" }).click();
      await page.locator(".choiceItem").first().click();
      await page.getByRole("button", { name: "Confident", exact: false }).click();
      await page.screenshot({ path: path.join(output, `${viewport.name}-quiz-selection-phase3.png`), animations: "disabled" });
      assert.equal(gradeCalls, 0, "answer/confidence selection must not submit");
      if (report.forcedColors === "active") {
        const selectedConfidence = page.locator('.confidenceButton[aria-pressed="true"]');
        assert.ok(await selectedConfidence.evaluate(el => {
          const style = getComputedStyle(el);
          return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
        }), "forced-colors confidence selection must remain visible");
      }
      await page.locator(".roomStudioSubmit").click();
      await page.locator(".quizFeedback").waitFor();
      assert.equal(gradeCalls, 1, "explicit submit must grade once");
      interaction.syntheticQuiz = true;
      await page.goto(`${origin}/dev/study?shell=1&mode=materials&ui=phase3`, { waitUntil: "networkidle" });
      const chooseFiles = page.getByRole("button", { name: "Choose files", exact: false });
      if (await chooseFiles.isVisible()) {
        await chooseFiles.scrollIntoViewIfNeeded();
        assert.ok(await chooseFiles.evaluate(el => {
          const box = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), "companion must not cover the Choose files hit target");
      }
      const citation = page.locator("button.materialsCitation").first();
      await citation.click();
      const inspector = page.locator("dialog.materialsSourceDialog[open]");
      await inspector.waitFor();
      assert.ok(await inspector.evaluate(el => el.matches(":modal")), "source inspector must use native modal top layer");
      await inspector.locator("blockquote").waitFor();
      const box = await inspector.boundingBox();
      if (viewport.width <= 700) assert.ok(Math.abs(box.y + box.height - viewport.height) <= 2, "phone source sheet must sit at viewport bottom");
      else assert.ok(Math.abs(box.x + box.width - (viewport.width - 24)) <= 2, "wide source pane must align 24px from right");
      await page.screenshot({ path: path.join(output, `${viewport.name}-source-inspector-phase3.png`), animations: "disabled" });
      await page.keyboard.press("Escape");
      await inspector.waitFor({ state: "detached" });
      assert.ok(await citation.evaluate(el => el === document.activeElement), "Escape must restore citation focus");
      await citation.click();
      await page.locator("dialog.materialsSourceDialog[open]").getByRole("button", { name: "Close", exact: true }).click();
      assert.ok(await citation.evaluate(el => el === document.activeElement), "Close must restore citation focus");
      interaction.sourceInspector = true;

    } catch (error) {
      interaction.error = String(error);
      report.failures.push({ ...interaction });
      console.error(`${viewport.name} interactions: ${interaction.error}`);
    }
    report.interactions.push(interaction);
    for (const first of [false, true]) {
      const home = { viewport: viewport.name, firstRun: first, screenshot: "", horizontalOverflow: null, zoomOverflow: null, reflowOverflow: null, error: null };
      try {
        await page.goto(`${origin}/dev/home${first ? "?first=1" : ""}`, { waitUntil: "networkidle" });
        const surface = page.locator(first ? ".firstRoom" : ".homeHero");
        await surface.waitFor();
        assert.equal(await surface.getAttribute("data-ui"), "phase3", "Home fixture requires NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1");
        await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all([...document.images].filter(image => image.currentSrc && image.getClientRects().length > 0).map(image => image.decode()));
          });
        home.horizontalOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        home.screenshot = path.join(output, `${viewport.name}-home${first ? "-first" : ""}-phase3.png`);
        await page.screenshot({ path: home.screenshot, fullPage: true, animations: "disabled" });
        assert.ok(home.horizontalOverflow <= 2, `Home overflow ${home.horizontalOverflow}px`);
        await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
        home.zoomOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        home.zoomOverflowNodes = await page.evaluate(() => [...document.querySelectorAll("body *")].map(el => {
          const box = el.getBoundingClientRect();
          return { tag: el.tagName, className: typeof el.className === "string" ? el.className : "", text: (el.textContent ?? "").trim().slice(0, 70), left: box.left, right: box.right, width: box.width };
        }).filter(box => box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)).slice(0, 40));
        await page.screenshot({ path: home.screenshot.replace(".png", "-zoom200.png"), fullPage: true, animations: "disabled" });
        await page.evaluate(() => { document.documentElement.style.zoom = ""; });
        await page.setViewportSize({ width: Math.floor(viewport.width / 2), height: Math.floor(viewport.height / 2) });
        home.reflowOverflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        await page.screenshot({ path: home.screenshot.replace(".png", "-reflow200.png"), fullPage: true, animations: "disabled" });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        assert.ok(home.reflowOverflow <= 2, `Home half-viewport reflow overflow ${home.reflowOverflow}px`);
        assert.ok(home.zoomOverflow <= 2, `Home 200% CSS zoom overflow ${home.zoomOverflow}px`);
      } catch (error) {
        home.error = String(error);
        report.failures.push({ ...home });
        console.error(`${viewport.name} Home: ${home.error}`);
      }
      report.home.push(home);
    }
    await context.close();
  }
} catch (error) {
  report.failures.push({ stage: "browser infrastructure", error: String(error) });
} finally {
  await browser?.close();
  report.sourceTreeAfter = sourceTree();
  if (report.sourceTreeAfter !== report.sourceTreeBefore) report.failures.push({ stage: "source stability", error: "Source tree changed during browser evidence run; repeat against a frozen tree" });
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}
console.log(`Phase 3 synthetic comparison: ${report.cases.length} room cases, ${report.interactions.length} interaction groups, ${report.home.length} Home cases, ${report.failures.length} failures`);
if (report.failures.length) {
  for (const failure of report.failures) console.error(`${failure.viewport} ${failure.mode} ${failure.skin}: ${failure.error}`);
  process.exitCode = 1;
}
