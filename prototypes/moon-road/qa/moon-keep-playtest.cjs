// POC IX Moon Keep browser acceptance. Real keyboard, mouse and CDP multitouch only;
// reads window.gameState()/pocEvents() and never mutates game state.
// Usage: node qa/moon-keep-playtest.cjs  (PLAYWRIGHT_CHROMIUM_EXECUTABLE optional)
const fs = require('fs'), path = require('path'), http = require('http');
let chromium;
try { ({chromium} = require('playwright')); } catch { ({chromium} = require('playwright-core')); }

const root = path.resolve(__dirname, '..'), evidence = __dirname;
const TYPES = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json'};
const server = http.createServer((req, res) => {
  let file = path.join(root, 'dist', decodeURIComponent(req.url.split('?')[0]));
  if (file.endsWith(path.sep)) file += 'index.html';
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.readFile(file, (e, data) => { res.statusCode = e ? 404 : 200; res.end(e ? 'Not found' : data); });
});

const results = {date: new Date().toISOString(), viewport: {}, checks: {}, notes: []};
const check = (name, ok, detail) => { results.checks[name] = {ok: !!ok, ...(detail === undefined ? {} : {detail})}; console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };

let lastPage = null;
async function open(browser, url, opts = {}) {
  const page = await browser.newPage({viewport: {width: 960, height: 540}, ...opts});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.gameState && document.querySelector('#loading').hidden);
  lastPage = page;
  return {page, errors};
}

