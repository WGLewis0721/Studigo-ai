import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3328";
const output = process.env.STUDIGO_QA_EVIDENCE;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 900, height: 880 }, reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/dev/studigo`);
  const actor = page.getByRole("button", { name: "Pet or tap Studigo" });
  const canvas = actor.locator("canvas");
  const ready = () => actor.and(page.locator("[data-studigo=ready]")).waitFor();
  await ready();
  assert.equal(await canvas.count(), 1);
  const idle = await actor.screenshot({ animations: "disabled" });
  await page.waitForTimeout(450);
  assert.notDeepEqual(await actor.screenshot({ animations: "disabled" }), idle, "idle should visibly advance");

  await actor.focus();
  await page.keyboard.press("Enter");
  await page.getByText("tap", { exact: true }).waitFor();
  const rect = await actor.boundingBox();
  assert.ok(rect);
  await page.mouse.move(rect.x + rect.width * 0.46, rect.y + rect.height * 0.29);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.57, rect.y + rect.height * 0.3, { steps: 4 });
  await page.mouse.up();
  await page.getByText("pet", { exact: true }).waitFor();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(125);
  const calm = await actor.screenshot({ animations: "disabled" });
  await page.getByRole("button", { name: "celebrating", exact: true }).click();
  await page.waitForTimeout(400);
  assert.deepEqual(await actor.screenshot({ animations: "disabled" }), calm, "system calm blocks decorative reactions");

  await page.getByLabel("Second instance").check();
  await page.getByRole("img", { name: "Second Studigo instance" }).and(page.locator("[data-studigo=ready]")).waitFor();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 2);
  await page.getByLabel("Mounted", { exact: true }).uncheck();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 1);
  await page.getByLabel("Mounted", { exact: true }).check();
  await ready();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 2);
  assert.deepEqual(errors, []);
  if (output) {
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, "showroom-chromium.png") });
  }

  const failure = await browser.newPage();
  await failure.route("**/mascot/rive/studigo.riv", (route) => route.fulfill({ status: 404 }));
  await failure.goto(`${base}/dev/studigo`);
  const fallback = failure.getByRole("button", { name: "Pet or tap Studigo" }).and(failure.locator("[data-studigo=fallback]"));
  await fallback.waitFor();
  await fallback.locator("img").waitFor({ state: "visible" });
  console.log(JSON.stringify({ browser: browser.version(), idle: "pass", keyboard: "pass", pet: "pass", calm: "pass", instances: "pass", remount: "pass", asset404: "pass" }));
} finally {
  await browser.close();
}
