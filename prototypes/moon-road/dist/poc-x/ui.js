import {ROOMS, SCREEN_W, SCREEN_H, COLLECTIBLES} from './world.js';
import {mapPercent} from './progress.js';

const $ = s => document.querySelector(s);
export const HEX = {1: '#d6e8ef', 2: '#ffb44a', 3: '#57b8ff', 4: '#7fe0a0', 5: '#ff6f8a'};
const SHORT = {A: 'GATE', B: 'ATRIUM', C: 'SHAFT', D: 'CRYPT', E: 'SHRINE', F: 'TWIN', G: 'BOOTS', H: 'STAR WALK', I: 'SHRINE', J: 'TRINE', K: 'VAULT', M: 'CLOCK', N: 'GEARS', O: 'BELLS', P: 'WARDEN', Q: 'TRAINING', R: 'RUNES', S: 'PORTAL ✦'};
const ZONE = {atrium: '#5d7896', shaft: '#4f6a8a', crypt: '#8a735c', stars: '#5a64b8', vault: '#6f8f64', clock: '#a06a30'};

export const input = {left: new Set(), right: new Set(), fire: new Set(), jump: new Set(), jumpQueued: false, fireQueued: false, openQueued: false};

export function clearInput() {
  for (const k of ['left', 'right', 'fire', 'jump']) input[k].clear();
  input.jumpQueued = input.fireQueued = input.openQueued = false;
}

let noticeUntil = 0, bannerUntil = 0, lastMiniKey = '';

export function say(text, seconds, clock) {
  $('#notice').textContent = text;
  noticeUntil = clock + seconds;
}

export function banner(title, sub, clock) {
  const b = $('#banner');
  b.hidden = false;
  b.replaceChildren(document.createTextNode(title));
  if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  bannerUntil = clock + 2.6;
}

export function tick(clock) {
  if (clock > noticeUntil) $('#notice').textContent = '';
  if (clock > bannerUntil) $('#banner').hidden = true;
}

export function bind(h) {
  for (const id of ['left', 'right', 'fire', 'jump']) {
    const el = $('#' + id);
    el.onpointerdown = e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      if (!h.playing()) return;
      input[id].add(e.pointerId);
      if (id === 'fire') input.fireQueued = true;
      if (id === 'jump') input.jumpQueued = true;
    };
    el.onpointerup = el.onpointercancel = e => input[id].delete(e.pointerId);
  }
  $('#open').onclick = () => h.open();
  $('#weapon').onclick = () => h.cycle();
  $('#auto').onclick = () => h.auto();
  $('#pause').onclick = $('#resume').onclick = () => h.pause();
  $('#map-btn').onclick = $('#map-close').onclick = () => h.map();
  $('#close').onclick = $('#skip').onclick = () => h.leave();
  $('#start').onclick = () => h.start();
  $('#enter-boss').onclick = () => location.assign('../poc-vii/boss.html');
  $('#restart').onclick = () => location.reload();
  $('#explore').onclick = () => h.explore();
  $('#restart-btn').onclick = $('#pause-restart').onclick = () => h.askRestart();
  $('#restart-yes').onclick = () => location.reload();
  $('#restart-no').onclick = () => h.cancelRestart();

  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w', 'f', 'e', 'q', 'c', 'm', '1', '2', '3', '4', '5', 'Escape'];
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keys.includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === 'Escape') return h.escape();
    if (k === 'm') return h.map();
    if (!h.playing()) return;
    if (k === 'a' || k === 'ArrowLeft') input.left.add('key');
    if (k === 'd' || k === 'ArrowRight') input.right.add('key');
    if (k === 'w' || k === 'ArrowUp' || k === ' ') { input.jump.add('key'); input.jumpQueued = true; }
    if (k === 'f') { input.fire.add('key'); input.fireQueued = true; }
    if (k === 'e') input.openQueued = true;
    if (k === 'c') h.cycle();
    if (k === 'q') h.auto();
    if ('12345'.includes(k)) h.select(+k);
  });
  addEventListener('keyup', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'a' || k === 'ArrowLeft') input.left.delete('key');
    if (k === 'd' || k === 'ArrowRight') input.right.delete('key');
    if (k === 'w' || k === 'ArrowUp' || k === ' ') input.jump.delete('key');
    if (k === 'f') input.fire.delete('key');
  });
  addEventListener('blur', () => { clearInput(); h.suspend(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); h.suspend(); } });

  const resize = () => {
    const b = getComputedStyle(document.body);
    const l = parseFloat(b.paddingLeft) || 0, r = parseFloat(b.paddingRight) || 0, t = parseFloat(b.paddingTop) || 0, bot = parseFloat(b.paddingBottom) || 0;
    const w = innerWidth - l - r, hh = innerHeight - t - bot;
    $('#stage').style.cssText = `left:${l + w / 2}px;top:${t + hh / 2}px;transform:translate(-50%,-50%) scale(${Math.min(w / 960, hh / 540)})`;
  };
  addEventListener('resize', resize);
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);
  resize();
}