function driver(page) {
  const S = () => page.evaluate(() => gameState());
  const wait = ms => page.waitForTimeout(ms);
  const key = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const walkUntil = async (k, pred, timeout = 8000) => {
    await page.keyboard.down(k);
    const t0 = Date.now();
    let s;
    while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) break; await wait(40); }
    await page.keyboard.up(k);
    return s;
  };
  const R = {
    S, wait, key, walkUntil,
    async toRoom(dir, room, timeout = 25000, fire = true) {
      const t0 = Date.now(), sign = dir === 'd' ? 1 : -1;
      let s = await S(), walking = false;
      if (fire) await page.keyboard.down('f');
      while (Date.now() - t0 < timeout) {
        s = await S();
        if (s.room === room) break;
        const threat = fire && s.targets.find(t => t.kind === 'skeleton' && (t.x - s.x) * sign > 0 && Math.abs(t.x - s.x) < 260 && Math.abs(t.y - s.y + 40) < 120);
        if (threat) {
          const pick = [4, 3, 2].find(w => s.owned[w] && s.ammo[w] > 0 && (w === threat.a || w === threat.b)) || 1;
          if (pick !== s.weapon) await key(String(pick));
        }
        if (threat && walking) { await page.keyboard.up(dir); walking = false; }
        if (threat && !walking && (threat.x - s.x) * s.face <= 0) await key(dir, 20);
        if (!threat && !walking) { await page.keyboard.down(dir); walking = true; }
        await wait(40);
      }
      if (walking) await page.keyboard.up(dir);
      if (fire) await page.keyboard.up('f');
      await wait(350);
      if (s.room !== room) throw new Error(`did not reach ${room}; at ${s.room} ${s.x},${s.y}`);
      return s;
    },
    async shootUntil(pred, faceKey, timeout = 15000, weapon) {
      if (weapon) await key(String(weapon));
      await key(faceKey, 40);
      await page.keyboard.down('f');
      const t0 = Date.now();
      let s;
      while (Date.now() - t0 < timeout) { s = await S(); if (pred(s)) break; await wait(50); }
      await page.keyboard.up('f');
      return s;
    },
    async walkTo(x, tol = 10) {
      const s = await S();
      if (Math.abs(s.x - x) <= tol) return s;
      const dir = s.x < x ? 'd' : 'a';
      return walkUntil(dir, s => (dir === 'd' ? s.x >= x - tol : s.x <= x + tol), 6000);
    },
    async hop(tx, ty, delay = 0) {
      await page.keyboard.down('Space');
      let s, dir = null;
      const t0 = Date.now();
      while (Date.now() - t0 < 2500) {
        s = await S();
        const want = Date.now() - t0 < delay || Math.abs(s.x - tx) < 10 ? null : s.x < tx ? 'd' : 'a';
        if (want !== dir) { if (dir) await page.keyboard.up(dir); if (want) await page.keyboard.down(want); dir = want; }
        if (s.ground && Date.now() - t0 > 250) break;
        await wait(16);
      }
      if (dir) await page.keyboard.up(dir);
      await page.keyboard.up('Space');
      await wait(120);
      s = await S();
      return Math.abs(s.y - ty) < 2;
    },
    async climb(steps) {
      for (const [from, tx, ty, label, delay] of steps) {
        let ok = false;
        for (let i = 0; i < 3 && !ok; i++) { if (from !== null) await R.walkTo(from); ok = await R.hop(tx, ty, delay); }
        if (!ok) throw new Error('climb failed at ' + label);
      }
    },
    async answerOrb(correct = true) {
      await key('e');
      await page.waitForSelector('#question:not([hidden])', {timeout: 3000});
      const q = (await S()).question, want = q.family * q.k;
      const vals = await page.$$eval('#answers button', bs => bs.map(b => +b.textContent));
      const v = correct ? want : vals.find(x => x !== want);
      await page.click(`#answers button:text-is("${v}")`);
      await wait(300);
      return q;
    },
    async bossFight(timeout = 120000) {
      const t0 = Date.now();
      let s, lastJump = 0;
      await page.keyboard.down('f');
      while (Date.now() - t0 < timeout) {
        s = await S();
        if (!s.boss || !s.boss.alive || s.mode !== 'play') break;
        const plate = s.boss.plates[s.boss.index];
        if (plate) {
          const fits = w => (w === 1 ? plate.a === 1 || plate.b === 1 : w === plate.a || w === plate.b);
          const pick = [4, 3, 2, 1].find(w => s.owned[w] && (w === 1 || s.ammo[w] > 0) && fits(w));
          if (pick && pick !== s.weapon) await key(String(pick));
        }
        const t = s.targets[0];
        if (t) {
          const dx = t.x - s.x, dir = dx > 0 ? 'd' : 'a', away = dx > 0 ? 'a' : 'd';
          if (Math.abs(dx) < 200 && s.x > 120 && s.x < 840) { await key(away, 120); await key(dir, 20); } else await key(dir, 20);
        }
        if (Date.now() - lastJump > 1400) { lastJump = Date.now(); await key('Space', 300); }
        await wait(60);
      }
      await page.keyboard.up('f');
      await wait(1800);
      return S();
    },
  };
  R.lowerShaft = () => R.climb([[null, 420, 2016, '63'], [490, 620, 1920, '60'], [560, 430, 1824, '57'], [490, 620, 1728, '54'], [560, 330, 1632, '51'], [250, 130, 1568, 'ledge49']]);
  R.upperShaft = () => R.climb([[200, 380, 1408, '44'], [450, 600, 1248, '39'], [540, 330, 1088, '34'], [400, 540, 928, '29'], [600, 670, 768, '24'], [null, 600, 608, '19'], [690, 800, 480, 'ledgeH']]);
  return R;
}

const shot = (page, name) => page.screenshot({path: path.join(evidence, `moon-keep-${name}.png`)});
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

