import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3213';
const server = spawn('node', ['node_modules/next/dist/bin/next', 'dev', '--port', '3213'], {
  cwd: new URL('../apps/web/', import.meta.url),
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'ignore'
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Fixture server exited: ${server.exitCode}`);
    try { if ((await fetch(`${base}/dev/study?mode=coach`)).ok) { ready = true; break; } }
    catch { /* Startup is still in progress. */ }
    await delay(1000);
  }
  assert.ok(ready, 'Fixture server did not become ready');
  browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let calls = 0;
  await page.route('**/api/dev/coach', async (route) => {
    calls += 1;
    const events = calls === 1
      ? [
          { type: 'start', conversationId: 'learn-thread' },
          { type: 'outcome', outcome: { reasonCode: 'no_relevant_evidence', retryable: false, counts: { ready: 1, processing: 0, failed: 0 }, coverageIds: ['source'] } }
        ]
      : [
          { type: 'start', conversationId: 'learn-thread' },
          { type: 'outcome', outcome: { reasonCode: 'ready', retryable: false, counts: { ready: 1, processing: 0, failed: 0 }, coverageIds: ['source'] } },
          { type: 'delta', text: 'Inherited traits come from parents [1].' },
          { type: 'done', text: 'Inherited traits come from parents [1].', grounded: true, citations: [{ marker: 1, chunkId: 'chunk-1', documentId: 'source', documentName: 'Study guide.pdf', pageNumber: 2, pageLabel: 'Page' }] }
        ];
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') });
  });
  await page.goto(`${base}/dev/study?mode=coach`);
  await page.getByRole('button', { name: /Learn Facts, with sources/ }).click();
  await page.locator('.coachChat[data-chat-mode="learn"]').waitFor();
  const input = page.getByRole('textbox', { name: 'Message Studigo' });
  await input.fill('What is an inherited trait?');
  await page.getByRole('button', { name: 'Send to Studigo' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Send to Studigo' }).click();
  await page.getByText(/materials are available, but I could not find a passage/i).waitFor();
  await page.getByRole('button', { name: 'See topics' }).waitFor();
  assert.equal(await page.locator('.answerBubble').count(), 0, 'Failure must not leave a success-shaped answer');
  await input.fill('What are inherited traits?');
  await page.getByRole('button', { name: 'Send to Studigo' }).click();
  await page.getByText('Inherited traits come from parents [1].').waitFor();
  await page.getByRole('link', { name: /Study guide.pdf.*Page 2/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'See topics' }).count(), 0);
  assert.equal(calls, 2);
  assert.deepEqual(pageErrors, []);
  console.log('PASS: typed no-match recovery and legacy cited SSE answer render in Learn');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
