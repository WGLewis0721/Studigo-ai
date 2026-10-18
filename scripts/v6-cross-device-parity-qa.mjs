import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/** Release parity gate: same source/state and accessible destinations; NOT identical placement. */
const origin = process.env.PHASE3_VISUAL_BASE_URL ?? 'http://127.0.0.1:3000';
const output = 'artifacts/phase3-visual/v6-parity';
const modes = [
  ['coach','Coach'], ['quiz','Practice'], ['cards','Practice'],
  ['test','Practice'], ['mastery','Progress'], ['weak','Progress'],
  ['plan','Plan'], ['cram','Plan'], ['materials','Materials']
];
const expectedSections = ['Coach','Practice','Progress','Plan','Materials'];
const sizes = [[320,700],[390,844],[820,1180],[1440,900]];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  kind: 'V6 cross-device same-fixture interaction and layout parity',
  evidence: 'synthetic Study Room component at same source revision and saved state',
  excludes: ['real Supabase user/grade/source', 'physical iPhone/iPad', 'native VoiceOver', '200% OS text configuration'],
  intentional: 'phone bottom navigator and desktop top navigator may have different placement, not different actions',
  cases: []
};
try {
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const [mode, group] of modes) {
        const url = `${origin}/dev/study?shell=1&mode=${mode}&ui=phase3`;
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        assert.equal(response?.status(), 200, `${width} ${mode}: fixture responds`);
        await page.evaluate(() => document.fonts.ready);
        const nav = page.locator('nav.studyGroups:visible');
        assert.equal(await nav.count(), 1, `${width} ${mode}: one visible room navigator`);
        const labels = await nav.locator('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
        assert.deepEqual(labels, expectedSections, `${width} ${mode}: exact five accessible destinations`);
        const active = await nav.locator('button[aria-current="page"]').getAttribute('aria-label');
        assert.equal(active, group, `${width} ${mode}: section identity survives subpage selection`);
        const bounds = await nav.locator('button').evaluateAll(nodes => nodes.map(n => {
          const r=n.getBoundingClientRect(); return {w:r.width,h:r.height};
        }));
        assert.ok(bounds.every(r => r.w>=43.95 && r.h>=43.95),
          `${width} ${mode}: all navigation targets are >=44px`);
        const overflow = await page.evaluate(() => Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
        assert.ok(overflow<=1, `${width} ${mode}: horizontal overflow ${overflow}px`);
        const navY = await nav.evaluate(node => node.getBoundingClientRect().top);
        assert.ok(width<=700 ? navY>height*0.5 : navY<height*0.5,
          `${width} ${mode}: intentional bottom-vs-top placement`);
        const shell = await page.locator('.roomDevice').getAttribute('data-shell');
        if (mode==='plan') {
          const details = page.locator('.studyPlanPanel .planDay');
          assert.ok(await details.count()>0, 'plan uses one saved-evidence daily timeline');
          const controls = page.locator('.studyPlanPanel .planActionButtons button:visible');
          assert.ok(await controls.count()>0, 'plan keeps Start/mark/skip actions');
          const actionHeights = await controls.evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
          assert.ok(actionHeights.every(h => h>=43.95), `${width}: plan action targets remain 44px; got ${actionHeights}`);
        }
        if (mode==='materials') {
          assert.equal(await page.locator('.materialsPanel').count(), 1, 'only one Materials surface');
        }
        if (['coach','plan','materials'].includes(mode)) {
          await page.screenshot({ path: `${output}/${width}-${mode}.png`, fullPage: true, animations: 'disabled' });
        }
        report.cases.push({ width,height,mode,selected:active,sections:labels,shell,overflow,navY,navTargets:bounds });
      }
      // A simulated 200% web text size is a *reflow probe*, not hardware Dynamic Type.
      for (const mode of ['plan','materials']) {
        await page.goto(`${origin}/dev/study?shell=1&mode=${mode}&ui=phase3`, { waitUntil: 'networkidle' });
        await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
        const extra = await page.evaluate(() => Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
        assert.ok(extra<=1, `${width} ${mode}: text enlargement cannot create page-wide horizontal overflow (${extra}px)`);
        if (mode==='plan') {
          const clipped = await page.locator('.planDayActions h3:visible').evaluateAll(nodes => nodes.some(n => {
            const r=n.getBoundingClientRect(), p=n.parentElement?.getBoundingClientRect();
            return p && (r.left<p.left-1 || r.right>p.right+1);
          }));
          assert.ok(!clipped, `${width}: long Plan headings must reflow inside cards`);
        }
        await page.screenshot({ path: `${output}/${width}-${mode}-200pct-text.png`, fullPage: true, animations: 'disabled' });
        report.cases.push({ width,mode,simulatedTextZoom:'200%',overflow:extra });
      }
      assert.deepEqual(errors, [], `${width}: no JS page exceptions`);
    } finally { await context.close(); }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(`V6: ${report.cases.length} parity/reflow observations across nine modes and four widths, with intentional nav placement preserved.`);