// 1. Learning loop: x1 on a seal, wrong answer, cooldown, pause freeze, different retry.
async function learningLoop(browser, url) {
  const {page, errors} = await open(browser, url);
  const R = driver(page);
  await page.click('#start');
  for (const r of ['B', 'C', 'D', 'E']) await R.toRoom('d', r);
  await R.toRoom('d', 'F', 8000, false);
  await R.wait(1800);
  let s = await R.bossFight();
  check('twin-warden-beaten-with-x1', s.boss?.alive === false, s.boss?.plates);
  await R.walkTo(760, 20);
  const before = (await page.evaluate(() => pocEvents())).length;
  await R.shootUntil(s => false, 'd', 900, 1);
  const ev = (await page.evaluate(() => pocEvents())).slice(before);
  const reflect = ev.find(e => e.type === 'reflect' && e.target.kind === 'seal' && e.weapon === 1);
  check('x1-reflects-off-seal', reflect && !ev.some(e => e.type === 'hit' && e.target.kind === 'seal'), reflect?.target);
  await shot(page, 'seal-reflect');
  await R.walkTo(464, 20);
  await R.wait(400);
  s = await R.S();
  check('boss-drops-x2', s.owned[2] && s.ammo[2] === 12 && s.items.includes('w2'), {x: s.x, owned: s.owned, ammo: s.ammo, weapon: s.weapon, items: s.items});
  s = await R.shootUntil(s => s.items.includes('seal-g'), 'd', 6000, 2);
  check('x2-opens-1x2-seal', s.items.includes('seal-g'));
  await R.toRoom('d', 'G', 8000, false);
  await R.walkTo(380);
  await R.hop(496, 448);
  s = await R.S();
  check('moon-boots-collected', s.boots);
  await R.toRoom('a', 'F', 8000, false);
  await R.toRoom('a', 'E', 8000, false);
  await R.walkTo(470, 15);
  s = await R.S();
  need(s.nearOrb === 'shrine-E-x2', 'not at E orb: ' + s.nearOrb);
  // NOT NOW leaves without cooldown.
  await R.key('e');
  await page.waitForSelector('#question:not([hidden])');
  await page.click('#skip');
  await R.wait(300);
  s = await R.S();
  check('not-now-has-no-cooldown', s.mode === 'play' && s.nearOrb === 'shrine-E-x2');
  const q1 = await R.answerOrb(false);
  await shot(page, 'wrong-answer');
  s = await R.S();
  const wrong = (await page.evaluate(() => pocEvents())).filter(e => e.type === 'wrong').pop();
  check('wrong-answer-returns-to-play-no-reveal', s.mode === 'play' && s.nearOrb === null && !(await page.locator('#question').isVisible()) && s.hearts === 5, {q1, notice: await page.textContent('#notice')});
  // Pause for 3 s: active clock must not move.
  await R.key('Escape');
  const a0 = (await R.S()).active;
  await R.wait(3000);
  const paused = await R.S();
  const a1 = paused.active;
  await R.key('Escape');
  check('pause-freezes-active-clock', paused.mode === 'paused' && a1 === a0, {a0, a1});
  // Wait in play for the orb to return.
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) { s = await R.S(); if (s.nearOrb) break; await R.wait(100); }
  const back = (await page.evaluate(() => pocEvents())).find(e => e.type === 'respawn' && e.id === 'shrine-E-x2');
  const interval = back ? +(back.t - wrong.t).toFixed(3) : null;
  check('orb-returns-after-20-active-seconds', interval !== null && interval >= 20 && interval < 20.2, {interval});
  const q2 = await R.answerOrb(true);
  s = await R.S();
  check('retry-uses-different-fact', q2.k !== q1.k && q2.family === q1.family, {q1, q2});
  check('correct-refills-to-capacity', s.ammo[2] === s.cap[2], s.ammo);
  check('learning-loop-no-page-errors', errors.length === 0, errors);
  await page.close();
}

