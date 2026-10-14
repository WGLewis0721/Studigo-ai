import { strict as assert } from "node:assert";
import { chromium } from "playwright";

const base = process.env.STUDIGO_UI_TEST_URL ?? "http://localhost:3102";
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error("This regression test only runs against the local synthetic fixture.");
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {})
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const coachPrompt = "Coach me through: Instinctive and learned behaviors.";
  const coachReply = "Let's practice instinctive and learned behaviors.";

  // The local fixture normally uses a live provider. Stub only its dev-only
  // route so this UI regression stays deterministic and never spends AI budget.
  await page.route("**/api/dev/coach", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      body: [
        'data: {"type":"start","conversationId":null}',
        `data: ${JSON.stringify({ type: "delta", text: coachReply })}`,
        `data: ${JSON.stringify({ type: "done", text: coachReply, citations: [], grounded: true })}`,
        ""
      ].join("\n\n")
    });
  });

  await page.goto(`${base}/dev/study`, { waitUntil: "networkidle", timeout: 60_000 });
  const composer = page.locator(".chatComposer");
  await composer.getByRole("textbox", { name: "Message Studigo" }).fill(coachPrompt);
  await page.waitForFunction(() => {
    const button = document.querySelector(".chatComposer button");
    return Boolean(button && !button.disabled);
  });
  await composer.getByRole("button", { name: "Send to Studigo" }).click();
  await page.getByText(coachReply, { exact: true }).waitFor();
  assert.equal(await page.getByText(coachPrompt, { exact: true }).count(), 1);

  await page.locator(".chatModes button").filter({ hasText: "Learn" }).click();
  await page.getByText("Understand it.", { exact: true }).waitFor();
  assert.equal(
    await page.getByText(coachPrompt, { exact: true }).count(),
    0,
    "Coach turns must not appear in Learn"
  );

  await page.getByRole("button", { name: "How Learn works" }).click();
  await page.getByText("What Learn does", { exact: true }).waitFor();

  await page.locator(".chatModes button").filter({ hasText: "Coach" }).click();
  await page.getByText(coachPrompt, { exact: true }).waitFor();
  assert.equal(
    await page.getByText("What Learn does", { exact: true }).count(),
    0,
    "Learn turns must not appear in Coach"
  );

  console.log("PASS: Coach and Learn mode switching keeps visible histories separate.");
} finally {
  await browser.close();
}
