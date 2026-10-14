import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.STUDIGO_UI_TEST_URL ?? 'http://localhost:3102';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture only');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let aiRequests = 0;
  page.on('dialog', async (dialog) => {
    assert.match(dialog.message(), /Earlier chats remain stored, and your mastery is kept/);
    await dialog.accept();
  });
  await page.route('**/api/dev/coach', async (route) => {
    aiRequests += 1;
    await route.fulfill({
      contentType: 'text/event-stream; charset=utf-8',
      body: [
        'data: {"type":"start","conversationId":"fixture-coach"}',
        'data: {"type":"delta","text":"Coach fixture reply"}',
        'data: {"type":"done","text":"Coach fixture reply","citations":[],"grounded":true}',
        ''
      ].join('\n\n')
    });
  });
  await page.goto(`${base}/dev/study`, { waitUntil: 'networkidle', timeout: 60_000 });
  const chat = page.locator('.coachChat');
  const input = chat.getByRole('textbox', { name: 'Message Studigo' });
  const choose = (mode) => page.locator('.chatModes button').filter({ hasText: mode }).click();

  await input.fill('Coach fixture question');
  await chat.getByRole('button', { name: 'Send to Studigo' }).click();
  await chat.getByText('Coach fixture reply', { exact: true }).waitFor();
  await choose('Learn');
  await chat.getByRole('button', { name: 'How Learn works' }).click();
  await chat.getByText('What Learn does', { exact: true }).waitFor();
  await input.fill('Unsent Learn draft');
  await chat.getByRole('button', { name: 'Clear Learn' }).click();
  await chat.getByText('Understand it.', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), '');
  assert.equal(await chat.getByText('What Learn does', { exact: true }).count(), 0);

  await choose('Coach');
  assert.equal(await chat.getByText('Coach fixture question', { exact: true }).count(), 1);
  assert.equal(await chat.getByText('Coach fixture reply', { exact: true }).count(), 1);
  await chat.getByRole('button', { name: 'Clear Coach' }).click();
  await chat.getByText('Practice it.', { exact: true }).waitFor();
  await chat.getByRole('button', { name: 'Clear Coach' }).click();
  assert.equal(await chat.getByText('Practice it.', { exact: true }).count(), 1);
  assert.equal(aiRequests, 1, 'switching and Clear must not call the provider');
  console.log('PASS C02 local UI: Clear is mode-specific, visible when empty, and repeatable');
} finally {
  await browser.close();
}
