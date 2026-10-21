import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    try {
      for (const mode of ["quiz", "cards", "mastery", "plan", "materials"]) {
        const response = await page.goto(`${origin}/dev/study?shell=1&ui=phase3&mode=${mode}`, { waitUntil: "networkidle" });
        assert.equal(response?.status(), 200);
        const layout = await page.evaluate(() => {
          const appMain = document.querySelector(".appMain");
          const room = document.querySelector(".roomDevice");
          const topbar = document.querySelector(".workspaceTopbar");
          const frame = document.querySelector(".modeFrame");
          const surface = document.querySelector(".modeSurface");
          const rail = frame?.querySelector(".studigoRail");
          if (!appMain || !room || !topbar || !frame || !surface || !rail) throw new Error("Missing room chrome");
          const reminder = document.createElement("p");
          reminder.className = "betaRetention";
          reminder.textContent = "Synthetic beta deletion reminder";
          appMain.insertBefore(reminder, room);
          return {
            reminder: getComputedStyle(reminder).display,
            gap: frame.getBoundingClientRect().top - topbar.getBoundingClientRect().bottom,
            contentTop: surface.firstElementChild?.getBoundingClientRect().top,
            railBottom: rail.getBoundingClientRect().bottom,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          };
        });
        assert.equal(layout.reminder, "none", `${width}px ${mode}: deletion reminder must not occupy the room viewport`);
        assert.ok(Math.abs(layout.gap) <= 2, `${width}px ${mode}: empty space above mode header: ${JSON.stringify(layout)}`);
        assert.ok(layout.contentTop >= layout.railBottom - 1, `${width}px ${mode}: content begins under the rail: ${JSON.stringify(layout)}`);
        assert.ok(layout.scrollWidth <= layout.clientWidth, `${width}px ${mode}: horizontal overflow: ${JSON.stringify(layout)}`);
      }

      // The document, rather than .modeSurface, scrolls on phones. Changing
      // sections must not carry an old scroll position into the next page.
      await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "1800px";
        spacer.dataset.mobileRoomSpacer = "";
        document.querySelector(".modeSurface")?.append(spacer);
        window.scrollTo(0, 400);
      });
      await page.waitForFunction(() => window.scrollY > 100);
      await page.locator(".studyNavigation").getByRole("button", { name: "Progress" }).click();
      await page.waitForFunction(() => document.querySelector(".roomWorkspace")?.getAttribute("data-tone") === "mastery" && window.scrollY === 0);
      console.log(`Mobile room chrome: ${width}px modes, reminder, top gap, and scroll reset PASS`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
