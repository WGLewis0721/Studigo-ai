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
const report = { sourceTreeBefore: sourceTree(), sourceTreeAfter: null, browserVersion: null, forcedColors: process.env.PHASE3_VISUAL_FORCED_COLORS ?? "none", commit: process.env.GITHUB_SHA ?? "local", origin, cases: [], interactions: [], home: [], guidedLearn: [], explore: [], failures: [] };
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
          if (mode === "coach") {
            // Lock in the Coach/Learn reading contract from PR #175 and the phone
            // clear control from PR #174. CSS probes run inside the actual room
            // shell, then are removed before screenshots or interaction checks.
            const reading = await page.evaluate(() => {
              const chat = document.querySelector(".coachChat");
              const composer = chat?.querySelector(".chatComposer input");
              const clear = chat?.querySelector(".chatEraser");
              if (!(chat instanceof HTMLElement) || !composer || !clear) throw new Error("Coach chat, composer, or clear control missing");
              const probe = document.createElement("div");
              probe.setAttribute("aria-hidden", "true");
              probe.innerHTML = '<div class="studentBubble">Question</div><div class="answerBubble"><span class="answerKicker">Studigo</span><div class="answerText"><div class="richText"><p>Answer</p><ul><li>One item</li></ul><h1>Heading one</h1><h2>Heading two</h2><h3>Heading three</h3><h4>Heading four</h4></div></div></div><div class="lessonText">Lesson</div>';
              chat.append(probe);
              const samples = {};
              try {
                for (const [name, selector] of Object.entries({
                  learner: ".studentBubble",
                  answer: ".answerText",
                  paragraph: ".answerText .richText p",
                  listItem: ".answerText .richText li",
                  lesson: ".lessonText",
                  kicker: ".answerKicker",
                  h1: ".answerText .richText h1",
                  h2: ".answerText .richText h2",
                  h3: ".answerText .richText h3",
                  h4: ".answerText .richText h4"
                })) {
                  const el = probe.querySelector(selector);
                  if (!el) throw new Error("Typography probe missing " + selector);
                  const css = getComputedStyle(el);
                  samples[name] = { fontSize: css.fontSize, lineHeight: css.lineHeight, fontWeight: css.fontWeight };
                }
              } finally {
                probe.remove();
              }
              const inputStyle = getComputedStyle(composer);
              const buttonStyle = getComputedStyle(clear);
              const svg = clear.querySelector("svg");
              return {
                samples,
                composerFontSize: inputStyle.fontSize,
                clearName: clear.getAttribute("aria-label"),
                clearDisplayed: buttonStyle.display !== "none",
                clearPaths: svg?.querySelectorAll("path").length ?? 0,
                clearRects: svg?.querySelectorAll("rect").length ?? 0,
                clearSize: Math.round(clear.getBoundingClientRect().width),
                clearKeyboardFocusable: clear.tabIndex >= 0
              };
            });
            const phone = viewport.width <= 700;
            const readingSize = phone ? "17px" : "18px";
            const readingLine = phone ? "25.5px" : "27px";
            for (const name of ["learner", "answer", "paragraph", "listItem", "lesson", "h3", "h4"]) {
              assert.equal(reading.samples[name].fontSize, readingSize, `#175 responsive ${skin} ${viewport.name} ${name} reading scale`);
            }
            for (const name of ["learner", "answer", "paragraph", "listItem", "lesson"]) {
              assert.equal(reading.samples[name].lineHeight, readingLine, `#175 responsive ${skin} ${viewport.name} ${name} 1.5 leading`);
              assert.equal(reading.samples[name].fontWeight, "400", `#175 ${skin} ${viewport.name} ${name} must have normal reading weight`);
            }
            for (const [name, size] of Object.entries({
              kicker: phone ? "13px" : "14px",
              h1: phone ? "24px" : "26px",
              h2: phone ? "20px" : "22px"
            })) {
              assert.equal(reading.samples[name].fontSize, size, `#175 responsive ${skin} ${viewport.name} ${name} scale`);
            }
            assert.equal(reading.composerFontSize, readingSize, "#175 Coach/Learn composer must match reading text");
            assert.equal(reading.clearName, "Clear Coach chat", "#174 must retain the accessible Clear control");
            assert.ok(reading.clearPaths >= 4 && reading.clearRects === 0, "#174 must use the bin glyph, not the old eraser");
            assert.equal(reading.clearDisplayed, true, "#174 clear bin must appear on phone, tablet and desktop");
            assert.equal(reading.clearSize, phone ? 30 : 44, "#174 clear bin must match compact/mobile or wide tap-target scale");
            assert.equal(reading.clearKeyboardFocusable, true, "#174 clear action must stay keyboard-accessible");
            // With the bin in the composer, the old desktop Clear text button
            // must not produce two identical destructive actions.
            const oldClear = page.locator('.coachChat .lessonActions > button[aria-label^="Clear "]');
            assert.equal(await oldClear.count(), 1, "historical Clear action should still exist for the legacy contract");
            assert.equal(await oldClear.isVisible(), false, "avoid duplicated clear actions in both Coach and Learn layouts");
            // PR #172: desktop and tablet reuse the actual phone arrows.
            // Phone visual affordances stay 30px with a 44px pseudo hitbox;
            // tablet/desktop render physical 44px accessories outside the
            // tuck/zoom region, with only one Previous/Next action pair.
            const headerLayout = viewport.width >= 1101;
            const navigation = page.locator(headerLayout
              ? ".modeFrame > .coachHeaderNav"
              : ".mhChipBar > .coachLowerNav");
            const otherNavigation = page.locator(headerLayout
              ? ".mhChipBar > .coachLowerNav"
              : ".modeFrame > .coachHeaderNav");
            assert.equal(await otherNavigation.isVisible(), false,
              "only the active responsive navigation may be displayed");
            assert.equal(await navigation.isVisible(), true, "#172 navigation must be visible in all responsive shells");
            const navScale = await navigation.evaluate((element) => {
              const steps = [...element.querySelectorAll(".coachNavStep")];
              const styleButton = element.querySelector(".coachActiveStyle");
              if (steps.length !== 2 || !(styleButton instanceof HTMLElement)) {
                throw new Error("Expected previous/next chevrons and coaching style pill");
              }
              return {
                width: element.getBoundingClientRect().width,
                trackHeight: Math.round(element.getBoundingClientRect().height),
                buttonWidths: steps.map(step => Math.round(step.getBoundingClientRect().width)),
                buttonHeights: steps.map(step => Math.round(step.getBoundingClientRect().height)),
                arrowSizes: steps.map(step => Math.round(step.querySelector("svg")?.getBoundingClientRect().width ?? 0)),
                labels: steps.map(step => step.getAttribute("aria-label")),
                hitInsets: steps.map(step => getComputedStyle(step, "::before").left),
                styleHeight: Math.round(styleButton.getBoundingClientRect().height),
                duplicateVisible: [...document.querySelectorAll(".coachChat .lessonActions button")].filter(el => el.getClientRects().length > 0).length
              };
            });
            assert.deepEqual(navScale.buttonWidths, [phone ? 30 : 44, phone ? 30 : 44], "#172 arrows must use responsive 30/44px widths");
            assert.deepEqual(navScale.buttonHeights, [phone ? 30 : 44, phone ? 30 : 44], "#172 arrows must use responsive 30/44px heights");
            assert.deepEqual(navScale.arrowSizes, [phone ? 16 : 20, phone ? 16 : 20], "#172 arrow glyphs must scale with viewport");
            assert.deepEqual(navScale.labels, ["Previous topic", "Next topic"], "#172 accessible previous/next navigation preserved");
            assert.equal(navScale.trackHeight, phone ? 36 : headerLayout ? 44 : 52, "#172 navigation must fit its phone, tablet or wide-header lane");
            assert.equal(navScale.styleHeight, phone ? 30 : 44, "#172 mode pill must match its chevrons");
            if (phone) assert.deepEqual(navScale.hitInsets, ["-7px", "-7px"], "#172 phone chevrons require 44px extended hitboxes");
            else assert.equal(navScale.duplicateVisible, 0, "#172 desktop must not duplicate Previous/Next beneath the chat");
            const roomChrome = await page.evaluate(() => {
              const visible = el => el instanceof HTMLElement &&
                getComputedStyle(el).display !== "none" &&
                el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
              const modes = document.querySelector(".modeHead .chatModes");
              const headerTabs = document.querySelector(".modeHead .mhChipRow .coachTabs");
              const toolbarTabs = document.querySelector(".mhChipBar > .coachTabs");
              const duplicateStyle = document.querySelector(".coachChat > .coachActiveStyle");
              const overlaps = visible(modes) && visible(headerTabs) && (() => {
                const a = modes.getBoundingClientRect(), b = headerTabs.getBoundingClientRect();
                return a.left < b.right && a.right > b.left &&
                  a.top < b.bottom && a.bottom > b.top;
              })();
              return {
                headerTabsVisible: visible(headerTabs),
                toolbarTabsVisible: visible(toolbarTabs),
                duplicatedStyleVisible: visible(duplicateStyle),
                headerOverlap: overlaps,
              };
            });
            assert.equal(roomChrome.headerOverlap, false, "Coach/Learn switch must not overlap the Chat/Topics control");
            assert.equal(Number(roomChrome.headerTabsVisible) + Number(roomChrome.toolbarTabsVisible), 1,
              "Chat/Topics must appear exactly once across phone, tablet and desktop");
            assert.equal(roomChrome.duplicatedStyleVisible, false, "Coaching style pill must not duplicate its accessory rail counterpart");
            if (!phone && viewport.width <= 980) {
              assert.equal(roomChrome.toolbarTabsVisible, true, "tablet Chat/Topics should move into the accessory rail");
            }
            entry.coachChrome = roomChrome;
            if (headerLayout) {
              // The wide controls must be inside the green-marked whitespace
              // of the header itself, above the Studigo rail. They must not
              // enlarge the strip or shrink with Coach's 60% tuck.
              const headerPlacement = await page.evaluate(() => {
                const frame = document.querySelector(".modeFrame");
                const nav = frame?.querySelector(":scope > .coachHeaderNav");
                const rail = frame?.querySelector(".studigoRail");
                const modes = frame?.querySelector(".modeHead .chatModes");
                const tabs = frame?.querySelector(".modeHead .mhChipRow .coachTabs");
                if (!(frame instanceof HTMLElement) || !(nav instanceof HTMLElement) ||
                    !(rail instanceof HTMLElement) || !(modes instanceof HTMLElement)) {
                  throw new Error("Wide Coach header navigation landmarks missing");
                }
                const navRect = nav.getBoundingClientRect();
                const railRect = rail.getBoundingClientRect();
                const modesRect = modes.getBoundingClientRect();
                const tabsRect = tabs?.getBoundingClientRect();
                return {
                  navTop: navRect.top,
                  navBottom: navRect.bottom,
                  railTop: railRect.top,
                  navLeft: navRect.left,
                  modesRight: modesRect.right,
                  navRight: navRect.right,
                  tabsLeft: tabsRect?.left ?? Infinity,
                  navHeight: Math.round(navRect.height)
                };
              });
              assert.ok(headerPlacement.navBottom <= headerPlacement.railTop + 1,
                "desktop navigation must sit above—not below—the orange Studigo rail");
              assert.ok(headerPlacement.navLeft >= headerPlacement.modesRight + 6,
                "desktop navigation must occupy the free space right of Coach/Learn");
              assert.ok(headerPlacement.navRight <= headerPlacement.tabsLeft - 6,
                "desktop navigation must not overlap Chat/Topics");
              assert.equal(headerPlacement.navHeight, 44,
                "desktop navigator must stay 44px tall within the header");
              const tucked = await page.locator(".modeFrame").evaluate(frame => {
                const before = frame.getAttribute("data-compact");
                frame.setAttribute("data-compact", "true");
                const nav = frame.querySelector(":scope > .coachHeaderNav");
                const rail = frame.querySelector(".studigoRail");
                const rect = nav?.getBoundingClientRect();
                const railRect = rail?.getBoundingClientRect();
                if (before === null) frame.removeAttribute("data-compact");
                else frame.setAttribute("data-compact", before);
                return {height: Math.round(rect?.height ?? 0), railOverlap: (rect?.bottom ?? Infinity) - (railRect?.top ?? -Infinity)};
              });
              assert.equal(tucked.height, 44, "Coach's header tuck must not scale down navigation targets");
              assert.ok(tucked.railOverlap <= 1,
                "tucked Coach navigation must stay above the orange rail");
              entry.coachHeaderPlacement = headerPlacement;
            }
            entry.coachNavigation = navScale;
            entry.coachReading = reading;
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
    // Guided Learn is intentionally paused for signed-in rooms. Capture its
    // review-only fixture without activating any authenticated mission.
    const missionCase = { viewport: viewport.name, url: `${origin}/dev/study?shell=1&ui=phase3&mode=learn&learn=mission`, screenshot: "", error: null };
    try {
      const res = await page.goto(missionCase.url, { waitUntil: "networkidle", timeout: 90_000 });
      assert.equal(res?.status(), 200);
      const start = page.getByRole("button", { name: /Start learning/ });
      await start.waitFor();
      const mission = page.locator(".learnInvitation");
      await mission.waitFor();
      missionCase.screenshot = path.join(output, `${viewport.name}-guided-learn-invitation-phase3.png`);
      await page.screenshot({ path: missionCase.screenshot, animations: "disabled" });
      assert.equal(await mission.getByRole("heading").count(), 1);
      await start.click();
      await page.locator(".learnLessonLabel").waitFor();
      await page.locator(".learnAsk").waitFor();
      missionCase.activeScreenshot = path.join(output, `${viewport.name}-guided-learn-first-step-phase3.png`);
      await page.screenshot({ path: missionCase.activeScreenshot, animations: "disabled" });
      await page.locator(".learnGo").click();
      await page.locator(".learnChoices .learnChoice").first().waitFor();
      const firstQuestion = await page.locator(".learnAsk").innerText();
      assert.ok(firstQuestion.includes("?"), "The first guided activity must ask an explicit question");
      assert.doesNotMatch(firstQuestion, /^which one is it\??$/i,
        "Guided Learn cannot present the old generic question");
      await page.locator(".learnChoices .learnChoice").first().scrollIntoViewIfNeeded();
      const visibleChoice = await page.locator(".learnChoices .learnChoice").first().evaluate(el => {
        const rect = el.getBoundingClientRect();
        const dock = document.querySelector(".learnGo")?.getBoundingClientRect();
        const box = el.closest(".learnChoices")?.getBoundingClientRect();
        return { height: rect.height, boxHeight: box?.height ?? 0,
          insideViewport: rect.top >= 0 && rect.bottom < innerHeight,
          aboveAction: !dock || rect.bottom <= dock.top };
      });
      assert.ok(visibleChoice.height >= 44 && visibleChoice.boxHeight >= 44 &&
        visibleChoice.insideViewport && visibleChoice.aboveAction,
        "Lesson choices must visibly fit above the action dock, not collapse below the desktop stage");
      missionCase.choiceVisible = visibleChoice;
      const arrangement = await page.evaluate(() => {
        const region = document.querySelector(".learnReading");
        const stage = region?.querySelector(".learnTalk");
        const dock = region?.querySelector(".learnActionDock");
        if (!(region instanceof HTMLElement) || !(stage instanceof HTMLElement) ||
            !(dock instanceof HTMLElement)) throw new Error("Guided Learn canvas or single action dock missing");
        const bounds = dock.getBoundingClientRect();
        const actions = [...dock.querySelectorAll("button")].filter(button => button.getBoundingClientRect().width > 0)
          .map(button => {
            const r = button.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, centerY: r.y + r.height / 2,
              label: button.getAttribute("aria-label") || button.textContent?.trim() };
          });
        const lesson = stage.getBoundingClientRect();
        const container = region.getBoundingClientRect();
        return { actions, dockTop: bounds.top, dockBottom: bounds.bottom,
          dockWidth: dock.clientWidth, dockScrollWidth: dock.scrollWidth,
          lessonHeight: lesson.height, containerHeight: container.height,
          stageBelowProgress: lesson.top > region.querySelector(".learnBar").getBoundingClientRect().top,
          stageAboveDock: lesson.bottom <= bounds.top + 1 };
      });
      assert.equal(arrangement.actions.length, 5, "Back, Pause, Find it, Hint and Check must share one action dock");
      assert.ok(arrangement.actions.every(a => a.width >= 43 && a.height >= 43),
        "Every lesson action must retain an accessible physical target");
      assert.ok(arrangement.actions.every(a => Math.abs(a.centerY - arrangement.actions[0].centerY) <= 2),
        "All lesson buttons must be aligned on a single horizontal line");
      assert.ok(arrangement.actions.every((a,i) => i === 0 || a.x >= arrangement.actions[i-1].x + arrangement.actions[i-1].width - 2),
        "Lesson buttons must not overlap each other");
      assert.ok(arrangement.dockScrollWidth <= arrangement.dockWidth + 2,
        "Lesson action dock must fit without hidden horizontal scrolling");
      assert.ok(arrangement.stageBelowProgress && arrangement.stageAboveDock,
        "Instructional canvas must stay between progress and toolbar");
      assert.ok(arrangement.lessonHeight >= (viewport.width <= 700 ? 130 : 220),
        "Instructional canvas must occupy meaningful space rather than collapse");
      missionCase.arrangement = arrangement;
      missionCase.actionScreenshot = path.join(output, `${viewport.name}-guided-learn-choose-phase3.png`);
      await page.screenshot({ path: missionCase.actionScreenshot, animations: "disabled" });
      await page.getByRole("button", { name: "Pause lesson", exact: true }).click();
      await page.getByRole("button", { name: /Continue lesson/ }).waitFor();
      missionCase.pausedScreenshot = path.join(output, `${viewport.name}-guided-learn-paused-phase3.png`);
      await page.screenshot({ path: missionCase.pausedScreenshot, animations: "disabled" });
      await page.getByRole("button", { name: /Continue lesson/ }).click();
      await page.locator(".learnChoices .learnChoice").first().waitFor();
      assert.equal(await page.locator(".learnLessonLabel").count(), 1, "Resume must return to selected concept");
      missionCase.pausedResumeFixture = true;
      const findIt = page.getByRole("button", { name: "Find it in my guide" });
      await findIt.click();
      const sourceSheet = page.locator(".learnSourceDialog[open]");
      await sourceSheet.waitFor();
      assert.ok(await sourceSheet.evaluate(el => el.matches(":modal")), "source spotlight must use native modal focus boundary");
      assert.ok(await sourceSheet.getByText("The legislative branch makes laws", { exact: false }).isVisible());
      if (viewport.width > 700) {
        const sourceHeight = await sourceSheet.evaluate(el => el.getBoundingClientRect().height);
        assert.ok(sourceHeight >= 440, "Wide source inspector should be a substantial reader, not a short popup");
        missionCase.sourceHeight = sourceHeight;
      }
      missionCase.sourceScreenshot = path.join(output, `${viewport.name}-guided-learn-source-phase3.png`);
      await page.screenshot({ path: missionCase.sourceScreenshot, animations: "disabled" });
      // A long real OCR extraction must remain within the source viewport.
      const clip = await sourceSheet.evaluate(dialog => {
        const quote = dialog.querySelector(".learnSourceQuote");
        const original = dialog.querySelector(".learnSourceOriginal");
        const back = dialog.querySelector(".ghostButton");
        if (!quote || !back) throw new Error("Source dialog missing quote or exit");
        const initialContent = quote.textContent;
        quote.textContent = Array.from({length: 70}, () => initialContent).join("\n");
        const rect = dialog.getBoundingClientRect();
        const quoteBox = quote.getBoundingClientRect();
        const exitBox = back.getBoundingClientRect();
        const documentHeight = quote.scrollHeight;
        const viewportHeight = quote.clientHeight;
        quote.textContent = initialContent;
        return {
          trulyScrollable: documentHeight > viewportHeight + 100,
          scrollableExcerpt: getComputedStyle(quote).overflowY === "auto",
          quoteInside: quoteBox.top >= rect.top && quoteBox.bottom <= exitBox.top + 1,
          exitInside: exitBox.bottom <= rect.bottom + 1,
          sourceHeight: documentHeight,
          originalInside: !original || original.getBoundingClientRect().bottom <= exitBox.top
        };
      });
      assert.ok(clip.trulyScrollable && clip.scrollableExcerpt && clip.quoteInside && clip.exitInside && clip.originalInside,
        "Source excerpt must scroll internally without overlapping Open original or Back to lesson");
      missionCase.sourceClip = clip;
      await sourceSheet.getByRole("button", { name: "Back to lesson" }).click();
      await sourceSheet.waitFor({ state: "hidden" });
      assert.ok(await findIt.evaluate(el => document.activeElement === el), "spotlight must return keyboard focus to Find it");
      const hint = page.getByRole("button", { name: "Give me a hint" });
      await hint.click();
      assert.ok(await page.locator(".learnAnswerFeedback[data-outcome=\"assisted\"]").getByText(/guided answer, not independent mastery/).isVisible());
      missionCase.hintScreenshot = path.join(output, `${viewport.name}-guided-learn-hint-phase3.png`);
      await page.screenshot({ path: missionCase.hintScreenshot, animations: "disabled" });
      const hear = page.getByRole("button", { name: "Read to me", exact: true });
      assert.ok(await hear.first().isVisible(), "Read aloud must be learner-initiated and visible");
      const mic = page.getByRole("button", { name: "Speak a draft answer" }).first();
      await mic.click();
      const transcriptDialog = page.locator("dialog.voiceAnswerReview[open]");
      await transcriptDialog.waitFor();
      assert.ok(await transcriptDialog.evaluate(el => el.matches(":modal")),
        "Voice transcript review must be in the native modal top layer, outside scrolling lesson clipping");
      const record = page.getByRole("button", { name: "Start speaking" }).first();
      assert.equal(await record.isDisabled(), true, "No microphone request without explicit acknowledgement");
      assert.ok(await page.getByText(/browser's speech service may process audio/).first().isVisible());
      missionCase.voiceScreenshot = path.join(output, `${viewport.name}-guided-learn-voice-consent-phase3.png`);
      await page.screenshot({ path: missionCase.voiceScreenshot, animations: "disabled" });
      await transcriptDialog.getByRole("button", { name: "Close", exact: true }).click();
      await transcriptDialog.waitFor({ state: "detached" });
      assert.ok(await mic.evaluate(el => document.activeElement === el),
        "Closing transcript review must restore microphone trigger keyboard focus");
      missionCase.voiceConsentPreview = true;
      // Complete a fixture mission through explicit formative actions.
      // This must not call a real grading endpoint or claim learner mastery.
      await page.locator(".learnGo").click(); // hinted choice -> try
      await page.locator(".learnWords .learnWord").first().waitFor();
      await page.locator(".learnWords .learnWord").first().click();
      await page.locator(".learnGo").click(); // Check word choice
      await page.locator(".learnGo").click(); // Continue -> source evidence
      await page.locator(".learnChoices .learnChoice").first().waitFor();
      await page.locator(".learnChoices .learnChoice").first().click();
      await page.locator(".learnGo").click(); // Check evidence
      const feedback = page.locator(".learnAnswerFeedback");
      await feedback.waitFor();
      assert.ok(await feedback.getByRole("strong").count() === 0 || await feedback.locator("strong").count() === 1);
      const feedbackText = await feedback.innerText();
      assert.match(feedbackText, /Correct|Not quite|Here's some help/);
      assert.ok(await page.getByRole("button", { name: /Finish lesson|Next activity/ }).isVisible(),
        "After feedback the next action must be named, never another ambiguous Continue");
      await page.locator(".learnGo").click(); // Continue -> done
      const end = page.locator(".learnHandoff");
      await end.waitFor();
      assert.ok(await end.getByText(/NO MASTERY AWARDED/).isVisible());
      missionCase.completedScreenshot = path.join(output, `${viewport.name}-guided-learn-handoff-phase3.png`);
      await page.screenshot({ path: missionCase.completedScreenshot, animations: "disabled" });
      await end.getByRole("button", { name: "Practice independently" }).click();
      await page.locator(".quizSetup").waitFor();
      assert.ok(await page.getByRole("button", { name: "Start quiz" }).isVisible(), "Practice handoff must reach existing quiz setup, not silently start a graded attempt");
      missionCase.practiceHandoff = true;
      await page.goto(`${origin}/dev/study?shell=1&ui=phase3&mode=materials`, { waitUntil: "networkidle" });
      const original = page.locator(".documentRow").first();
      assert.equal(await original.getByRole("link", { name: /View original file/ }).count(), 1);
      assert.equal(await original.getByRole("link", { name: /Download original file/ }).count(), 1);
      assert.equal(await original.getByRole("link", { name: /Open original PDF .* to print/ }).count(), 1);
      missionCase.originalScreenshot = path.join(output, `${viewport.name}-guided-learn-original-recovery-phase3.png`);
      await page.screenshot({ path: missionCase.originalScreenshot, animations: "disabled" });



      missionCase.overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      assert.ok(missionCase.overflow <= 2, "Guided Learn fixture must not overflow");
    } catch (error) {
      missionCase.error = String(error);
      report.failures.push({ ...missionCase });
      console.error(`${viewport.name} Guided Learn: ${missionCase.error}`);
    }
    report.guidedLearn.push(missionCase);
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

    // Explore is an explicit synthetic fixture, not an authenticated learner
    // or authorization test. Keep the legacy mission screenshots unchanged.
    for (const skin of skins) {
      const exploreCase = { viewport: viewport.name, skin, screenshot: "", horizontalOverflow: null, error: null };
      try {
        await page.goto(`${origin}/dev/study?shell=1&learn=explore&ui=${skin}`, { waitUntil: "networkidle" });
        await page.getByRole("heading", { name: "Quest journal" }).waitFor();
        assert.equal(await page.locator(".exploreJournalQuest").count(), 8, "journal must use all and only real fixture topics");
        assert.equal(await page.locator('.exploreJournalQuest[aria-pressed="true"]').count(), 1, "one quest detail selection");
        await page.locator(".exploreJournalQuest").nth(1).click();
        const selectedHeading = viewport.width <= 700 ? ".exploreJournalQuickStart h3" : ".exploreJournalDetail h3";
        assert.match(await page.locator(selectedHeading).innerText(), /Inherited traits and environment/);
        if (viewport.width <= 700) {
          const action = page.getByRole("button", { name: /Start quest/ });
          const firstViewport = await action.boundingBox();
          assert.ok(firstViewport && firstViewport.y < viewport.height, "selected quest must remain reachable on phone");
        }
        // Selection can scroll a short phone list; capture from the journal's
        // actual top, not with sticky room chrome frozen halfway through a full-page shot.
        await page.locator(".exploreJournalHead").scrollIntoViewIfNeeded();
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          for (const selector of [".appMain", ".coachMode", ".chatThread"]) {
            const node = document.querySelector(selector);
            if (node instanceof HTMLElement) node.scrollTop = 0;
          }
        });
        const screenshot = `${viewport.name}-explore-${skin}.png`;
        await page.screenshot({ path: path.join(output, screenshot), animations: "disabled", fullPage: true });
        exploreCase.screenshot = screenshot;
        exploreCase.horizontalOverflow = await page.evaluate(() =>
          Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        assert.equal(exploreCase.horizontalOverflow, 0, "Explore must not overflow the viewport");
        await page.getByRole("button", { name: /Start quest/ }).click();
        await page.getByRole("button", { name: /Quest journal/ }).click();
        await page.getByRole("heading", { name: "Quest journal" }).waitFor();
        await page.getByRole("button", { name: "Original Learn", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Original Learn", exact: true }).getAttribute("aria-pressed"), "true");
        await page.getByRole("button", { name: "Explore", exact: true }).click();
        await page.getByRole("heading", { name: "Quest journal" }).waitFor();
      } catch (error) {
        exploreCase.error = String(error);
        report.failures.push({ ...exploreCase });
        console.error(`${viewport.name} Explore ${skin}: ${exploreCase.error}`);
      }
      report.explore.push(exploreCase);
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
console.log(`Phase 3 synthetic comparison: ${report.cases.length} room cases, ${report.interactions.length} interaction groups, ${report.home.length} Home cases, ${report.explore.length} Explore cases, ${report.failures.length} failures`);
if (report.failures.length) {
  for (const failure of report.failures) console.error(`${failure.viewport} ${failure.mode} ${failure.skin}: ${failure.error}`);
  process.exitCode = 1;
}