export function show(id, visible) { $('#' + id).hidden = !visible; }

export function hud(S) {
  const r = S.run, w = S.weapon;
  $('#hearts').textContent = '♥'.repeat(r.hearts) + '♡'.repeat(r.maxHearts - r.hearts);
  $('#shield').hidden = !r.shield.owned;
  $('#streak').hidden = r.match.streak < 1;
  if ($('#streak').dataset.n !== String(r.match.streak)) {
    $('#streak').dataset.n = r.match.streak;
    $('#streak').textContent = 'MATCH ×' + r.match.streak;
    $('#streak').style.animation = 'none';
    void $('#streak').offsetWidth;
    $('#streak').style.animation = '';
  }
  $('#shield').textContent = '◆'.repeat(r.shield.charges) + '◇'.repeat(r.shield.max - r.shield.charges);
  $('#weapon-n').textContent = '×' + w;
  $('#weapon-n').style.color = HEX[w];
  $('#weapon-ammo').textContent = w === 1 ? '∞' : r.ammo[w] + ' / ' + r.cap[w];
  $('#weapon').classList.toggle('empty', w > 1 && r.ammo[w] === 0);
  const pips = $('#weapon-pips');
  if (pips.children.length !== 5) pips.replaceChildren(...[1, 2, 3, 4, 5].map(() => document.createElement('i')));
  [...pips.children].forEach((p, i) => {
    p.className = (r.owned[i + 1] ? 'own' : '') + (w === i + 1 ? ' sel' : '');
    p.style.color = HEX[i + 1];
  });
  $('#auto small').textContent = 'AUTO ' + (S.autoFire ? 'ON' : 'OFF');
  $('#auto').setAttribute('aria-pressed', S.autoFire);
  $('#auto').classList.toggle('on', S.autoFire);
  $('#controls').hidden = S.mode !== 'play' && S.mode !== 'transition';
  $('#nearby').hidden = S.mode !== 'play' || !S.nearOrb;
  if (S.nearOrb) {
    const o = S.nearOrb;
    $('#drop-name').textContent = o.bossOrb ? '✚ ORB · REFILL EVERY BEAM' : '×' + o.family + ' · ' + (o.unlock ? 'NEW BEAM' : 'REFILL AMMO');
  }
  minimap(S);
}

export function roomName(name) { $('#room-name').textContent = name.toUpperCase(); }

function playerCell(S) {
  const room = S.room;
  return {x: room.gx + Math.min(room.w - 1, Math.floor(S.p.x / (SCREEN_W * 32))), y: room.gy + Math.min(room.h - 1, Math.floor((S.p.y - 40) / (SCREEN_H * 32)))};
}

