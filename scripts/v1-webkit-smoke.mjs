import assert from "node:assert/strict";
import { webkit } from "playwright";

/**
 * Linux Playwright WebKit smoke for Apple's rendering engine. This is stronger
 * than Chromium-only CSS simulation, but NOT a real iOS/iPadOS/VoiceOver test.
 */
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await webkit.launch({ headless: true });
try {
  for (const [name, width, height] of [
    ["iphone-390", 390, 844],
    ["ipad-820", 820, 1180]
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      deviceScaleFactor: 2
    });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${origin}/dev/study?shell=1&mode=materials&ui=phase3`, {
        waitUntil: "domcontentloaded", timeout: 90_000
      });
      assert.equal(response?.status(), 200, "WebKit synthetic Study Room must render");
      const nav = page.locator(width <= 700 ? ".studyNavigation .studyGroups" : ".workspaceTopbar .studyGroups");
      await nav.waitFor({ state: "visible" });
      const targets = await nav.locator("button").evaluateAll(nodes => nodes.map(node => {
        const bounds = node.getBoundingClientRect();
        return { label: node.getAttribute("aria-label"), width: bounds.width, height: bounds.height };
      }));
      assert.equal(targets.length, 5);
      assert.ok(targets.every(x => x.label && x.width >= 43.95 && x.height >= 43.95),
        `WebKit must preserve 44px named controls at ${name}: ${JSON.stringify(targets)}`);
      await page.getByRole("button", { name: "Room settings" }).click();
      const dialog = page.getByRole("dialog", { name: "Study Room settings" });
      await dialog.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.ok(await page.getByRole("button", { name: "Room settings" }).evaluate(node => node === document.activeElement),
        `WebKit must restore keyboard focus to settings invoker: ${name}`);
      const overflow = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      assert.ok(overflow <= 1, `WebKit Study Room horizontal overflow at ${name}: ${overflow}`);
      console.log(`V1 WebKit engine: ${name} PASS`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
