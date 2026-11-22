import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3328";
const output = process.env.STUDIGO_QA_EVIDENCE;
const stress = process.argv.includes("--stress");
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
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/mascot/")) errors.push(`Missing mascot asset (${response.status()}) ${response.url()}`);
  });
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
  const head = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.30 };
  const belly = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.68 };
  await page.mouse.click(belly.x, belly.y);
  await page.getByText("poke", { exact: true }).waitFor();
  await page.mouse.move(head.x, head.y);
  await page.mouse.down();
  await page.getByText("hold", { exact: true }).waitFor();
  await page.mouse.up();
  await page.mouse.move(belly.x, belly.y);
  await page.mouse.down();
  await page.mouse.move(belly.x + 25, belly.y, { steps: 4 });
  await page.mouse.up();
  await page.getByText("drag", { exact: true }).waitFor();
  await page.waitForTimeout(900);
  for (let i = 0; i < 3; i++) await page.mouse.click(head.x, head.y);
  await page.getByText("surprise", { exact: true }).waitFor();

  const performanceEvidence = {};
  if (stress) {
    performanceEvidence.idle = await canvas.evaluate((element) => new Promise((resolve) => {
      const start = performance.now();
      let previous = start;
      const intervals = [];
      const samples = new Set();
      let sampleAfter = start;
      const ctx = element.getContext("2d", { willReadFrequently: true });
      function frame(now) {
        intervals.push(now - previous);
        previous = now;
        if (now >= sampleAfter) {
          const pixels = ctx.getImageData(0, 0, element.width, element.height).data;
          let hash = 0;
          for (let i = 0; i < pixels.length; i += 67) hash = (Math.imul(hash, 31) + pixels[i]) | 0;
          samples.add(hash);
          sampleAfter = now + 500;
        }
        if (now - start < 60_000) { requestAnimationFrame(frame); return; }
        intervals.sort((a, b) => a - b);
        resolve({ durationMs: now - start, frames: intervals.length, over33ms: intervals.filter((ms) => ms > 33.5).length,
          p95IntervalMs: intervals[Math.floor(intervals.length * 0.95)], distinctPaintSamples: samples.size });
      }
      requestAnimationFrame(frame);
    }));
    assert.ok(performanceEvidence.idle.distinctPaintSamples > 20, "idle should keep drawing");
    const stateButtons = await page.locator("fieldset").filter({ has: page.getByText("Base state", { exact: true }) }).locator("button").all();
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await stateButtons[i % stateButtons.length].click();
    }
    performanceEvidence.transitionRequests = { count: 100, elapsedMs: Date.now() - start };
    await page.getByRole("button", { name: "Return to idle" }).click();
    await visibleCharacter(canvas);
    const memoryBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Mounted", { exact: true }).uncheck();
      assert.equal(await page.locator(".studigoCharacterCanvas").count(), 0);
      await page.getByLabel("Mounted", { exact: true }).check();
      await ready();
    }
    performanceEvidence.mounts = { cycles: 5, memoryBefore, memoryAfter: await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null) };
    await visibleCharacter(canvas);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
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
  // Calm keeps the body still; the emote (spark, heart, thought) still appears, without its pop, so up to 1% of pixels may change.
  assert.ok(calmDifference < 0.01, `system calm blocks decorative reactions (changed ${calmDifference} of pixels)`);

  const painted = async () => (await canvas.screenshot({ animations: "disabled" }));
  const neutral = await painted();
  const outfits = new Set();
  for (const name of ["goggles", "explorer", "visor", "reader", "beret", "headphones", "sash"]) {
    await page.getByLabel("Outfit").selectOption(name);
    await page.waitForTimeout(200);
    const outfit = await painted();
    assert.ok(!outfit.equals(neutral), `missing cosmetic paint for ${name}`);
    outfits.add(outfit.toString("base64"));
  }
  assert.equal(outfits.size, 7, "all seven outfits should change the image differently");
  await page.getByLabel("Outfit").selectOption("");
  await page.getByLabel("Flame").selectOption("blazing");
  await page.waitForTimeout(250);
  assert.ok(!(await painted()).equals(neutral), "flame growth should paint a visible change");
  if (output) {
    await page.getByLabel("Outfit").selectOption("goggles");
    await page.waitForTimeout(250);
    await mkdir(output, { recursive: true });
    await canvas.screenshot({ path: join(output, "outfit-and-flame.png") });
  }

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
    if (stress) await writeFile(join(output, "chromium-metrics.json"), JSON.stringify(performanceEvidence, null, 2) + "\n");
  }

  const failure = await browser.newPage();
  await failure.route("**/mascot/rive/studigo.riv*", (route) => route.fulfill({ status: 404 }));
  await failure.goto(`${base}/dev/studigo`);
  const fallback = failure.getByRole("button", { name: "Pet or tap Studigo" }).and(failure.locator("[data-studigo=fallback]"));
  await fallback.waitFor();
  await fallback.locator("img").waitFor({ state: "visible" });
  await canvas.evaluate((element) => element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
  await actor.and(page.locator("[data-studigo=fallback]")).waitFor();
  console.log(JSON.stringify({ browser: browser.version(), idle: "pass", keyboard: "pass", touch: "pass", outfits: outfits.size, flame: "pass", calm: "pass",
    instances: "pass", remount: "pass", asset404: "pass", contextLossEvent: "pass", ...performanceEvidence }));
} finally {
  await browser.close();
}