// 2. Complete run: every room, item, seal, block and both bosses, then the finale.
async function fullRun(browser, url) {
  const {page, errors} = await open(browser, url);
  const R = driver(page), S = R.S;
  await page.click('#start');
  await shot(page, 'start');
  for (const r of ['B', 'C', 'D', 'E']) await R.toRoom('d', r);
  await R.toRoom('d', 'F', 8000, false);
  await R.wait(1600);
  await shot(page, 'twin-warden');
  let s = await R.bossFight();
  need(s.boss?.alive === false, 'twin alive');
  await R.walkTo(464, 20);
  await R.wait(400);
  await R.shootUntil(s => s.items.includes('seal-g'), 'd', 6000, 2);
  await R.toRoom('d', 'G', 8000, false);
  await R.walkTo(380);
  await R.hop(496, 448);
  for (const r of ['F', 'E', 'D', 'C']) await R.toRoom('a', r);
  await R.walkTo(290);
  await R.lowerShaft();
  await R.answerOrb(true);
  await R.upperShaft();
  check('moon-boots-climb-upper-shaft', (await S()).y === 480);
  await R.shootUntil(s => s.items.includes('seal-h'), 'd', 6000, 2);
  await R.toRoom('d', 'H');
  await R.walkTo(1000);
  await R.hop(1060, 384);
  s = await R.shootUntil(s => s.items.includes('block-4'), 'd', 8000, 2);
  await shot(page, 'block-count');
  const blockEv = (await page.evaluate(() => pocEvents())).filter(e => e.type === 'hit' && e.target.kind === 'block');
  check('block-4-breaks-with-two-x2-hits', s.items.includes('block-4') && blockEv.length === 2, blockEv.length);
  await R.hop(1232, 288);
  await R.toRoom('d', 'I');
  await R.walkTo(420);
  await R.answerOrb(true);
  await R.toRoom('d', 'J', 8000, false);
  await R.wait(1600);
  setTimeout(() => shot(page, 'trine-guardian').catch(() => {}), 5000);
  s = await R.bossFight(150000);
  need(s.boss?.alive === false, 'trine alive');
  await R.walkTo(464, 20);
  await R.wait(400);
  for (const r of ['I', 'H', 'C']) await R.toRoom('a', r);
  s = await walkOrClimbToVaultLedge(R);
  await R.walkTo(170, 12);
  await R.answerOrb(true);
  s = await R.shootUntil(s => s.items.includes('block-9'), 'a', 8000, 3);
  check('x3-breaks-block-9', s.items.includes('block-9'));
  await R.toRoom('a', 'K', 8000, false);
  await R.walkTo(320);
  await R.answerOrb(true);
  await R.toRoom('d', 'C', 12000, false);
  s = await S();
  check('vault-orb-unlocks-x4', s.owned[4] && s.items.includes('orb-4') && s.items.includes('tank2'));
  await R.walkUntil('d', s => s.ground && s.y === 2112, 12000);
  await R.walkTo(290);
  await R.lowerShaft();
  await R.toRoom('a', 'B');
  await R.walkTo(1040);
  await R.hop(1060, 384);
  await R.walkTo(1120);
  await R.hop(1260, 224, 330);
  await R.walkTo(1300);
  s = await R.shootUntil(s => s.items.includes('seal-b'), 'd', 8000, 4);
  check('x4-opens-4x4-closet', s.items.includes('seal-b'));
  await R.walkTo(1776, 12);
  await R.wait(300);
  await R.walkUntil('a', s => s.ground && s.y === 480, 8000);
  await R.toRoom('d', 'C', 15000);
  await R.walkTo(100, 12);
  if ((await S()).nearOrb) await R.answerOrb(true);
  await R.walkUntil('d', s => s.ground && s.y === 2112, 12000);
  await R.toRoom('d', 'D');
  await R.walkTo(500);
  await R.hop(560, 384);
  await R.shootUntil(s => s.items.includes('block-6'), 'd', 8000, (await S()).ammo[3] >= 2 ? 3 : 2);
  await R.hop(720, 288);
  await R.toRoom('a', 'C');
  await R.walkTo(290);
  await R.lowerShaft();
  await R.upperShaft();
  for (const r of ['H', 'I', 'J', 'L']) await R.toRoom('d', r);
  await R.walkTo(560, 20);
  await R.wait(600);
  s = await S();
  await shot(page, 'finish');
  const all = ['tank1', 'tank2', 'tank3', 'x2exp', 'x3exp', 'boots', 'orb-4'];
  check('full-run-100-percent', s.mode === 'finish' && s.mapPercent === 100 && all.every(i => s.items.includes(i)), {mapPercent: s.mapPercent, hearts: `${s.hearts}/${s.maxHearts}`, cap: s.cap});
  const events = await page.evaluate(() => pocEvents());
  fs.writeFileSync(path.join(evidence, 'moon-keep-events.json'), JSON.stringify(events, null, 1));
  const deaths = events.filter(e => e.type === 'death').length;
  results.notes.push(`Full run: ${events.filter(e => e.type === 'room').length} room entries, ${deaths} deaths, ${events.filter(e => e.type === 'reflect').length} reflections, ${events.filter(e => e.type === 'correct').length} correct orb answers.`);
  await page.click('#explore');
  await R.key('m');
  await R.wait(300);
  await shot(page, 'map');
  await R.key('m');
  await R.walkTo(360, 20);
  await R.walkTo(560, 20);
  await page.waitForSelector('#finish:not([hidden])', {timeout: 3000});
  await page.click('#enter-boss');
  await page.waitForURL(/poc-vii\/boss\.html/, {timeout: 5000}).catch(() => {});
  check('finale-opens-core-clash', /poc-vii\/boss\.html/.test(page.url()));
  check('full-run-no-page-errors', errors.length === 0, errors);
  await page.close();
}

