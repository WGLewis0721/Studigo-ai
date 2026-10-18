import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// This tests real shipped UI components in a synthetic shell; it does NOT
// pretend to authenticate, read learner data, or certify physical iOS Safari.
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/phase3-visual/v5-shell';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { provenance: 'Synthetic Study Room shell + anonymous real auth pages; no credentials or learner data', cases: [], failures: [] };

async function inspect(page, width, label) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  assert.ok(overflow <= 1, `${width}/${label}: horizontal overflow ${overflow}px`);
  const file = `${output}/${width}-${label}.png`;
  await page.screenshot({ path: file, animations: 'disabled', fullPage: true });
  report.cases.push({ width, label, overflow, screenshot: file });
}

try {
  for (const [width, height] of [[320,700], [390,844], [820,1180], [1440,900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const url = `${origin}/dev/study?shell=1&mode=coach&ui=phase3`;
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200, 'synthetic owned-room UI loads');
      const shell = page.locator('.appShell');
      assert.equal(await shell.count(), 1, 'one app shell');
      assert.equal(await page.locator('nav[aria-label="Study rooms"] .roomLink').count(), 3, 'one authoritative room picker');
      assert.equal(await page.getByRole('navigation', { name: 'Study Room sections' }).count(), 1, 'one five-section navigator');
      await inspect(page, width, 'coach-shell');

      const open = page.getByRole('button', { name: 'Room settings' });
      await open.click();
      const dialog = page.getByRole('dialog', { name: 'Study Room settings' });
      await dialog.waitFor({ state: 'visible' });
      assert.equal(await dialog.getAttribute('aria-modal'), 'true');
      await inspect(page, width, 'settings-open');

      // The owner-reported clipped final Delete Study Room row is a hard gate.
      const deleteButton = dialog.getByRole('button', { name: 'Delete room' });
      await deleteButton.scrollIntoViewIfNeeded();
      const footerRect = await deleteButton.boundingBox();
      assert.ok(footerRect && footerRect.y >= -1 && footerRect.y + footerRect.height <= height + 2,
        `${width}: Delete Study Room is fully reachable inside the viewport`);
      assert.ok(footerRect.height >= 40, `${width}: destructive button has a usable target`);
      await inspect(page, width, 'settings-footer');

      // Existing on-device colors must remain identical in room and settings.
      const palette = dialog.getByRole('radiogroup', { name: 'Room color' });
      await palette.getByRole('radio', { name: 'Grape' }).click();
      assert.equal(await palette.getByRole('radio', { name: 'Grape' }).getAttribute('aria-checked'), 'true');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(await open.evaluate(el => document.activeElement === el), 'closing settings restores invoker focus');
      assert.equal(await page.locator('.roomDevice').getAttribute('data-shell'), 'grape', 'theme updates room chrome');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('.roomDevice').getAttribute('data-shell'), 'grape', 'room theme persists across refresh on this device');
      await inspect(page, width, 'settings-persisted');

      // Non-destructive responsive room picker state.
      const railToggle = page.getByRole('button', { name: /^(Expand|Collapse) sidebar$/ });
      if (await railToggle.isVisible()) {
        const before = await shell.getAttribute('data-rail');
        await railToggle.click();
        assert.notEqual(await shell.getAttribute('data-rail'), before, 'sidebar changes explicitly');
        assert.equal(await railToggle.getAttribute('aria-expanded'), before === 'open' ? 'false' : 'true');
      }
      assert.deepEqual(errors, [], `${width}: no runtime page exceptions`);
    } finally { await context.close(); }
  }

  // Login/signup are real public routes with keyboard-reachable forms, not
  // credential submission. Real authenticated account E2E remains a separate gate.
  for (const [width, height] of [[320,700], [390,844], [820,1180], [1440,900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      for (const [path, title, submit] of [['login', 'Sign in', 'Sign in'], ['signup', 'Create an account', 'Create account']]) {
        const response = await page.goto(`${origin}/${path}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response?.status(), 200, `/${path} returns public auth UI`);
        assert.equal(await page.getByLabel('Email').count(), 1);
        assert.equal(await page.getByLabel('Password').count(), 1);
        const submitButton = page.locator('form.authForm button[type="submit"]');
        assert.equal(await submitButton.count(), 1, 'one password form submit independent of optional provider buttons');
        assert.match(await submitButton.innerText(), new RegExp('^' + submit));
        await inspect(page, width, 'auth-' + path);
      }
    } finally { await context.close(); }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`V5: ${report.cases.length} screenshots of Home/shell, settings, room picker and public auth across four widths. Real signed-in server persistence is not asserted.`);
