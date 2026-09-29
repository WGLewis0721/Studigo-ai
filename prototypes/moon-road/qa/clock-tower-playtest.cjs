// POC X (Moon Keep II) browser acceptance: golden route to x4, then the Clock Tower, Clockwork Warden,
// x5 gate and Pendulum Trial. Real keyboard/mouse only; reads gameState()/pocEvents(), never mutates.
// Usage: node qa/clock-tower-playtest.cjs  (PLAYWRIGHT_CHROMIUM_EXECUTABLE optional)
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
const results = {date: new Date().toISOString(), viewport: '960x540', checks: {}, notes: []};
const check = (name, ok, detail) => { results.checks[name] = {ok: !!ok, ...(detail === undefined ? {} : {detail})}; console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };
const need = (c, m) => { if (!c) throw new Error(m); };

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
    async toRoom(dir, room, timeout = 60000, fire = true) {
      const t0 = Date.now(), sign = dir === 'd' ? 1 : -1;
      let s = await S(), walking = false;
      if (fire) await page.keyboard.down('f');
      while (Date.now() - t0 < timeout) {
        s = await S();
        if (s.room === room) break;
        const threat = fire && s.targets.find(t => (t.kind === 'skeleton' || t.kind === 'bat') && (t.x - s.x) * sign > 0 && Math.abs(t.x - s.x) < 260 && Math.abs(t.y - s.y + 40) < (t.kind === 'bat' ? 220 : 120));
        if (threat) {
          const pick = [5, 4, 3, 2].find(w => s.owned[w] && s.ammo[w] > 0 && (w === threat.a || w === threat.b)) || 1;
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
      await page.click(`#answers button:text-is("${correct ? want : vals.find(x => x !== want)}")`);
      await wait(300);
      return q;
    },
    async bossFight(timeout = 150000) {
      const t0 = Date.now();
      let s, lastJump = 0;
      await page.keyboard.down('f');
      while (Date.now() - t0 < timeout) {
        s = await S();
        if (s.mode === 'question' && s.question) {
          // Finish an open orb question by clicking the right answer.
          await page.click(`#answers button:text-is("${s.question.family * s.question.k}")`).catch(() => {});
          await wait(250);
          continue;
        }
        if (!s.boss || !s.boss.alive || s.mode !== 'play') break;
        const plate = s.boss.plates[s.boss.index];
        // Like a player would: out of the right ammo or low on hearts, go answer the boss orb.
        const stuck = plate && ![1, 2, 3, 4, 5].some(w => s.owned[w] && (w === 1 ? plate.a === 1 || plate.b === 1 : (w === plate.a || w === plate.b) && s.ammo[w] > 0));
        if ((stuck || s.hearts <= 2) && s.nearOrb && s.nearOrb.startsWith('bossorb')) {
          await page.keyboard.up('f');
          await key('e');
          await wait(250);
          await page.keyboard.down('f');
          continue;
        }
        if ((stuck || s.hearts <= 2) && s.boss.kind !== 'twin' && Math.abs(s.x - 224) > 40) { await key(s.x < 224 ? 'd' : 'a', 120); continue; }
        if (plate) {
          const trial = s.boss.kind === 'trial';
          const fits = w => (w === 1 ? trial || plate.a === 1 || plate.b === 1 : w === plate.a || w === plate.b);
          const pick = (trial && s.boss.problem?.glowing && s.owned[5] && s.ammo[5] > 0 ? [5] : []).concat([5, 4, 3, 2, 1]).find(w => s.owned[w] && (w === 1 || s.ammo[w] > 0) && fits(w));
          if (pick && pick !== s.weapon) await key(String(pick));
        }
        const t = s.targets[0];
        if (t) {
          const dx = t.x - s.x, dir = dx > 0 ? 'd' : 'a', away = dx > 0 ? 'a' : 'd';
          // A leaping Twin Warden passes overhead: hold position and let it land beyond.
          const leaping = s.boss.kind === 'twin' && t.y < 330;
          if (leaping) await key(dir, 10);
          else if (Math.abs(dx) < 200 && s.x > 120 && s.x < 840) { await key(away, 120); await key(dir, 20); } else await key(dir, 20);
        }
        const wave = (s.hazards || []).find(h => h.wave && Math.abs(h.x - s.x) < 150 && Math.sign(s.x - h.x) === Math.sign(h.vx));
        if (wave && s.ground) { lastJump = Date.now(); await key('Space', 420); }
        else if (s.boss.kind !== 'clock' && !(s.hazards || []).some(h => h.wave) && Date.now() - lastJump > 1400) { lastJump = Date.now(); await key('Space', 300); }
        await wait(60);
      }
      await page.keyboard.up('f');
      await wait(1800);
      return S();
    },
  };
  R.fight = async room => {
    for (let i = 0; i < 5; i++) {
      const s = await R.bossFight();
      if (s.boss?.alive === false) return {s, attempts: i + 1};
      while ((await S()).room !== room) await R.toRoom('d', room, 15000);
      await wait(1800);
    }
    throw new Error('boss not beaten in ' + room);
  };
  R.lowerShaft = () => R.climb([[null, 420, 2016, '63'], [490, 620, 1920, '60'], [560, 430, 1824, '57'], [490, 620, 1728, '54'], [560, 330, 1632, '51'], [250, 130, 1568, 'ledge49']]);
  R.upperShaft = () => R.climb([[200, 380, 1408, '44'], [450, 600, 1248, '39'], [540, 330, 1088, '34'], [400, 540, 928, '29'], [600, 670, 768, '24'], [null, 600, 608, '19'], [690, 800, 480, 'ledgeH']]);
  return R;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/poc-x/`;
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true});
  const page = await browser.newPage({viewport: {width: 960, height: 540}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  const shot = name => page.screenshot({path: path.join(evidence, `clock-tower-${name}.png`)}).catch(() => {});
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.gameState && document.querySelector('#loading').hidden);
    const R = driver(page), S = R.S;
    await page.click('#start');
    for (const r of ['B', 'C', 'D', 'E']) await R.toRoom('d', r);
    await shot('crypt');
    await R.toRoom('d', 'F', 8000, false);
    await R.wait(1600);
    await shot('twin-warden');
    let s = (await R.fight('F')).s;
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
    await R.shootUntil(s => s.items.includes('seal-h'), 'd', 6000, 2);
    await R.toRoom('d', 'H');
    await R.toRoom('d', 'I');
    await R.walkTo(420);
    await R.answerOrb(true);
    await R.toRoom('d', 'J', 8000, false);
    await R.wait(1600);
    await R.fight('J');
    await R.walkTo(464, 20);
    await R.wait(400);
    for (const r of ['I', 'H', 'C']) await R.toRoom('a', r);
    await R.walkUntil('a', s => s.ground && s.y === 1024 && s.x < 240, 9000);
    await R.walkTo(170, 12);
    await R.answerOrb(true);
    await R.shootUntil(s => s.items.includes('block-9'), 'a', 8000, 3);
    await R.toRoom('a', 'K', 8000, false);
    await R.walkTo(320);
    await R.answerOrb(true);
    await R.toRoom('d', 'C', 12000, false);
    s = await S();
    need(s.owned[4], 'no x4');
    await R.walkUntil('d', s => s.ground && s.y === 1088, 6000);
    await R.climb([[400, 540, 928, '29'], [460, 350, 768, '24'], [null, 300, 608, '19'], [266, 130, 480, 'ledgeM', 200]]);
    s = await R.shootUntil(s => s.items.includes('seal-5'), 'a', 8000, 4);
    check('x4-opens-clock-tower-4x5-seal', s.items.includes('seal-5'), s.ammo);
    await R.toRoom('a', 'M', 8000, false);
    // Clear the Clock Gate's skeleton and bat before climbing so a swoop can't knock the bot off a ledge.
    await R.key('1');
    await page.keyboard.down('f');
    for (const t0 = Date.now(); Date.now() - t0 < 30000;) {
      const m = (await S()), foe = m.targets.find(t => t.kind === 'skeleton' || t.kind === 'bat');
      if (!foe) break;
      await R.key(foe.x < m.x ? 'a' : 'd', 25);
      await R.wait(60);
    }
    await page.keyboard.up('f');
    await R.climb([[740, 620, 896, 'M28'], [540, 330, 768, 'M24'], [380, 560, 640, 'M20'], [650, 800, 480, 'M-ledge', 250]]);
    await R.toRoom('d', 'N');
    await R.wait(300);
    await shot('gear-gallery');
    await R.toRoom('d', 'O');
    const ev0 = await page.evaluate(() => pocEvents());
    const kills = ev0.filter(e => e.type === 'kill' && e.room === 'N');
    check('clock-tower-monsters-carry-5s-and-fall', kills.some(e => e.kind === 'bat') && kills.some(e => e.a === 5 || e.b === 5), kills.map(e => `${e.kind} ${e.a}·${e.b} ×${e.weapon}`));
    await R.walkTo(420);
    if ((await S()).nearOrb) await R.answerOrb(true);
    await R.toRoom('d', 'P', 8000, false);
    // Boss orb: once the intro ends, a right answer refills every beam.
    await R.walkTo(224, 12);
    for (let i = 0; i < 40 && !(await S()).nearOrb; i++) await R.wait(50);
    s = await S();
    const orbQ = s.nearOrb === 'bossorb-clock' ? await R.answerOrb(true) : null;
    s = await S();
    check('boss-orb-refills-every-beam', orbQ && [2, 3, 4].every(n => s.ammo[n] === s.cap[n]) && s.mode === 'play', {nearOrb: orbQ ? 'bossorb-clock' : s.nearOrb, ammo: s.ammo});
    // Jump over the Clockwork Warden with Moon Boots before its first attack.
    await R.walkTo(490, 12);
    const before = (await page.evaluate(() => pocEvents())).length;
    await page.keyboard.down('Space');
    await R.wait(40);
    await page.keyboard.down('d');
    await R.wait(1300);
    await page.keyboard.up('d');
    await page.keyboard.up('Space');
    await R.wait(200);
    const over = await S(), jumpEv = (await page.evaluate(() => pocEvents())).slice(before);
    check('boots-jump-clears-clockwork-warden', over.x > 700 && !jumpEv.some(e => e.type === 'hurt' || e.type === 'shield'), {landedAt: Math.round(over.x), hurt: jumpEv.filter(e => e.type === 'hurt').length});
    // Jump back over to the open left side before fighting.
    await page.keyboard.down('Space');
    await R.wait(40);
    await page.keyboard.down('a');
    await R.wait(1300);
    await page.keyboard.up('a');
    await page.keyboard.up('Space');
    await R.walkTo(200, 20);
    setTimeout(() => shot('clockwork-warden'), 6000);
    const warden = await R.fight('P');
    await R.walkTo(432, 12);
    await R.walkTo(528, 12);
    await R.wait(400);
    s = await S();
    check('warden-drops-x5-and-clock-shield', s.owned[5] && s.shield.owned && s.shield.charges === 3 && s.shield.max === 3, {attempts: warden.attempts, shield: s.shield, ammo5: s.ammo[5]});
    s = await R.shootUntil(s => s.items.includes('seal-q'), 'd', 8000, 5);
    check('x5-opens-5x5-training-gate', s.items.includes('seal-q'));
    await R.toRoom('d', 'Q', 8000, false);
    // Training Hall: save shrine, harmless dummy, streaks and ammo drops with the matching beam.
    await R.walkTo(144, 12);
    const hallStart = await S();
    await page.keyboard.down('f');
    for (const t0 = Date.now(); Date.now() - t0 < 25000;) {
      const m = await S(), d = m.targets.find(t => t.kind === 'dummy');
      if (d) {
        const glow = d.a === 5 || d.b === 5;
        const pick = (glow && m.owned[5] && m.ammo[5] > 0 ? [5] : []).concat([5, 4, 3, 2]).find(w => m.owned[w] && m.ammo[w] > 0 && (w === d.a || w === d.b)) || 1;
        if (pick !== m.weapon) await R.key(String(pick));
        await R.key(d.x < m.x ? 'a' : 'd', 15);
      }
      if ((m.match?.streak || 0) >= 3) break;
      await R.wait(60);
    }
    await page.keyboard.up('f');
    await shot('training-hall');
    let ev = await page.evaluate(() => pocEvents());
    const hall = ev.filter(e => e.room === 'Q');
    s = await S();
    check('training-hall-has-save-point', hall.some(e => e.type === 'shrine') && s.room === 'Q');
    check('training-dummy-deals-no-damage', !hall.some(e => e.type === 'hurt' || e.type === 'shield') && s.hearts >= hallStart.hearts, {hearts: s.hearts, harmlessHits: hall.filter(e => e.type === 'harmless-hit').length});
    const clears = hall.filter(e => e.type === 'match-kill');
    check('training-dummy-builds-streaks-and-drops-ammo', clears.length >= 2 && Math.max(0, ...clears.map(e => e.streak)) >= 2 && hall.some(e => e.type === 'dummy-drop'), clears.map(e => `${e.a}·${e.b}×${e.weapon} streak ${e.streak}`));
    check('training-dummy-follows-monster-rules', hall.filter(e => e.type === 'reflect').every(e => e.target.kind !== 'dummy' || (e.weapon > 1 && e.weapon !== e.target.a && e.weapon !== e.target.b)), hall.filter(e => e.type === 'reflect').length);
    await R.walkTo(930, 12);
    await R.hop(1008, 448);
    await R.wait(300);
    s = await S();
    check('training-hall-shield-upgrade', s.items.includes('shieldplus') && s.shield.max === 4, s.shield);
    // Back to the Central Shaft and down to the Rune Gate.
    for (const r of ['P', 'O', 'N', 'M']) await R.toRoom('a', r, 60000);
    await R.walkUntil('a', s => s.ground && s.y === 1024, 8000);
    await R.toRoom('d', 'C', 15000, false);
    s = await R.walkUntil('d', s => s.ground && (s.y === 1024 || s.y === 1152) && s.x > 660, 10000);
    if (s.y !== 1024) await R.climb([[690, 790, 1024, 'ledgeR', 220]]);
    await R.toRoom('d', 'R', 12000, false);
    await R.walkTo(112, 12);
    if ((await S()).nearOrb === 'orb-R') await R.answerOrb(true);
    for (const n of [2, 3, 4, 5]) await R.shootUntil(s => s.items.includes(`gate-${n}`), 'd', 6000, n);
    s = await S();
    check('rune-gate-opens-with-one-shot-per-beam', [2, 3, 4, 5].every(n => s.items.includes(`gate-${n}`)), s.items.filter(i => i.startsWith('gate')));
    await shot('rune-gate');
    await R.toRoom('d', 'S', 12000, false);
    for (const x of [107, 217, 327, 437]) { await R.walkTo(x, 12); if ((await S()).nearOrb) await R.answerOrb(true); }
    for (const [i, n] of [2, 3, 4, 5].entries()) {
      await R.walkTo(528 + i * 288 - 170, 12);
      await R.shootUntil(s => s.items.includes(`rune-${n}`), 'd', 9000, n);
    }
    s = await S();
    ev = await page.evaluate(() => pocEvents());
    check('four-runes-charge-and-refill', [2, 3, 4, 5].every(n => s.items.includes(`rune-${n}`)) && ev.filter(e => e.type === 'rune').length === 4, s.items.filter(i => i.startsWith('rune')));
    await shot('rune-sanctum');
    await R.walkTo(1776, 20);
    await R.wait(600);
    s = await S();
    check('portal-opens-core-clash-choice', s.mode === 'finish', s.mode);
    await shot('portal');
    fs.writeFileSync(path.join(evidence, 'clock-tower-events.json'), JSON.stringify(ev, null, 1));
    await page.click('#enter-boss');
    await page.waitForURL(/poc-vii\/boss\.html/, {timeout: 5000}).catch(() => {});
    check('portal-enters-original-core-clash', /poc-vii\/boss\.html/.test(page.url()), page.url());
    results.notes.push(`Warden attempts: ${warden.attempts}. Training clears: ${clears.length}. Shield blocks this run: ${ev.filter(e => e.type === 'shield').length}.`);
  } catch (e) {
    let state = null;
    try { state = await page.evaluate(() => ({s: gameState(), events: pocEvents().slice(-20)})); } catch { /* page gone */ }
    await shot('failure');
    check('scenario-completed', false, {error: e.message, state});
  }
  check('no-page-errors', errors.length === 0, errors);
  await browser.close();
  server.close();
  results.passed = Object.values(results.checks).every(c => c.ok);
  fs.writeFileSync(path.join(evidence, 'clock-tower-results.json'), JSON.stringify(results, null, 2));
  console.log(results.passed ? 'ALL PASSED' : 'FAILURES', results.notes.join(' '));
  process.exit(results.passed ? 0 : 1);
})();
