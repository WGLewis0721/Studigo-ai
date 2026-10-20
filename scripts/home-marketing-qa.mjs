import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const widths = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 }
];

// The public demo has no signed-in shell; verify that every page header begins
// immediately below the Study Room toolbar (not just the Explore header).
async function readModeTopGap(page, iframeId) {
  return page.frameLocator(iframeId).locator(".roomWorkspace").evaluate(root => {
    const top = root.querySelector(".workspaceTopbar")?.getBoundingClientRect();
    const modeHeader = root.querySelector(".modeFrame .modeHead")?.getBoundingClientRect();
    const spacer = root.querySelector(".studyNavigation")?.getBoundingClientRect();
    return {
      gap: top && modeHeader ? Math.round(modeHeader.top - top.bottom) : null,
      spacerHeight: spacer ? Math.round(spacer.height) : null,
      width: window.innerWidth
    };
  });
}
function assertModeTopGap(geometry, where) {
  assert.ok(geometry.gap !== null && geometry.spacerHeight !== null,
    `${where} must contain a topbar, mode header and navigation spacer`);
  if (geometry.width <= 700) {
    assert.ok(geometry.spacerHeight <= 4,
      `${where} retains the mobile navigation spacer: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.gap >= -4 && geometry.gap <= 22,
      `${where} has an empty band above its mode tabs: ${JSON.stringify(geometry)}`);
  }
}
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of widths) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("studigo.intro", "1"));
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    const reply = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(reply?.status(), 200, "Homepage must render");
    assert.equal(await page.locator(".heroWordmark").count(), 1);
    assert.equal(await page.locator(".nav .brandWordmark").count(), 0);
    assert.equal(await page.locator("#homePhone").getAttribute("src"), "/demo/room?mode=learn");
    await page.frameLocator("#homePhone").locator(".exploreJournalQuest").first().waitFor({ timeout: 30000 });
    assert.equal(await page.frameLocator("#homePhone").locator(".exploreJournalQuest").count(), 8,
      "Hero phone must mount the actual eight-quest ExploreJournal fixture");
    assertModeTopGap(await readModeTopGap(page, "#homePhone"), "Hero iPhone Learn");
    // Regression #242: replacing the original iPhone with an iframe must not
    // remove its hardware cues, separate the copy from the device, or leak
    // the yellow synthetic-fixture notice into the marketing screenshot.
    const hardware = await page.evaluate(() => {
      const frame = document.querySelector("#homePhoneFrame");
      const copy = document.querySelector(".heroCopy");
      const status = frame?.querySelector(".phoneStatus");
      const island = frame?.querySelector(".phoneIsland");
      const homeBar = frame?.querySelector(".phoneHomeBar");
      const rect = frame?.getBoundingClientRect();
      return {
        statusHeight: status?.getBoundingClientRect().height ?? 0,
        islandWidth: island?.getBoundingClientRect().width ?? 0,
        homeBarWidth: homeBar?.getBoundingClientRect().width ?? 0,
        bezel: frame ? parseFloat(getComputedStyle(frame).borderTopWidth) : 0,
        gap: rect && copy ? rect.left - copy.getBoundingClientRect().right : 0
      };
    });
    assert.ok(hardware.bezel >= 3 && hardware.statusHeight >= 40 &&
      hardware.islandWidth >= (viewport.width <= 370 ? 70 : 80) && hardware.homeBarWidth >= 90,
      `iPhone hardware cues missing at ${viewport.width}px: ${JSON.stringify(hardware)}`);
    if (viewport.width >= 961)
      assert.ok(hardware.gap >= 0 && hardware.gap < 150, `Excessive hero gap: ${hardware.gap}px`);
    const fixtureDisplay = await page.frameLocator("#homePhone").locator(".learnMissionFixture")
      .evaluate(node => getComputedStyle(node).display);
    assert.equal(fixtureDisplay, "none", "Yellow synthetic-fixture disclaimer must be hidden only in the marketing demo");
    const stage = page.locator("#homeModeIframe");
    await stage.scrollIntoViewIfNeeded();
    await page.frameLocator("#homeModeIframe").locator(".roomWorkspace").waitFor({ timeout: 30000 });
    assert.equal(await stage.getAttribute("src"), "/demo/room?mode=coach");
    await page.locator('.modeStep[data-mode="Learn"] .modeChoose').click();
    await page.waitForFunction(() => document.querySelector("#homeModeIframe")?.getAttribute("src") === "/demo/room?mode=learn");
    await page.frameLocator("#homeModeIframe").locator(".exploreJournalQuest").first().waitFor({ timeout: 30000 });
    assertModeTopGap(await readModeTopGap(page, "#homeModeIframe"), "Section 03 iPad Learn");
    // Regression: public Practice modes used a different ModeHeader location,
    // which retained the same sticky offset after Learn was fixed.
    for (const [name, route] of [["Quiz", "quiz"], ["Flashcards", "cards"], ["Coach", "coach"]]) {
      await page.locator(`.modeStep[data-mode="${name}"] .modeChoose`).click();
      await page.waitForFunction(expected => document.querySelector("#homeModeIframe")?.getAttribute("src") === expected,
        `/demo/room?mode=${route}`);
      await page.frameLocator("#homeModeIframe").locator(".modeFrame .modeHead").first().waitFor({ timeout: 30000 });
      assertModeTopGap(await readModeTopGap(page, "#homeModeIframe"), `Section 03 iPad ${name}`);
    }
    // Scaling must increase the actual iframe viewport, not stretch or crop
    // the app's controls in place. Keep a clear 4:3 iPad window.
    const tablet = await page.evaluate(() => {
      const viewport = document.querySelector(".modeTabletViewport");
      const iframe = document.querySelector("#homeModeIframe");
      const frame = document.querySelector("#homeModeDevice");
      const physical = viewport?.getBoundingClientRect();
      return {
        physicalWidth: physical?.width ?? 0,
        physicalHeight: physical?.height ?? 0,
        virtualWidth: iframe?.contentWindow?.innerWidth ?? 0,
        workspaceHeight: iframe?.contentDocument?.querySelector(".roomWorkspace")?.getBoundingClientRect().height ?? 0,
        bezelWidth: frame?.getBoundingClientRect().width ?? 0
      };
    });
    assert.ok(tablet.virtualWidth >= tablet.physicalWidth * 1.23,
      `iPad remains too zoomed in at ${viewport.width}px: ${JSON.stringify(tablet)}`);
    assert.ok(Math.abs(tablet.physicalWidth / tablet.physicalHeight - 4/3) < .02,
      `iPad viewport is not 4:3: ${JSON.stringify(tablet)}`);
    assert.ok(tablet.workspaceHeight >= 200,
      `Scaled iPad room collapsed inside bare shell: ${JSON.stringify(tablet)}`);
    const geometry = await page.evaluate(() => ({
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      optionTargets: [...document.querySelectorAll(".modeChoose")].map(node => Math.round(node.getBoundingClientRect().height)),
      stageWidth: document.querySelector("#homeModeDevice")?.getBoundingClientRect().width ?? 0
    }));
    assert.ok(geometry.overflow <= 2, `Homepage horizontal overflow at ${viewport.width}: ${geometry.overflow}`);
    assert.ok(geometry.optionTargets.every(n => n >= 44), "All mode selectors need >=44px targets");
    assert.ok(geometry.stageWidth > 200, "iPad must be visible at all supported widths");
    assert.deepEqual(failures, [], "Page JavaScript errors");
    console.log(`Marketing Explore and iPad PASS ${viewport.width}px`);
    await context.close();
  }
} finally {
  await browser.close();
}
