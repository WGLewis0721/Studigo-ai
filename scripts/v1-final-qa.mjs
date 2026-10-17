import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

/**
 * Deterministic synthetic V1 acceptance. Browser zoom and keyboard emulation
 * are NOT equivalent to hardware iOS Safari or VoiceOver certification.
 */
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const output = "artifacts/phase3-visual/v1-final";
const widths = [
  { name: "phone-320", width: 320, height: 720 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "desktop-1440", width: 1440, height: 900 }
];
const emptyModes = [
  ["quiz", "Nothing to quiz on yet."],
  ["cards", "Nothing to drill yet."],
  ["weak", "No weak areas to rank right now."],
  ["plan", "Nothing scheduled yet."]
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const size of widths) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      reducedMotion: "reduce",
      colorScheme: "light",
      deviceScaleFactor: 1
    });
    try {
      const page = await context.newPage();
      const url = `${origin}/dev/study?shell=1&mode=quiz&empty=1&ui=phase3`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
      assert.equal(response?.status(), 200, "synthetic empty fixture must render");
      const nav = page.locator(size.width <= 700
        ? ".studyNavigation .studyGroups"
        : ".workspaceTopbar .studyGroups");
      await nav.waitFor({ state: "visible" });
      const keys = await nav.locator("button").evaluateAll(nodes => nodes.map(node => ({
        name: node.getAttribute("aria-label"),
        current: node.getAttribute("aria-current"),
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height
      })));
      assert.equal(keys.length, 5, "retain five sections on every device");
      assert.ok(keys.every(k => k.name?.trim() && k.width >= 43.95 && k.height >= 43.95),
        `accessible 44px section navigation required: ${JSON.stringify(keys)}`);
      const settings = page.getByRole("button", { name: "Room settings" });
      await settings.click();
      const dialog = page.getByRole("dialog", { name: "Study Room settings" });
      await dialog.waitFor({ state: "visible" });
      assert.equal(await dialog.getAttribute("aria-modal"), "true");
      const trapped = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      assert.ok(trapped, "settings dialog must receive initial keyboard focus");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.ok(await settings.evaluate(el => el === document.activeElement),
        "closing settings must return focus to invoking button");

      for (const [mode, title] of emptyModes) {
        await page.goto(`${origin}/dev/study?shell=1&mode=${mode}&empty=1&ui=phase3`, {
          waitUntil: "networkidle", timeout: 90_000
        });
        const empty = page.locator('.modeEmpty[data-state="empty"]');
        await empty.waitFor({ state: "visible" });
        const heading = empty.getByRole("heading", { name: title });
        assert.equal(await heading.count(), 1, `accessible empty heading: ${mode}`);
        const label = await empty.getAttribute("aria-labelledby");
        assert.ok(label && await heading.getAttribute("id") === label,
          "empty region must be labelled by the visible heading");
        const localOverflow = await page.evaluate(() =>
          Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
        assert.ok(localOverflow <= 1, `no page horizontal overflow in ${mode} at ${size.name}: ${localOverflow}px`);
      }
      // 200% CSS zoom approximates layout reflow only. It cannot prove
      // assistive-tech or native browser zoom semantics.
      if (size.width >= 820) {
        await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
        await page.waitForTimeout(100);
        const zoom = await page.evaluate(() => {
          const selected = document.querySelector(".workspaceTopbar .studyGroups button[aria-current='page']");
          const r = selected?.getBoundingClientRect();
          return { width: r?.width ?? 0, height: r?.height ?? 0,
            overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
        });
        assert.ok(zoom.width >= 44 && zoom.height >= 44,
          `zoom must preserve selected navigation target: ${JSON.stringify(zoom)}`);
        assert.ok(zoom.overflow <= 1, `200% layout reflow must avoid page overflow: ${JSON.stringify(zoom)}`);
      }
      await page.screenshot({ path: path.join(output, `${size.name}-V1-acceptance.png`),
        fullPage: true, animations: "disabled" });
      console.log(`V1 shared layout/empty/settings: ${size.name} PASS`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
