import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Synthetic fixture only. No signed-in learner data, billing, or state writes.
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const output = "artifacts/phase3-visual/desktop-drawer";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {})
});
const cases = [];
try {
  for (const [width, height, mode] of [
    [820, 700, "materials"], [1440, 900, "coach"],
    [1440, 720, "plan"], [820, 900, "mastery"]
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference" });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      const response = await page.goto(`${origin}/dev/study?shell=1&mode=${mode}&ui=phase3`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      // Moving away also guards against accidentally hovering a drawer control.
      await page.mouse.move(1, 1);
      const frame = page.locator(".modeFrame").first();
      const strip = frame.locator(".modeStrip");
      const toggle = frame.locator(".modeCollapseToggle");
      assert.equal(await frame.getAttribute("data-collapsed"), "false", "new desktop page begins expanded");
      assert.equal(await toggle.count(), 0, "there is no Hide controls button, nor a Show controls button while expanded");
      assert.equal(await frame.getByRole("button", { name: "Hide controls" }).count(), 0);
      await page.waitForFunction(
        () => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true",
        undefined, { timeout: 6500 }
      );
      await page.waitForTimeout(860);
      assert.equal(await toggle.count(), 1, "Show controls is created only after the drawer closes");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await strip.getAttribute("inert"), "", "closed drawer controls are removed from keyboard navigation");
      assert.equal(await strip.getAttribute("aria-hidden"), "true");
      const closedHeight = await frame.evaluate(el => el.getBoundingClientRect().height);
      const colors = await toggle.evaluate(el => ({
        border: getComputedStyle(el).borderLeftColor,
        divider: getComputedStyle(el.closest(".modeFrame").querySelector(".studigoRail")).backgroundColor
      }));
      assert.equal(colors.border, colors.divider, "Show controls border matches the page-specific divider");
      const tab = await toggle.evaluate(el => {
        const box = el.getBoundingClientRect();
        const rail = el.closest(".modeFrame").querySelector(".studigoRail").getBoundingClientRect();
        const style = getComputedStyle(el);
        const led = el.querySelector(".modeTabLed");
        return {
          tabLeft: box.left, tabTop: box.top, tabWidth: box.width,
          railLeft: rail.left, railRight: rail.right, railBottom: rail.bottom,
          fill: style.backgroundColor, border: style.borderLeftColor,
          radius: style.borderBottomLeftRadius,
          ledColor: getComputedStyle(led).backgroundColor,
          ledGlow: getComputedStyle(led).boxShadow,
          chevrons: el.querySelectorAll(".modeTabChevron path").length
        };
      });
      assert.ok(tab.tabLeft >= tab.railLeft && tab.tabLeft - tab.railLeft <= 45, "drawer handle anchors to the left of the divider");
      assert.ok(tab.tabLeft + tab.tabWidth < tab.railRight, "drawer handle stays within divider width");
      assert.ok(Math.abs(tab.tabTop - tab.railBottom) <= 4, "handle attaches flush beneath divider without floating gap");
      assert.equal(tab.fill, tab.border, "handle uses the same saturated color as the divider border");
      assert.equal(tab.ledColor, "rgb(255, 255, 255)", "handle includes companion-style white status LED");
      assert.match(tab.ledGlow, /rgb\(255, 255, 255\)/, "status LED glows white");
      assert.equal(tab.chevrons, 1, "handle includes a drawn direction arrow");
      assert.equal(tab.radius, "12px", "handle rounds outward like companion's tab");
      assert.equal(await toggle.getAttribute("aria-label"), "Show controls");
      const tabMotion = await toggle.evaluate(el => ({
        animation: getComputedStyle(el).animationName,
        delay: getComputedStyle(el).animationDelay
      }));
      assert.equal(tabMotion.animation, "modeDrawerTabDown", "closed tab slides down from divider");
      assert.equal(tabMotion.delay, "0.28s", "Show controls begins after the drawer starts retracting");
      assert.equal(await strip.locator(".modeStripInner").evaluate(el => getComputedStyle(el).animationName), "modeDrawerIn");
      await page.screenshot({ path: `${output}/${width}-${mode}-closed.png`, animations: "disabled" });
      await toggle.click();
      assert.equal(await frame.getAttribute("data-collapsed"), "false");
      assert.equal(await strip.getAttribute("inert"), null);
      assert.equal(await toggle.count(), 0, "Show controls unmounts when the drawer opens; no Hide controls replacement");
      assert.equal(await frame.getByRole("button", { name: "Hide controls" }).count(), 0);
      assert.equal(await strip.locator(".modeStripInner").evaluate(el => getComputedStyle(el).animationName), "modeDrawerOut");
      await page.waitForTimeout(700);
      const openHeight = await frame.evaluate(el => el.getBoundingClientRect().height);
      assert.ok(openHeight > closedHeight + 25, `drawer gives content real vertical space: ${JSON.stringify({width,mode,closedHeight,openHeight})}`);
      await page.screenshot({ path: `${output}/${width}-${mode}-open.png`, animations: "disabled" });
      const fit = await page.evaluate(() => ({
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        deviceBottom: document.querySelector(".roomDevice")?.getBoundingClientRect().bottom,
        roomBottom: document.querySelector(".roomWorkspace")?.getBoundingClientRect().bottom
      }));
      assert.equal(fit.horizontalOverflow, 0, "drawer does not add horizontal overflow");
      assert.ok((fit.deviceBottom ?? Infinity) <= height + 2, "room remains inside viewport");
      assert.ok((fit.roomBottom ?? Infinity) <= height + 2, "room shell remains inside viewport");
      assert.deepEqual(errors, [], "no browser exceptions");
      cases.push({ width, height, mode, openHeight, closedHeight, dividerColor: colors.divider });
    } finally { await context.close(); }
  }

  // Inactivity and keyboard interaction are different: focus pauses the
  // countdown; when focus leaves the drawer, the three-second timer restarts.
  const focusContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await focusContext.newPage();
    await page.goto(`${origin}/dev/study?shell=1&mode=coach&ui=phase3`, { waitUntil: "networkidle" });
    const frame = page.locator(".modeFrame").first();
    await frame.locator(".modeStrip button").first().focus();
    await page.waitForTimeout(3300);
    assert.equal(await frame.getAttribute("data-collapsed"), "false", "keyboard focus keeps controls accessible");
    await page.locator(".chatComposer input").first().focus();
    await page.waitForFunction(
      () => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true",
      undefined, { timeout: 4800 }
    );
  } finally { await focusContext.close(); }

  // Pointer-driven navigation stays open while hovered. Leaving the header
  // starts the idle countdown (Coach/Learn and Practice pages).
  for (const [initialMode, selector, destination] of [
    ["coach", '.modeHead .chatModes button[data-tone="ask"]', "learn"],
    ["quiz", '.modeHead .chatModes button[data-tone="cards"]', "cards"],
    ["quiz", '.modeHead .chatModes button[data-tone="test"]', "test"],
    ["mastery", '.modeHead .chatModes button[data-tone="weak"]', "weak"]
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}/dev/study?shell=1&mode=${initialMode}&ui=phase3`, { waitUntil: "networkidle" });
      const frame = page.locator(".modeFrame").first();
      await page.locator(selector).click();
      assert.equal(await frame.getAttribute("data-collapsed"), "false", "selected subpage initially exposes its controls");
      await page.waitForTimeout(3300);
      assert.equal(await frame.getAttribute("data-collapsed"), "false", "hover keeps navigation open");
      await page.mouse.move(1, 1);
      await page.waitForFunction(
        () => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true",
        undefined, { timeout: 6500 }
      );
      assert.equal(await frame.getByRole("button", { name: "Show controls" }).count(), 1,
        `${initialMode}  ${destination}: pointer navigation must auto-collapse after three seconds`);
      cases.push({ initialMode, destination, autoCollapsed: true });
    } finally { await context.close(); }
  }

  // A dense Progress panel can temporarily leave no collision-safe corner.
  // In that case the edge summon tab must remain reachable after auto-collapse.
  // This test covers the real companion engine, not a mocked call-out action.
  const companionContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await companionContext.newPage();
    await page.goto(`${origin}/dev/study?shell=1&mode=mastery&ui=phase3`, { waitUntil: "networkidle" });
    const companionTab = page.getByRole("button", { name: "Bring Studigo back out" });
    const frame = page.locator(".modeFrame").first();
    await page.waitForFunction(
      () => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true",
      undefined, { timeout: 6500 }
    );
    // Simulate a source-backed dense dashboard that occupies every safe corner.
    await page.evaluate(() => {
      const surface = document.querySelector(".modeSurface");
      if (!surface) throw new Error("Progress fixture has no study surface");
      const block = document.createElement("button");
      block.id = "qa-dense-progress";
      block.type = "button";
      block.setAttribute("aria-label", "Synthetic occupied progress space");
      block.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;opacity:0;pointer-events:none;";
      surface.appendChild(block);
    });
    await companionTab.waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.locator(".cmp").getAttribute("inert"), "", "safety seating hides the floating companion");
    await companionTab.click();
    await page.waitForFunction(() => {
      const companion = document.querySelector(".cmp");
      return companion && !companion.hidden && !companion.inert && companion.getAttribute("data-state") === "window";
    }, undefined, { timeout: 3500 });
    assert.equal(await companionTab.isVisible(), false, "explicit summon restores the actual Studigo window");
    // The room never carries a forced override into a different section.
    await page.locator(".topbarNav button[aria-label='Coach']").click();
    await page.waitForFunction(() => document.querySelector(".roomWorkspace")?.getAttribute("data-tone") === "coach");
    assert.deepEqual(await page.locator(".cmpHost").count(), 1);
    cases.push({ area: "Progress", autoSeated: true, summoned: true, switchedSafely: true });
  } finally { await companionContext.close(); }

  // No drawer motion is imposed on phones or users requesting reduced motion.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/dev/study?shell=1&mode=coach&ui=phase3`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3300);
    assert.equal(await page.locator(".modeFrame").first().getAttribute("data-collapsed"), "false", "mobile does not auto-collapse");
    assert.equal(await page.locator(".modeCollapseToggle").count(), 0, "mobile has no drawer button");
    await page.setViewportSize({ width: 820, height: 700 });
    await page.waitForFunction(
      () => document.querySelector(".modeFrame")?.getAttribute("data-collapsed") === "true",
      undefined, { timeout: 6500 }
    );
    assert.equal(
      await page.locator(".modeStripInner").first().evaluate(el => getComputedStyle(el).animationName),
      "none", "reduced-motion setting suppresses the drawer bounce"
    );
    await page.setViewportSize({ width: 320, height: 700 });
    assert.equal(await page.locator(".modeFrame").first().getAttribute("data-collapsed"), "false", "phone size restores full header");
    assert.equal(await page.locator(".modeCollapseToggle").count(), 0);
  } finally { await context.close(); }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ cases, provenance: "Synthetic local fixture only" }, null, 2));
  await browser.close();
}
console.log(`Desktop drawer: ${cases.length} open/closed screenshot pairs, 3-second inactivity, page color, focus, and phone checks passed.`);
