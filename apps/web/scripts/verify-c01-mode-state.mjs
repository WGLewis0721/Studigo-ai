import assert from "node:assert/strict";
import { chromium } from "playwright";

const scenario = process.argv[2];
if (!['two-mode', 'pending-coach'].includes(scenario)) throw new Error('Choose two-mode or pending-coach');
const base = process.env.STUDIGO_UI_TEST_URL ?? 'http://localhost:3102';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture only');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const writes = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const encoder = new TextEncoder();
    const requests = [];
    window.__c01 = {
      requests,
      push(index, event) {
        requests[index].controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      close(index) { requests[index].controller.close(); }
    };
    window.fetch = (input, init) => {
      if (input !== '/api/dev/coach') return originalFetch(input, init);
      const request = { body: JSON.parse(init.body), controller: null };
      requests.push(request);
      const stream = new ReadableStream({ start(controller) { request.controller = controller; } });
      return Promise.resolve(new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      }));
    };
  });
  await page.goto(`${base}/dev/study`, { waitUntil: 'networkidle', timeout: 60_000 });
  const thread = page.locator('.chatThread');
  const composer = page.locator('.chatComposer');
  const input = composer.getByRole('textbox', { name: 'Message Studigo' });
  const send = composer.getByRole('button', { name: 'Send to Studigo' });
  const choose = async (mode) => {
    const showDrawer = page.getByRole('button', { name: 'Show controls' });
    if (await showDrawer.count()) await showDrawer.click();
    await page.locator('.chatModes button').filter({ hasText: mode }).click();
    await page.locator('.coachChat').waitFor();
    assert.equal(await page.locator('.coachChat').getAttribute('data-chat-mode'), mode.toLowerCase());
  };
  const count = () => page.evaluate(() => window.__c01.requests.length);
  const push = (index, event) => page.evaluate(([i, data]) => window.__c01.push(i, data), [index, event]);
  const close = (index) => page.evaluate((i) => window.__c01.close(i), index);
  const submit = async (value, expectedCount) => {
    await input.fill(value);
    await send.click();
    await page.waitForFunction((expected) => window.__c01.requests.length === expected, expectedCount);
  };
  const longReply = (prefix) => `${prefix} ${'A grounded practice explanation. '.repeat(110)}`;

  if (scenario === 'two-mode') {
    await submit('Coach question', 1);
    await push(0, { type: 'start', conversationId: 'coach-thread' });
    await push(0, { type: 'delta', text: longReply('Coach reply') });
    await push(0, { type: 'done', grounded: true });
    await close(0);
    await page.getByText('Coach question', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.answerBubble .caret'));
    await input.fill('Unsent Coach draft');
    await thread.evaluate((node) => { node.scrollTop = 35; });
    const coachScroll = await thread.evaluate((node) => node.scrollTop);
    assert.ok(coachScroll > 0, 'Coach thread must be scrollable');

    await choose('Learn'); // 1
    assert.equal(await input.inputValue(), '');
    await submit('Learn question', 2);
    await push(1, { type: 'start', conversationId: 'learn-thread' });
    await push(1, { type: 'delta', text: longReply('Learn first chunk') });
    await page.getByText('Learn question', { exact: true }).waitFor();
    await thread.evaluate((node) => { node.scrollTop = 80; });
    const learnScroll = await thread.evaluate((node) => node.scrollTop);
    assert.ok(learnScroll > 0, 'Learn thread must be scrollable');

    await choose('Coach'); // 2, Learn still streaming
    assert.equal(await input.inputValue(), 'Unsent Coach draft');
    assert.equal(await send.isEnabled(), true, 'pending Learn must not disable Coach');
    assert.equal(await thread.getByText('Learn question', { exact: true }).count(), 0);
    await push(1, { type: 'delta', text: ' LATE LEARN CHUNK' });
    await page.waitForTimeout(100);
    assert.equal(await thread.getByText('LATE LEARN CHUNK', { exact: false }).count(), 0);
    assert.equal(await input.inputValue(), 'Unsent Coach draft');
    assert.equal(await count(), 2, 'switching must not call AI');
    assert.equal(await thread.evaluate((node) => node.scrollTop), coachScroll);

    await choose('Learn'); // 3
    await page.getByText('LATE LEARN CHUNK', { exact: false }).waitFor();
    assert.equal(await send.isEnabled(), false, 'pending Learn must disable Learn send');
    assert.equal(await thread.evaluate((node) => node.scrollTop), learnScroll);
    await push(1, { type: 'done', grounded: true });
    await close(1);
    await page.waitForFunction(() => !document.querySelector('.answerBubble .caret'));
    await input.fill('Unsent Learn draft');
    await choose('Coach'); // 4
    assert.equal(await input.inputValue(), 'Unsent Coach draft');
    assert.equal(await thread.getByText('Coach question', { exact: true }).count(), 1);
    assert.equal(await thread.getByText('Learn question', { exact: true }).count(), 0);
    await choose('Learn'); // restore second draft/transcript
    assert.equal(await input.inputValue(), 'Unsent Learn draft');
    assert.equal(await thread.getByText('Learn question', { exact: true }).count(), 1);
    assert.equal(await thread.getByText('Coach question', { exact: true }).count(), 0);
    assert.equal(await count(), 2);

    await choose('Coach');
    await submit('Coach error question', 3);
    await push(2, { type: 'error', error: 'Coach-only failure' });
    await close(2);
    await page.getByText('Coach-only failure', { exact: true }).waitFor();
    await choose('Learn');
    assert.equal(await page.getByText('Coach-only failure', { exact: true }).count(), 0);
    await choose('Coach');
    assert.equal(await page.getByText('Coach-only failure', { exact: true }).count(), 1);
    console.log('PASS C01 check 1: two drafts, transcripts, late Learn stream, mode error, loading and scroll');
  } else {
    assert.equal(await page.locator('.coachAside').count(), 0, 'the redundant desktop information rail stays removed');
    assert.equal(await page.getByRole('button', { name: 'Open Materials' }).count(), 1, 'one Materials shortcut sits by the messenger');
    const composerHeight = await page.locator('.chatComposer .chatRow > input').evaluate((el) => el.getBoundingClientRect().height);
    const clearHeight = await page.getByRole('button', { name: 'Clear Coach chat' }).evaluate((el) => el.getBoundingClientRect().height);
    const sendHeight = await send.evaluate((el) => el.getBoundingClientRect().height);
    assert.equal(composerHeight, 48, 'the desktop message field has a stable 48px height');
    assert.equal(clearHeight, 44, 'Clear stays within 10% of the message field height');
    assert.equal(sendHeight, 44, 'Send and Clear use the same 44px geometry');
    const drawer = page.locator('.modeFrame').first();
    await page.waitForFunction(() => document.querySelector('.modeFrame')?.getAttribute('data-collapsed') === 'true', undefined, { timeout: 6500 });
    assert.equal(await drawer.locator('.modeStrip').getAttribute('inert'), '', 'idle drawer cannot trap tab focus');
    await page.getByRole('button', { name: 'Show controls' }).click();
    assert.equal(await drawer.getAttribute('data-collapsed'), 'false', 'drawer can be reopened');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.getByRole('button', { name: 'Open Materials' }).isVisible(), false, 'phone uses its Materials tab');
    assert.equal(await drawer.getAttribute('data-collapsed'), 'false', 'phone header stays open');
    assert.equal(await page.getByRole('button', { name: 'Hide controls' }).isVisible(), false, 'phone has no drawer toggle');
    await page.setViewportSize({ width: 1280, height: 900 });
    await submit('Pending Coach question', 1);
    await push(0, { type: 'start', conversationId: 'coach-thread' });
    assert.equal(await send.isEnabled(), false, 'Coach send disabled while pending');
    const writesBeforeSwitch = writes.length;
    await choose('Learn');
    assert.equal(await send.isEnabled(), false, 'empty Learn input cannot send');
    await input.fill('Independent Learn draft');
    assert.equal(await send.isEnabled(), true, 'pending Coach must not disable Learn');
    assert.equal(await count(), 1, 'switch must not make another AI request');
    assert.equal(writes.length, writesBeforeSwitch, 'switch must not write evidence');
    await push(0, { type: 'delta', text: 'COACH LATE RESULT' });
    await page.waitForTimeout(100);
    assert.equal(await thread.getByText('COACH LATE RESULT', { exact: false }).count(), 0);
    assert.equal(await input.inputValue(), 'Independent Learn draft');
    await choose('Coach');
    await page.getByText('COACH LATE RESULT', { exact: false }).waitFor();
    assert.equal(await send.isEnabled(), false, 'Coach remains pending after return');
    await choose('Learn');
    assert.equal(writes.length, writesBeforeSwitch);
    console.log('PASS C01 check 2: pending Coach switch makes no AI/evidence write; late Coach delta stays in Coach');
  }
} finally {
  await browser.close();
}
