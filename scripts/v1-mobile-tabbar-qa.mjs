import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const widths = [320, 390];

const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: "no-preference",
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      const response = await page.goto(`${origin}/dev/study?shell=1&mode=materials&ui=phase3`, {
        waitUntil: "networkidle", timeout: 90_000,
      });
      assert.equal(response?.status(), 200, "test must use the existing synthetic Study Room only");
      const nav = page.getByRole("navigation", { name: "Study Room sections" });
      await nav.waitFor();
      assert.equal(await nav.getAttribute("data-state"), "full", "mobile starts expanded");
      await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        if (!(surface instanceof HTMLElement)) throw new Error("Study Room scroll surface missing");
        window.__v1ScrollEvents = [];
        window.addEventListener("scroll", event => {
          window.__v1ScrollEvents.push(event.target instanceof Element ? event.target.className : String(event.target));
        }, { capture: true, passive: true });
        surface.style.setProperty("height", "400px", "important");
        surface.style.setProperty("max-height", "400px", "important");
        surface.style.setProperty("overflow-y", "auto", "important");
        const spacer = document.createElement("div");
        spacer.dataset.v1Fixture = "scroll";
        spacer.style.height = "2800px";
        spacer.style.minHeight = "2800px";
        spacer.style.flex = "0 0 2800px";
        spacer.style.pointerEvents = "none";
        surface.append(spacer);
        surface.scrollTop = 1; // Register the scroll surface before measuring deltas.
      });
      const scrollSetup = await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        if (!(surface instanceof HTMLElement)) throw new Error("Scroll surface missing");
        return { top: surface.scrollTop, max: surface.scrollHeight - surface.clientHeight, overflow: getComputedStyle(surface).overflowY };
      });
      assert.ok(scrollSetup.max >= 300 && scrollSetup.top >= 1,
        `Fixture failed to provide a scrollable Study Room surface: ${JSON.stringify(scrollSetup)}`);
      await page.waitForTimeout(80);
      const scrollAfter = await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        if (!(surface instanceof HTMLElement)) throw new Error("Scroll surface missing");
        surface.scrollTop = 330;
        return { top: surface.scrollTop, max: surface.scrollHeight - surface.clientHeight };
      });
      assert.ok(scrollAfter.top >= 300, `Scroll did not advance: ${JSON.stringify(scrollAfter)}`);
      await page.waitForTimeout(350);
      const scrollDiagnostic = await page.evaluate(() => ({
        state: document.querySelector(".studyNavigation .studyGroups")?.getAttribute("data-state"),
        progress: document.querySelector(".studyNavigation .studyGroups")?.style.getPropertyValue("--tb"),
        phone: matchMedia("(max-width: 700px)").matches,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        modals: [...document.querySelectorAll('[aria-modal="true"]')].map(node => node.className || node.tagName),
        surfaceClass: document.querySelector(".modeSurface")?.className,
        scrollEvents: window.__v1ScrollEvents,
      }));
      assert.equal(scrollDiagnostic.state, "compact",
        `Study Room scroll did not compact dock: ${JSON.stringify({ scrollSetup, scrollAfter, ...scrollDiagnostic })}`);
      assert.equal(await nav.locator("button[aria-label]").count(), 5);
      const targetSizes = await nav.locator("button[aria-label]").evaluateAll(nodes => nodes.map(el => {
        const box = el.getBoundingClientRect();
        return { name: el.getAttribute("aria-label"), w: box.width, h: box.height };
      }));
      assert.ok(targetSizes.every(v => v.w >= 43.95 && v.h >= 43.95),
        `Compact dock must have real 44px touch targets: ${JSON.stringify(targetSizes)}`);

      await nav.getByRole("button", { name: "Materials" }).focus();
      await page.waitForFunction(() => document.querySelector(".studyNavigation .studyGroups")?.getAttribute("data-state") === "full");

      // Dialog/sheet scrolling never changes the underlying section dock.
      await page.evaluate(() => {
        const dialog = document.createElement("div");
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.id = "v1-test-dialog";
        document.body.append(dialog);
        const surface = document.querySelector(".modeSurface");
        if (surface instanceof HTMLElement) surface.scrollTop = 660;
      });
      await page.waitForTimeout(260);
      assert.equal(await nav.getAttribute("data-state"), "full", "scroll with modal must not collapse the section dock");
      await page.evaluate(() => document.getElementById("v1-test-dialog")?.remove());

      // Chromium simulation exercises the viewport-obscured field condition.
      // This is NOT evidence of real iOS Safari keyboard behavior.
      await page.evaluate(() => {
        const field = document.createElement("input");
        field.type = "text";
        field.id = "v1-test-field";
        field.setAttribute("aria-label", "Synthetic keyboard field");
        document.body.append(field);
        field.focus();
        const vv = window.visualViewport;
        if (!vv) throw new Error("Browser lacks VisualViewport");
        Object.defineProperty(vv, "height", { configurable: true, value: window.innerHeight - 240 });
        vv.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(() => document.querySelector(".studyNavigation .studyGroups")?.getAttribute("data-keyboard") === "open");
      assert.equal(await nav.evaluate(el => getComputedStyle(el).visibility), "hidden",
        "software keyboard must not leave the dock over an editable field");
      await page.evaluate(() => {
        document.getElementById("v1-test-field")?.blur();
        const vv = window.visualViewport;
        if (vv) {
          delete vv.height;
          vv.dispatchEvent(new Event("resize"));
        }
      });
      await page.waitForFunction(() => !document.querySelector(".studyNavigation .studyGroups")?.hasAttribute("data-keyboard"));
      assert.equal(await nav.evaluate(el => getComputedStyle(el).visibility), "visible",
        "dock returns after keyboard closes");
      console.log(`V1 tabbar: ${width}px scroll, focus, modal, keyboard-occlusion simulation PASS`);
    } finally {
      await context.close();
    }

    // Reduced-motion learners retain a stationary, full-height dock while scrolling.
    const reduced = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    try {
      const page = await reduced.newPage();
      await page.goto(`${origin}/dev/study?shell=1&mode=materials&ui=phase3`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.evaluate(() => {
        const surface = document.querySelector(".modeSurface");
        if (!(surface instanceof HTMLElement)) throw new Error("Study Room scroll surface missing");
        surface.style.setProperty("height", "400px", "important");
        surface.style.setProperty("max-height", "400px", "important");
        surface.style.setProperty("overflow-y", "auto", "important");
        const spacer = document.createElement("div");
        spacer.style.height = "2800px";
        surface.append(spacer);
        surface.scrollTop = 580;
      });
      await page.waitForTimeout(240);
      assert.equal(await page.locator(".studyNavigation .studyGroups").getAttribute("data-state"), "full",
        "reduced motion must keep the section bar full");
    } finally {
      await reduced.close();
    }
    console.log(`V1 reduced motion: ${width}px PASS`);
  }
} finally {
  await browser.close();
}
