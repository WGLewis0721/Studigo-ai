import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.STUDIGO_QA_BASE ?? "http://127.0.0.1:3328";
const output = process.env.STUDIGO_QA_EVIDENCE;
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
const shot = async (page, filename) => {
  if (!output) return;
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, filename) });
};

async function waitForCharacter(page, selector) {
  await page.locator(selector).waitFor({ timeout: 25_000 });
  await page.waitForFunction((selector) => {
    const canvas = document.querySelector(selector);
    const pixels = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return false;
    for (let i = 0; i < pixels.length; i += 16) {
      if (pixels[i] > 175 && pixels[i] - pixels[i + 1] > 40 && pixels[i + 1] - pixels[i + 2] > 24 && pixels[i + 3] > 200) return true;
    }
    return false;
  }, selector, { timeout: 18_000 });
}

const growth = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("studigo.companion.growth") ?? '{"points":0}').points);
try {
  const home = await browser.newPage({ viewport: { width: 1400, height: 870 } });
  const errors = [];
  const handleErrors = (page) => page.on("pageerror", (error) => errors.push(error.message));
  handleErrors(home);
  await home.goto(`${base}/dev/home?first=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await home.getByRole("heading", { name: "Meet Studigo" }).waitFor();
  await waitForCharacter(home, ".firstRoomCharacter[data-studigo=ready] canvas");
  await home.getByRole("textbox", { name: "Say hello to Studigo" }).fill("I like dinosaurs.");
  await home.getByRole("button", { name: "Send to Studigo" }).click();
  await home.getByText("Hi! Want to try a quick question together?", { exact: false }).waitFor();
  await home.getByRole("button", { name: "Read to me" }).waitFor();
  assert.equal(await growth(home), 0, "the first meeting must not earn growth");
  await shot(home, "first-meeting-chromium.png");
  await home.getByRole("button", { name: "Try a sample together" }).click();
  await home.getByRole("button", { name: /^Next/ }).click();
  await home.getByRole("button", { name: /^Next/ }).click();
  await home.getByRole("textbox", { name: "Your response" }).fill("The three branches share power.");
  await home.getByRole("button", { name: /^Next/ }).click();
  await home.getByRole("button", { name: /Open my Study Room/ }).click();
  await home.waitForURL("**/dev/study?mode=coach&shell=1", { timeout: 90_000, waitUntil: "domcontentloaded" });
  await waitForCharacter(home, ".cmpRive[data-studigo=ready] canvas");
  await shot(home, "study-room-chromium.png");
  await home.evaluate(() => window.studigoCompanion.event("correct"));
  assert.equal(await growth(home), 1, "existing committed-event adapter should award growth");
  await home.evaluate(() => window.studigoCompanion.event("wrong"));
  assert.equal(await growth(home), 2, "the existing reward table credits an honest attempt");
  await home.getByRole("button", { name: "Send Studigo back to his seat" }).click();
  await home.getByRole("button", { name: "Bring Studigo back out" }).click();
  await waitForCharacter(home, ".cmpRive[data-studigo=ready] canvas");
  assert.equal(await home.locator(".cmpRive canvas").count(), 1);
  await home.getByRole("button", { name: "Studigo's menu" }).click();
  await home.getByRole("button", { name: "Strip under the menu" }).click();
  await waitForCharacter(home, '.cmp[data-host="strip"] .cmpRive[data-studigo=ready] canvas');
  const showControls = home.getByRole("button", { name: /Show controls/ });
  if (await showControls.isVisible()) await showControls.click();
  await home.waitForFunction(() => document.querySelector("[data-companion-strip]").getBoundingClientRect().height >= 55);
  assert.equal(await home.locator(".cmpRive canvas").count(), 1);
  await shot(home, "study-strip-chromium.png");
  await home.goto(`${base}/dev/home`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await home.getByRole("button", { name: "Say hi to Studigo" }).click();
  await home.getByRole("textbox", { name: "Say hello to Studigo" }).waitFor();
  await home.getByRole("button", { name: "Close chat" }).click();
  await home.getByRole("textbox", { name: "Say hello to Studigo" }).waitFor({ state: "hidden" });
  await home.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, hasTouch: true });
  handleErrors(phone);
  await phone.goto(`${base}/dev/home?first=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await phone.locator(".firstRoomCharacter").scrollIntoViewIfNeeded();
  await waitForCharacter(phone, ".firstRoomCharacter[data-studigo=ready] canvas");
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  await shot(phone, "first-meeting-390px-chromium.png");
  await phone.getByRole("button", { name: /Get homework help/ }).click();
  await phone.getByRole("heading", { name: "What are you studying?" }).waitFor();
  await phone.getByRole("button", { name: /^Next/ }).click();
  await phone.getByRole("button", { name: /^Next/ }).click();
  await phone.getByRole("button", { name: /^Next/ }).click();
  await phone.getByRole("button", { name: /Open Materials/ }).click();
  await phone.waitForURL("**/dev/study?mode=materials&shell=1&empty=1", { timeout: 60_000, waitUntil: "domcontentloaded" });
  assert.equal(await growth(phone), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browser.version(), firstMeeting: "pass", sampleToCoach: "pass", ownFileToMaterials: "pass", growthEvent: "pass", seatAndSummon: "pass", strip: "pass", returnChat: "pass", smallViewport: "390px emulated" }));
} finally {
  await browser.close();
}
