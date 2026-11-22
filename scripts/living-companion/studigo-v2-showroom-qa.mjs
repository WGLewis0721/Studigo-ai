import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3328";
const output = process.env.STUDIGO_QA_EVIDENCE;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});

async function visibleCharacter(canvas) {
  // Free exports play Rive's monochrome splash before drawing the character.
  // Check for the approved orange art before evaluating any animation frames.
  await canvas.evaluate((element) => new Promise((resolve, reject) => {
    const context = element.getContext("2d");
    if (!context) { reject(new Error("No composited Rive canvas")); return; }
    const until = performance.now() + 15_000;
    const inspect = () => {
      const pixels = context.getImageData(0, 0, element.width, element.height).data;
      let orange = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i] > 135 && pixels[i] - pixels[i + 1] > 36 && pixels[i + 1] - pixels[i + 2] > 15 && pixels[i + 3] > 200) orange++;
      }
      if (orange > element.width * element.height / 160) resolve();
      else if (performance.now() > until) reject(new Error("The orange character never appeared after the Rive splash"));
      else setTimeout(inspect, 150);
    };
    inspect();
  }));
}

try {
  const page = await browser.newPage({ viewport: { width: 900, height: 880 }, reducedMotion: "no-preference" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/dev/studigo`);
  const actor = page.getByRole("button", { name: "Pet or tap Studigo" });
  const canvas = actor.locator("canvas");
  const ready = () => actor.and(page.locator("[data-studigo=ready]")).waitFor();
  await ready();
  await visibleCharacter(canvas);
  assert.equal(await canvas.count(), 1);
  const idle = await canvas.screenshot({ animations: "disabled" });
  await page.waitForTimeout(450);
  assert.ok(!(await canvas.screenshot({ animations: "disabled" })).equals(idle), "idle should visibly advance");

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
  await page.waitForTimeout(250);
  await canvas.evaluate((element) => {
    const context = element.getContext("2d");
    if (!context) throw new Error("Studigo shared renderer did not expose its composited surface");
    window.studigoCalmPixels = context.getImageData(0, 0, element.width, element.height).data;
  });
  await page.getByRole("button", { name: "celebrating", exact: true }).click();
  await page.waitForTimeout(400);
  const calmDifference = await canvas.evaluate((element) => {
    const old = window.studigoCalmPixels;
    delete window.studigoCalmPixels;
    const current = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
    let changed = 0;
    for (let i = 0; i < current.length; i += 4) {
      if (current.subarray(i, i + 4).some((color, channel) => Math.abs(color - old[i + channel]) > 3)) changed++;
    }
    return changed / (current.length / 4);
  });
  assert.ok(calmDifference < 0.0005, `system calm blocks decorative reactions (changed ${calmDifference} of pixels)`);

  await page.getByLabel("Second instance").check();
  const secondActor = page.getByRole("img", { name: "Second Studigo instance" }).and(page.locator("[data-studigo=ready]"));
  await secondActor.waitFor();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 2);
  await page.getByLabel("Mounted", { exact: true }).uncheck();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 1);
  await page.getByLabel("Mounted", { exact: true }).check();
  await ready();
  assert.equal(await page.locator(".studigoCharacterCanvas").count(), 2);
  await visibleCharacter(canvas);
  await visibleCharacter(secondActor.locator("canvas"));
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