function drawMap(ctx, S, cw, ch, ox, oy, labels) {
  const blink = Math.floor(S.clock * 3) % 2 === 0, cell = playerCell(S);
  for (const room of Object.values(ROOMS)) {
    const seen = S.run.visited.has(room.id);
    if (!seen) continue;
    const x = ox + room.gx * cw, y = oy + room.gy * ch, w = room.w * cw, h = room.h * ch;
    ctx.fillStyle = ZONE[room.zone];
    ctx.globalAlpha = room.id === S.room.id ? 1 : 0.7;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#d9e6ef';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    for (const d of room.doors) {
      const seal = [].concat(d.via || []).map(v => room.entities.find(e => e.id === v)).find(e => e && !S.run.items.has(e.id));
      const open = !seal;
      const dy = y + d.row * ch + ch * 0.62, dx = d.side === 'W' ? x : x + w - 3;
      ctx.fillStyle = open ? '#e8f1ff' : HEX[seal.type === 'block' ? 1 : Math.min(...[seal.a, seal.b].filter(n => n > 1))] || '#fff';
      ctx.fillRect(dx, dy - 2, 3, 5);
    }
    if (labels) {
      ctx.fillStyle = '#f3eddc';
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText(SHORT[room.id], x + 5, y + 13);
    }
  }
  if (blink) {
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(ox + cell.x * cw + cw / 2 - 2, oy + cell.y * ch + ch / 2 - 2, 5, 5);
  }
}

function minimap(S) {
  const cell = playerCell(S), key = `${S.room.id}${cell.x},${cell.y}${Math.floor(S.clock * 3) % 2}${S.run.visited.size}${S.run.items.size}`;
  if (key === lastMiniKey) return;
  lastMiniKey = key;
  const c = $('#minimap'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  drawMap(ctx, S, 16, 10, 3, 3, false);
}

export function openMap(S) {
  const c = $('#bigmap'), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  drawMap(ctx, S, 60, 40, 10, 4, true);
  const found = COLLECTIBLES.filter(id => S.run.items.has(id)).length;
  const beams = [2, 3, 4, 5].filter(n => S.run.owned[n]).map(n => '×' + n).join(' ') || 'none yet';
  $('#map-stats').innerHTML = `Explored <b>${mapPercent(S.run, Object.keys(ROOMS).length)}%</b> · Items <b>${found} / ${COLLECTIBLES.length}</b> · Beams <b>${beams}</b>${S.run.boots ? ' · <b>Moon Boots</b>' : ''}${S.run.shield.owned ? ` · <b>Clock Shield ${S.run.shield.max}</b>` : ''}<br>Match kills <b>${S.run.match.clean}</b> · best streak <b>${S.run.match.best}</b>`;
}

export function question({family, k, values, reward}, onAnswer) {
  $('#reward').textContent = reward;
  $('#equation').textContent = `${family} × ${k} = ?`;
  $('#answers').replaceChildren(...values.map(v => {
    const b = document.createElement('button');
    b.textContent = v;
    b.onclick = () => onAnswer(v);
    return b;
  }));
  show('question', true);
  $('#answers button').focus();
}

export function finish(S) {
  const found = COLLECTIBLES.filter(id => S.run.items.has(id)).length;
  $('#finish-copy').textContent = `Explored ${mapPercent(S.run, Object.keys(ROOMS).length)}% · items ${found} / ${COLLECTIBLES.length} · match kills ${S.run.match.clean} (best streak ${S.run.match.best}). The guardian keeps its original power-orb rules.`;
  show('finish', true);
}

export function bossBar(boss) {
  if (!boss) return show('bossbar', false);
  show('bossbar', true);
  $('#boss-name').textContent = boss.name;
  const wrap = $('#boss-plates');
  if (wrap.children.length !== boss.plates.length) wrap.replaceChildren(...boss.plates.map(() => { const i = document.createElement('i'); i.append(document.createElement('b')); return i; }));
  boss.plates.forEach((p, i) => {
    const el = wrap.children[i];
    el.classList.toggle('cur', i === boss.index);
    el.firstChild.style.width = (100 * p.hp / (p.max || p.a * p.b)) + '%';
  });
}
