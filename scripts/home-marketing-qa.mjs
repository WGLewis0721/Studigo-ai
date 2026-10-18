import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const widths = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 }
];

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
    const stage = page.locator("#homeModeIframe");
    await stage.scrollIntoViewIfNeeded();
    await page.frameLocator("#homeModeIframe").locator(".roomWorkspace").waitFor({ timeout: 30000 });
    assert.equal(await stage.getAttribute("src"), "/demo/room?mode=coach");
    await page.locator('.modeStep[data-mode="Learn"] .modeChoose').click();
    await page.waitForFunction(() => document.querySelector("#homeModeIframe")?.getAttribute("src") === "/demo/room?mode=learn");
    await page.frameLocator("#homeModeIframe").locator(".exploreJournalQuest").first().waitFor({ timeout: 30000 });
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
