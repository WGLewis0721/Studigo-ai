import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Regression for the owner-reported desktop speech button wrapping beneath
// the input. These are real components with synthetic content, not hardware
// Safari/VoiceOver or hosted learner-persistence acceptance.
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/phase3-visual/messenger';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-gpu']
  } : {})
});
const report = { provenance: 'Synthetic room, real DOM and computed CSS, DPR 1; no private learner data.', cases: [] };
const referenceStyles = new Map();
try {
  for (const [width, height] of [[320, 700], [390, 844], [820, 1180], [1440, 900]]) {
    for (const ui of ['legacy', 'phase3']) {
      for (const mode of ['coach-voice', 'coach']) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
        try {
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const voice = mode === 'coach-voice';
          await page.goto(`${origin}/dev/study?shell=1&ui=${ui}&${voice ? 'learn=explore' : `mode=${mode}`}`, { waitUntil: 'networkidle' });
          if (voice) await page.getByRole('group', { name: 'How Studigo helps' }).getByRole('button', { name: /^Coach, practice/ }).click();
          const dock = page.locator('.chatDock');
          const input = dock.getByRole('textbox');
          const send = dock.getByRole('button', { name: 'Send to Studigo' });
          const mic = dock.getByRole('button', { name: 'Speak a draft answer' });
          await input.waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await mic.count(), voice ? 1 : 0);
          assert.equal(await send.isDisabled(), true);
          const inspect = () => dock.evaluate(el => {
            const selectors = ['.chatEraser', '.chatRow > input', '.voiceMicButton', '.chatSend'];
            const controls = selectors.flatMap(selector => {
              const node = el.querySelector(selector);
              if (!node) return [];
              const r = node.getBoundingClientRect(), s = getComputedStyle(node);
              return [{ selector, x: r.x, y: r.y, w: r.width, h: r.height,
                style: { radius: s.borderRadius, font: s.fontSize, color: s.color,
                  background: s.backgroundColor, border: s.border, shadow: s.boxShadow } }];
            });
            return { height: el.getBoundingClientRect().height, controls,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
          });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const empty = await inspect();
          assert.equal(empty.overflow, 0, `page overflow: ${width}/${ui}/${mode}`);
          assert.equal(empty.height, 60, `one 44px row plus 8px padding: ${width}/${ui}/${mode}`);
          for (const [i, c] of empty.controls.entries()) {
            assert.ok(c.h >= 43.95 && c.w >= 43.95, `44px control: ${JSON.stringify(c)}`);
            assert.ok(Math.abs(c.y - empty.controls[0].y) < 1, `same baseline: ${JSON.stringify(empty)}`);
            if (i) assert.ok(c.x >= empty.controls[i - 1].x + empty.controls[i - 1].w, 'controls must not overlap');
          }
          assert.ok(empty.controls.find(c => c.selector === '.chatRow > input').w >= 120, 'companion must preserve writing space');
          const styles = empty.controls.map(c => ({ selector: c.selector, ...c.style }));
          const key = `${ui}/${mode}`;
          if (referenceStyles.has(key)) assert.deepEqual(styles, referenceStyles.get(key), `phone/desktop style parity: ${width}/${key}`);
          else referenceStyles.set(key, styles);
          await dock.screenshot({ path: `${output}/${width}-${ui}-${mode}-empty.png`, animations: 'disabled' });
          await input.pressSequentially('Can you explain this?');
          await page.waitForFunction(() => !document.querySelector('.chatSend')?.disabled, null, { timeout: 10000 }).catch(async error => {
            console.log('Send diagnostics', await input.inputValue(), await dock.innerHTML()); throw error;
          });
          assert.equal(await send.isEnabled(), true);
          await input.focus();
          await page.keyboard.press('Tab');
          assert.equal(await (voice ? mic : send).evaluate(el => el === document.activeElement), true, 'keyboard follows visual order');
          if (voice) {
            await page.keyboard.press('Enter');
            const dialog = page.getByRole('dialog', { name: 'Voice response draft' });
            await dialog.waitFor();
            assert.equal(await dialog.getByRole('button', { name: 'Start speaking' }).isDisabled(), true, 'voice still requires explicit consent');
            await page.keyboard.press('Escape');
            assert.equal(await mic.evaluate(el => el === document.activeElement), true);
            assert.equal(await input.inputValue(), 'Can you explain this?');
          }
          assert.equal((await inspect()).height, empty.height, 'typing and voice dialog must not resize the bar');
          await dock.screenshot({ path: `${output}/${width}-${ui}-${mode}-typed.png`, animations: 'disabled' });
          // Enlarge text without replacing the responsive viewport with a
          // smaller one; this is CSS text reflow, not hardware browser zoom.
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          const large = await inspect();
          assert.equal(large.overflow, 0, '200% text must not cause horizontal page overflow');
          assert.ok(large.controls.every(c => c.h >= 44 && c.w >= 44), 'text enlargement retains usable controls');
          assert.deepEqual(errors, []);
          report.cases.push({ width, height, ui, mode, empty, enlargedText: large });
        } finally { await context.close(); }
      }
    }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`Messenger: ${report.cases.length} four-width mode/flag cases passed; empty/typed, speech consent, keyboard order, CSS 200% text and shared visual styles.`);