async function walkOrClimbToVaultLedge(R) {
  let s = await R.walkUntil('a', s => s.ground && s.y === 1024 && s.x < 240, 9000);
  if (s.y !== 1024) await R.climb([[null, 330, 1088, '34'], [260, 150, 1024, 'ledgeK']]);
  return R.S();
}

// 3. Phone: 844x390 landscape, simultaneous touch move + fire + jump.
async function touch(browser, url) {
  const {page, errors} = await open(browser, url, {viewport: {width: 844, height: 390}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
  results.viewport.touch = '844x390 hasTouch isMobile';
  const cdp = await page.context().newCDPSession(page);
  const centre = async sel => { const b = await page.locator(sel).boundingBox(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; };
  const touches = async (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map((p, i) => ({x: p.x, y: p.y, id: p.id ?? i}))});
  await page.tap('#start');
  await page.waitForTimeout(300);
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
  check('touch-no-page-overflow', noScroll);
  const right = {...(await centre('#right')), id: 1}, fire = {...(await centre('#fire')), id: 2}, jump = {...(await centre('#jump')), id: 3};
  const s0 = await page.evaluate(() => gameState());
  await touches('touchStart', [right, fire]);
  await page.waitForTimeout(700);
  await touches('touchStart', [right, fire, jump]);
  await page.waitForTimeout(250);
  await touches('touchEnd', [right, fire]);
  await page.waitForTimeout(80);
  await touches('touchEnd', []);
  await page.waitForTimeout(400);
  const s1 = await page.evaluate(() => gameState());
  const ev = await page.evaluate(() => pocEvents());
  check('touch-simultaneous-move-fire-jump', s1.x > s0.x + 100 && ev.some(e => e.type === 'shot') && ev.some(e => e.type === 'jump'), {dx: +(s1.x - s0.x).toFixed(1), shots: ev.filter(e => e.type === 'shot').length});
  await page.screenshot({path: path.join(evidence, 'moon-keep-touch.png')});
  const sizes = await page.$$eval('#controls button', bs => bs.map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  check('touch-targets-at-least-40px', Math.min(...sizes) >= 40, {min: +Math.min(...sizes).toFixed(1)});
  // Beta restart: confirm, cancel back to play, then restart for real.
  await page.tap('#restart-btn');
  const asked = await page.evaluate(() => ({mode: gameState().mode, shown: !document.querySelector('#confirm-restart').hidden}));
  await page.tap('#restart-no');
  const cancelled = await page.evaluate(() => gameState().mode);
  await page.tap('#restart-btn');
  await Promise.all([page.waitForEvent('load'), page.tap('#restart-yes')]);
  await page.waitForFunction(() => window.gameState && document.querySelector('#loading').hidden);
  const fresh = await page.evaluate(() => gameState());
  check('restart-button-confirms-and-restarts', asked.mode === 'confirm' && asked.shown && cancelled === 'play' && fresh.mode === 'intro' && fresh.x === 272 && fresh.visited.length === 1, {asked, cancelled, fresh: {mode: fresh.mode, room: fresh.room, x: fresh.x}});
  check('touch-no-page-errors', errors.length === 0, errors);
  await page.close();
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/poc-ix/`;
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true});
  results.viewport.desktop = '960x540';
  const only = process.env.ONLY;
  try {
    if (!only || only === 'loop') await learningLoop(browser, url);
    if (!only || only === 'full') await fullRun(browser, url);
    if (!only || only === 'touch') await touch(browser, url);
  } catch (e) {
    let state = null;
    try {
      state = await lastPage.evaluate(() => ({s: gameState(), events: pocEvents().slice(-25)}));
      await lastPage.screenshot({path: path.join(evidence, 'moon-keep-failure.png')});
    } catch { /* page may be gone */ }
    check('scenario-completed', false, {error: e.message, state});
  }
  await browser.close();
  server.close();
  results.passed = Object.values(results.checks).every(c => c.ok);
  fs.writeFileSync(path.join(evidence, 'moon-keep-results.json'), JSON.stringify(results, null, 2));
  console.log(results.passed ? 'ALL PASSED' : 'FAILURES', results.notes.join(' '));
  process.exit(results.passed ? 0 : 1);
})();
