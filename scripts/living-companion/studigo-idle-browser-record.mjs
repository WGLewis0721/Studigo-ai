// Records the shipped StudigoCharacter idling in a real browser (Playwright video, real time).
// Usage: STUDIGO_QA_BASE=http://127.0.0.1:3328 node scripts/living-companion/studigo-idle-browser-record.mjs <outDir> [seconds=30]
import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3328";
const out = process.argv[2];
const seconds = Number(process.argv[3] ?? 30);
if (!out) throw new Error("output directory required");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
const context = await browser.newContext({ viewport: { width: 480, height: 480 }, recordVideo: { dir: out, size: { width: 480, height: 480 } } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(`${base}/dev/studigo`);
await page.getByLabel("Second instance").uncheck();
await page.getByRole("button", { name: "Pet or tap Studigo" }).and(page.locator("[data-studigo=ready]")).waitFor({ timeout: 60_000 });
// Rive's Free-tier splash plays first; wait for it to hand over, then record the idle itself.
await page.waitForTimeout(8_000);
const started = Date.now();
await page.evaluate(() => { document.body.style.margin = "0"; document.querySelector("h1")?.remove(); });
await page.waitForTimeout(seconds * 1000);
const elapsed = (Date.now() - started) / 1000;
const video = page.video();
await context.close();
await browser.close();
const path = await video.path();
console.log(JSON.stringify({ video: path, seconds: elapsed, errors }));
