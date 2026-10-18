import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.PHASE3_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/phase3-visual/v5';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-gpu'] }
    : {})
});
const report = { provenance: 'Synthetic Home/first-run fixture. No accounts created, learner source, or saved writes.', cases: [] };
try {
  for (const [width,height] of [[320,700],[390,844],[820,1180],[1440,900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const check = async label => {
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)), 0, `${width} ${label}: no horizontal overflow`);
        const path = `${output}/${width}-${label}.png`;
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });
        report.cases.push({ width, label, path });
      };
      await page.goto(`${origin}/dev/home?first=1`, { waitUntil: 'networkidle' });
      await page.evaluate(() => { localStorage.removeItem('studigo-first-run'); localStorage.removeItem('studigo-first-run-path'); });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: "I'll add my own file" }).click();
      await page.getByRole('heading', { name: 'What are you studying?' }).waitFor();
      assert.equal(await page.locator('input[name="subject"]').inputValue(), '', 'own-file path is not assigned the sample subject');
      assert.equal(await page.locator('input[name="topic"]').inputValue(), '', 'own-file path is not assigned the sample topic');
      await check('own-source');
      await page.getByRole('button', { name: /^Next/ }).click();
      const goals = page.getByRole('radiogroup', { name: 'Goal' });
      await goals.getByRole('radio', { name: 'Understand' }).focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await goals.getByRole('radio', { name: 'Prepare for a test' }).getAttribute('aria-checked'), 'true', 'keyboard changes goal');
      await page.keyboard.press('ArrowRight');
      assert.equal(await goals.getByRole('radio', { name: 'Practice' }).getAttribute('aria-checked'), 'true', 'focus and checked goal stay together');
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByRole('heading', { name: 'Your first lesson starts with your file.' }).waitFor();
      assert.equal(await page.getByText('Who enforces the laws?').count(), 0, 'own-file path does not masquerade as a civics lesson');
      await check('source-first');
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByRole('heading', { name: 'Ready to add your file.' }).waitFor();
      await page.getByRole('button', { name: 'Open Materials' }).click();
      await page.getByRole('alert').filter({ hasText: 'Preview only' }).waitFor();
      // The labeled sample still shows its actual facts and remains ungraded.
      await page.goto(`${origin}/dev/home?first=1`, { waitUntil: 'networkidle' });
      await page.evaluate(() => { localStorage.removeItem('studigo-first-run'); localStorage.removeItem('studigo-first-run-path'); });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /^Use the sample/ }).click();
      assert.equal(await page.locator('input[name="subject"]').inputValue(), 'Community government');
      assert.equal(await page.locator('input[name="topic"]').inputValue(), 'Three branches');
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByRole('heading', { name: 'Try one question.' }).waitFor();
      assert.equal(await page.getByText('Who enforces the laws?').count(), 1, 'labeled sample preserves its real question');
      await page.locator('textarea[name="response"]').fill('The executive branch.');
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByRole('heading', { name: 'Name and color can wait.' }).waitFor();
      await check('sample-finish');
      // Returning rooms have one filled-in decision; optional input fields are disclosed.
      await page.goto(`${origin}/dev/home`, { waitUntil: 'networkidle' });
      const create = page.locator('.createRoomPanel');
      assert.equal(await create.locator('input[name="title"]').inputValue(), 'My next Study Room');
      const optional = create.locator('.roomCreateOptions');
      assert.equal(await optional.getAttribute('open'), null);
      await optional.locator('summary').click();
      assert.notEqual(await optional.getAttribute('open'), null);
      await optional.locator('input[name="subject"]').fill('Science');
      await check('home-rooms');
      assert.deepEqual(errors, [], `${width}: no script exceptions`);
    } finally { await context.close(); }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`V5 first-run and Home: ${report.cases.length} screenshots; four widths, distinct sample/own pathways, source honesty, optional fields and no overflow.`);
