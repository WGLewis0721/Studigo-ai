import {TILE, makeGrid, moveBody} from './physics.js';
import {ROOMS, START, ROOM_COUNT, COLLECTIBLES, doorSpan} from './world.js';
import {canDamage, reflectText, fact, choices, remainingHp} from './rules.js';
import * as P from './progress.js';
import * as UI from './ui.js';
import {input, clearInput} from './ui.js';
import {build, COLOR, overlaps, orb, pickup} from './actors.js';
import {makeBoss} from './boss.js';
import {ART} from './art/art.js';

const Phaser = window.Phaser;
const SHOT_SPEED = 960;
const RUN = 250, GRAVITY = 1150, JUMP = 520, BOOTS_JUMP = 700, MAX_FALL = 900, CUT = 170;
const ZONES = {
  atrium: {name: 'MOON ATRIUM', bg: 'bg', bgTint: 0x8296b2, tex: 'tex-atrium', texTint: 0xb4bccc, edge: 0x8fb0d0, plat: 0x9fb6c9},
  shaft: {name: 'CENTRAL SHAFT', bg: 'bg', bgTint: 0x66799a, tex: 'tex-shaft', texTint: 0xb0b8c4, edge: 0x7a98b8, plat: 0x8fb0cc},
  crypt: {name: 'BONE CRYPT', bg: 'bg-crypt', bgTint: 0x7c7478, tex: 'tex-crypt', texTint: 0xa89c94, edge: 0xb89c7c, plat: 0xb9a38a},
  stars: {name: 'STAR OBSERVATORY', bg: 'bg-stars', bgTint: 0x9494b4, tex: 'tex-stars', texTint: 0xc0c0d8, edge: 0x8a96e0, plat: 0xa7b4ee},
  vault: {name: 'THE VAULTS', bg: 'bg-vault', bgTint: 0x86968a, tex: 'tex-vault', texTint: 0xb0c0b0, edge: 0x8fbf84, plat: 0xb5cf9e},
  library: {name: 'MOON LIBRARY', bg: 'bg-vault', bgTint: 0xb09a8a, tex: 'tex-crypt', texTint: 0xc4a890, edge: 0xe6b860, plat: 0xd6a66a},
  clock: {name: 'CLOCK TOWER', bg: 'bg-clock', bgTint: 0x958b7e, tex: 'tex-clock', texTint: 0xb8a898, edge: 0xe0a860, plat: 0xe0b36a},
};
const within = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const center = r => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

export class MoonKeep extends Phaser.Scene {
  constructor() { super('moon-keep'); }

  preload() {
    this.load.image('bg', '../assets/observatory.png');
    this.load.image('platform', '../assets/platform.png');
    this.load.image('core', '../assets/core.png');
    this.load.spritesheet('dragon', 'art/dragon-orange.png', {frameWidth: 128, frameHeight: 128});
    this.load.spritesheet('guardian', '../assets/guardian.png', {frameWidth: 256, frameHeight: 256});
    this.load.json('frames', '../assets/frames.json');
    for (const k of ['skeleton', 'bat', 'twin', 'clockwarden', 'sentinel', 'items'])
      this.load.spritesheet(k, `art/${k}.png`, {frameWidth: ART[k].frameWidth, frameHeight: ART[k].frameHeight});
    for (const k of ['crypt', 'stars', 'vault', 'clock']) this.load.image(`bg-${k}`, `art/bg-${k}.png`);
    for (const k of ['atrium', 'crypt', 'stars', 'vault', 'clock', 'shaft']) this.load.spritesheet(`tex-${k}`, `art/tex-${k}.png`, {frameWidth: 32, frameHeight: 32});
    this.load.atlas('library', 'art/library.png', 'art/library.json');
    this.load.on('loaderror', () => { document.querySelector('#loading').textContent = 'Could not load. Refresh to retry.'; });
  }

  create() {
    this.run = P.newRun();
    this.mode = 'intro';
    this.clock = 0;
    this.weapon = 1;
    this.autoFire = false;
    this.kills = 0;
    this.events = [];
    this.p = {x: START.x, y: 15 * TILE, w: 40, h: 76, vy: 0, kx: 0, ground: true, face: 1, inv: 0, fire: 0, land: 0, coyote: 0, buffer: 0, cut: false};
    this.shots = [];
    this.enemyShots = [];
    this.particles = [];
    this.floaters = [];
    this.actors = [];
    this.roomObjects = [];
    this.hitStop = 0;
    this.fireCD = 0;
    this.seenZones = new Set();
    this.bg = this.add.image(480, 270, 'bg').setDisplaySize(1152, 648).setScrollFactor(0).setDepth(-10);
    this.back = this.add.graphics().setDepth(-5);
    this.tiles = this.add.graphics().setDepth(2);
    this.g = this.add.graphics().setDepth(3);
    this.fx = this.add.graphics().setDepth(7);
    this.hero = this.add.sprite(0, 0, 'dragon', 6).setOrigin(0.5, 1).setScale(116 / 128).setDepth(5);
    this.loadRoom(START.room);
    this.ui = this.handlers();
    UI.bind(this.ui);
    this.exposeHooks();
    document.querySelector('#loading').hidden = true;
    this.log('ready');
  }

  // ---------- helpers used by actors and bosses ----------
  log(type, data = {}) { this.events.push({type, t: +this.run.active.toFixed(3), room: this.room?.id, ...data}); }
  say(text, seconds = 1.6) { UI.say(text, seconds, this.clock); }
  banner(title, sub) { UI.banner(title, sub, this.clock); }
  spawn(actor) { this.actors.push(actor); }
  enemyShot(s) { this.enemyShots.push({life: 4, ...s}); }
  playerRect() { const p = this.p; return {x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h}; }

  sfx(freq = 400, dur = 0.12) {
    try {
      this.audio ||= new (window.AudioContext || window.webkitAudioContext)();
      this.audio.resume();
      const a = this.audio, o = a.createOscillator(), gain = a.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, a.currentTime + dur);
      gain.gain.setValueAtTime(0.06, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(gain).connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur);
    } catch { /* audio is optional */ }
  }

  burst(x, y, c, count = 15) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 35 + Math.random() * 150;
      this.particles.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.5, c});
    }
  }

  float(x, y, text, color, size = 22) {
    if (text.length > 8 && this.floaters.some(q => q.text.text === text && q.life > 0.9)) return;
    const cam = this.cameras.main, half = text.length * size * 0.32;
    x = Phaser.Math.Clamp(x, cam.scrollX + half + 12, cam.scrollX + 948 - half);
    const t = this.add.text(x, y, text, {fontFamily: 'monospace', fontSize: size, fontStyle: 'bold', color, stroke: '#081422', strokeThickness: 4}).setOrigin(0.5).setDepth(9);
    this.floaters.push({life: text.length > 8 ? 1.4 : 0.9, text: t});
  }

  lockRects() {
    if (!this.boss?.alive) return [];
    return this.room.doors.map(d => { const s = doorSpan(this.room, d); return {x: s.tx * TILE, y: s.ty0 * TILE, w: TILE, h: 4 * TILE}; });
  }

  solidRects() {
    return [...this.actors.filter(a => a.solid && a.alive).map(a => a.rect()), ...this.lockRects()];
  }

  targets() {
    return [...this.actors.filter(a => a.target && a.alive), ...(this.boss?.alive && this.bossIntro <= 0 ? this.boss.targets() : [])];
  }

  // ---------- rooms ----------
  loadRoom(id, entry = null) {
    for (const a of this.actors) a.destroy();
    for (const o of this.roomObjects) o.destroy();
    this.boss?.destroy();
    this.boss = null;
    this.actors = [];
    this.roomObjects = [];
    this.shots = [];
    this.enemyShots = [];
    this.nearOrb = null;
    const room = this.room = ROOMS[id];
    this.grid = makeGrid(room.rows);
    this.W = room.rows[0].length * TILE;
    this.H = room.rows.length * TILE;
    this.zone = ZONES[room.zone];
    this.bg.setTexture(this.zone.bg).setDisplaySize(1152, 648).setTint(this.zone.bgTint);
    this.drawTiles();
    this.drawDecor();
    this.actors = room.entities.flatMap(e => build(e, this));
    const def = room.entities.find(e => e.type === 'boss');
    if (def && !this.run.items.has('boss:' + def.id)) {
      this.boss = makeBoss(def, this);
      this.bossIntro = 1.5;
      // Above the left platform in every arena: reachable from the platform or floor, away from where bosses roam.
      this.actors.push(orb({id: 'bossorb-' + def.id, family: 2, bossOrb: true}, this, 224, 270));
      this.banner(def.name, 'Hit the plate numbers on its core · ✚ orb refills your beams');
      this.log('boss-start', {id: def.id});
    }
    const p = this.p;
    if (entry) {
      const s = doorSpan(room, entry);
      p.x = entry.side === 'W' ? 52 : this.W - 52;
      p.y = (s.ty1 + 1) * TILE;
    } else {
      p.x = this.run.shrine.x;
      p.y = 15 * TILE;
      p.vy = 0;
    }
    p.kx = 0;
    this.cameras.main.setBounds(0, 0, this.W, this.H);
    this.cameras.main.scrollX = Phaser.Math.Clamp(p.x - 480, 0, this.W - 960);
    this.cameras.main.scrollY = Phaser.Math.Clamp(p.y - 300, 0, Math.max(0, this.H - 540));
    P.visit(this.run, id);
    UI.roomName(room.name);
    if (!this.seenZones.has(room.zone) && !def) {
      this.seenZones.add(room.zone);
      if (id !== START.room) this.banner(this.zone.name, room.name.toUpperCase() === this.zone.name ? '' : room.name);
    }
    this.log('room', {id});
  }

  drawTiles() {
    const t = this.tiles, z = this.zone, rows = this.room.rows;
    t.clear();
    this.wallRT?.destroy();
    const rt = this.wallRT = this.add.renderTexture(0, 0, this.W, this.H).setOrigin(0).setDepth(1).setTint(z.texTint);
    rt.beginDraw();
    for (let ty = 0; ty < rows.length; ty++) {
      const row = rows[ty];
      let run = -1;
      for (let tx = 0; tx <= row.length; tx++) {
        const c = row[tx], x = tx * TILE, y = ty * TILE;
        if (c === '=' && run < 0) run = tx;
        if (c !== '=' && run >= 0) {
          this.roomObjects.push(this.add.image(run * TILE, y - 2, 'platform').setOrigin(0).setDisplaySize((tx - run) * TILE, 20).setTint(z.plat).setDepth(1));
          run = -1;
        }
        if (c !== '#') continue;
        rt.batchDrawFrame(z.tex, (ty % 4) * 4 + (tx % 4), x, y);
        const open = (dx, dy) => { const n = this.grid.at(tx + dx, ty + dy); return n !== '#'; };
        if (open(0, -1)) { t.fillStyle(z.edge, 0.9); t.fillRect(x, y, TILE, 3); t.fillStyle(0x000000, 0.35); t.fillRect(x, y + 3, TILE, 3); }
        if (open(-1, 0) && tx > 0) { t.fillStyle(z.edge, 0.4); t.fillRect(x, y, 2, TILE); }
        if (open(1, 0) && tx < row.length - 1) { t.fillStyle(z.edge, 0.4); t.fillRect(x + TILE - 2, y, 2, TILE); }
        if (open(0, 1) && ty < rows.length - 1) { t.fillStyle(0x000000, 0.4); t.fillRect(x, y + TILE - 4, TILE, 4); }
      }
    }
    rt.endDraw();
  }

  drawDecor() {
    const b = this.back, z = this.zone, W = this.W, H = this.H;
    b.clear();
    for (const p of this.room.props || []) this.roomObjects.push(this.add.image(p.x, p.y, 'library', p.frame).setOrigin(0, 1).setDepth(-2));
    if (this.room.zone !== 'shaft') return;
    for (let x = 120; x < W; x += 260) {
      b.lineStyle(4, 0x0c1522, 0.9); b.lineBetween(x, 0, x, H);
      for (let y = 20; y < H; y += 22) { b.lineStyle(2, z.edge, 0.2); b.strokeEllipse(x, y, 10, 16); }
    }
  }

  // ---------- flow ----------
  handlers() {
    const S = this;
    return {
      playing: () => S.mode === 'play',
      open: () => S.nearOrb && S.openOrb(S.nearOrb),
      cycle: () => {
        if (S.mode !== 'play') return;
        const owned = [1, 2, 3, 4, 5].filter(n => S.run.owned[n]);
        S.select(owned[(owned.indexOf(S.weapon) + 1) % owned.length]);
      },
      select: n => S.select(n),
      auto: () => { if (S.mode === 'play') { S.autoFire = !S.autoFire; S.log('auto', {on: S.autoFire}); } },
      pause: () => S.pause(),
      map: () => {
        if (S.mode === 'play') { S.mode = 'map'; clearInput(); UI.openMap(S); UI.show('map', true); S.log('map'); }
        else if (S.mode === 'map') { S.mode = 'play'; UI.show('map', false); }
      },
      leave: () => S.leaveQuestion(),
      escape: () => {
        if (S.mode === 'confirm') return S.ui.cancelRestart();
        if (S.mode === 'question') S.leaveQuestion();
        else if (S.mode === 'map') { S.mode = 'play'; UI.show('map', false); }
        else S.pause();
      },
      start: () => {
        if (S.mode !== 'intro') return;
        S.mode = 'play';
        UI.show('intro', false);
        S.sfx(600);
        S.say('Head east →  ×1 fights skeletons', 3);
        S.log('start');
      },
      explore: () => { if (S.mode === 'finish') { S.mode = 'play'; UI.show('finish', false); } },
      // Beta-test restart: a reload is a new run because nothing is saved.
      askRestart: () => {
        if (S.mode === 'confirm') return;
        S.beforeConfirm = S.mode;
        S.mode = 'confirm';
        clearInput();
        UI.show('paused', false);
        UI.show('confirm-restart', true);
        S.log('restart-asked');
      },
      cancelRestart: () => {
        if (S.mode !== 'confirm') return;
        UI.show('confirm-restart', false);
        S.mode = S.beforeConfirm === 'paused' ? 'paused' : S.beforeConfirm;
        if (S.mode === 'paused') UI.show('paused', true);
      },
      suspend: () => { if (S.mode === 'play') S.pause(); },
    };
  }

  select(n) {
    if (this.mode !== 'play' || !this.run.owned[n] || n === this.weapon) return;
    this.weapon = n;
    this.sfx(300 + n * 100);
    this.log('weapon', {weapon: n});
  }

  pause() {
    if (this.mode === 'play') { this.mode = 'paused'; clearInput(); UI.show('paused', true); this.log('pause'); }
    else if (this.mode === 'paused') { this.mode = 'play'; UI.show('paused', false); this.log('resume'); }
  }

  openOrb(o) {
    if (this.mode !== 'play' || !o.ready() || Math.abs(this.p.x - o.x) > 150) return;
    const offset = [...o.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    const f = o.refillAll ? this.bossOrbFamily() : o.family, k = fact(f, P.orbAttempt(this.run, o.id) + offset);
    this.mode = 'question';
    clearInput();
    this.question = {orb: o, k, family: f};
    const reward = o.refillAll ? 'REFILL EVERY BEAM · ♥ IF HURT' : o.unlock ? `UNLOCK ×${f} BEAM` : `REFILL ×${f} · ${this.run.cap[f]} ROUNDS`;
    UI.question({family: f, k, values: choices(f, k), reward}, v => this.answer(v));
    this.sfx(780, 0.16);
    this.log('question', {id: o.id, family: f, k});
  }

  answer(v) {
    const q = this.question;
    if (this.mode !== 'question' || !q) return;
    const o = q.orb, f = q.family, correct = v === f * q.k;
    P.submitOrb(this.run, o.id);
    this.question = null;
    UI.show('question', false);
    this.mode = 'play';
    this.fireCD = 0.3;
    clearInput();
    if (correct) {
      if (o.refillAll) {
        for (const n of [2, 3, 4, 5]) P.refill(this.run, n);
        const hurt = this.run.hearts < this.run.maxHearts;
        if (hurt) this.spawn(pickup({kind: 'heart'}, this.p.x + (this.p.x < 480 ? 50 : -50), this.p.y - 120, this));
        this.say(hurt ? 'BEAMS REFILLED · ♥' : 'BEAMS REFILLED', 2);
      } else if (o.unlock) {
        P.collect(this.run, {id: o.id, kind: 'weapon', family: f});
        this.banner(`×${f} BEAM`, `PRESS ${f} OR TAP THE BEAM BUTTON`);
        this.weapon = f;
      } else {
        P.refill(this.run, f);
        this.say(`×${f} · ${this.run.ammo[f]} ROUNDS!`, 2);
        this.weapon = f;
      }
      this.burst(o.x, o.y, COLOR[f], 60);
      this.sfx(1046, 0.4);
      this.cameras.main.flash(130, 145, 180, 135);
      this.log('correct', {id: o.id, family: f, k: q.k});
    } else {
      this.burst(o.x, o.y, 0x859db3, 18);
      this.sfx(150, 0.14);
      this.say('Keep going!', 1.2);
      this.log('wrong', {id: o.id, family: f, k: q.k});
    }
  }

  // The boss orb asks about the beam the current plate needs (or any owned beam), defaulting to ×2.
  bossOrbFamily() {
    const p = this.boss?.plates?.[this.boss.index];
    const fits = p ? [p.a, p.b].filter(n => n > 1 && this.run.owned[n]) : [];
    if (fits.length) return Math.max(...fits);
    const owned = [2, 3, 4, 5].filter(n => this.run.owned[n]);
    return owned.length ? owned.sort((m, n) => this.run.ammo[m] / this.run.cap[m] - this.run.ammo[n] / this.run.cap[n])[0] : 2;
  }

  leaveQuestion() {
    if (this.mode !== 'question') return;
    this.question = null;
    UI.show('question', false);
    this.mode = 'play';
    this.fireCD = 0.25;
    clearInput();
    this.log('question-left');
  }

  finish() {
    this.mode = 'finish';
    clearInput();
    UI.finish(this);
    this.sfx(1046, 0.4);
    this.log('finish', {percent: P.mapPercent(this.run, ROOM_COUNT), items: COLLECTIBLES.filter(id => this.run.items.has(id))});
  }

  bossDefeated(def) {
    this.run.items.add('boss:' + def.id);
    this.say(`${def.name} DEFEATED`, 2.2);
    this.log('boss-defeated', {id: def.id});
  }

  hurtPlayer(fromX) {
    const p = this.p;
    if (p.inv > 0 || this.mode !== 'play') return;
    P.breakStreak(this.run);
    if (P.absorb(this.run)) {
      p.inv = 1.1;
      p.vy = Math.min(p.vy, -180);
      p.kx = (p.x < fromX ? -1 : 1) * 160;
      this.burst(p.x, p.y - 40, 0x8ff5e0, 26);
      this.float(p.x, p.y - 110, '◆ BLOCKED', '#8ff5e0', 16);
      this.sfx(1180, 0.16);
      this.log('shield', {charges: this.run.shield.charges});
      return;
    }
    const dead = P.hurt(this.run);
    p.inv = 1.5;
    p.vy = -280;
    p.kx = (p.x < fromX ? -1 : 1) * 240;
    this.burst(p.x, p.y - 40, 0xffb8a2);
    this.sfx(110, 0.2);
    this.cameras.main.shake(100, 0.003);
    this.log('hurt', {hearts: this.run.hearts});
    if (dead) this.respawn();
  }

  respawn() {
    this.log('death');
    P.healFull(this.run);
    // Coming back from a shrine tops every owned beam up to at least half, so a retry isn't a dead end.
    for (const n of [2, 3, 4, 5]) if (this.run.owned[n]) this.run.ammo[n] = Math.max(this.run.ammo[n], Math.ceil(this.run.cap[n] / 2));
    this.mode = 'transition';
    this.cameras.main.fadeOut(260, 5, 8, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadRoom(this.run.shrine.room);
      this.p.inv = 1.5;
      this.mode = 'play';
      this.cameras.main.fadeIn(260, 5, 8, 15);
      this.say('Back at the shrine · everything you found is kept · beams topped up', 2.4);
    });
  }

  go(door) {
    const target = ROOMS[door.to], back = target.doors.find(b => b.to === this.room.id && b.side !== door.side);
    this.mode = 'transition';
    this.cameras.main.fadeOut(120, 5, 8, 15);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadRoom(door.to, back);
      this.mode = 'play';
      this.cameras.main.fadeIn(160, 5, 8, 15);
    });
  }

  // ---------- loop ----------
  update(_, delta) {
    const dt = Math.min(delta / 1000, 0.033);
    if (this.mode === 'play') {
      this.run.active += dt;
      this.clock += dt;
      if (this.hitStop > 0) this.hitStop -= dt;
      else this.step(dt);
    }
    this.draw(this.mode === 'play' ? dt : 0);
    UI.tick(this.clock);
    UI.hud(this);
    UI.bossBar(this.boss?.alive && this.bossIntro <= 0 ? this.boss : null);
  }

  step(dt) {
    const p = this.p, run = this.run;
    p.inv = Math.max(0, p.inv - dt);
    p.fire = Math.max(0, p.fire - dt);
    p.land = Math.max(0, p.land - dt);
    const dir = (input.right.size ? 1 : 0) - (input.left.size ? 1 : 0);
    if (dir) p.face = dir;
    p.coyote = p.ground ? 0.09 : p.coyote - dt;
    if (input.jumpQueued) { p.buffer = 0.12; input.jumpQueued = false; } else p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -(run.boots ? BOOTS_JUMP : JUMP);
      p.coyote = p.buffer = 0;
      p.cut = false;
      p.ground = false;
      this.sfx(run.boots ? 620 : 540);
      this.burst(p.x, p.y, run.boots ? 0xd5eda7 : 0x9bb1c1, 6);
      this.log('jump', {boots: run.boots});
    }
    if (!input.jump.size && p.vy < -CUT && !p.cut && !p.ground) { p.vy = -CUT; p.cut = true; }
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    p.kx *= Math.pow(0.02, dt);
    const was = p.vy, res = moveBody(p, (dir * RUN + p.kx) * dt, p.vy * dt, this.grid, this.solidRects());
    if (res.ceiling && p.vy < 0) p.vy = 0;
    if (res.ground) {
      if (!p.ground && was > 350) { p.land = 0.12; this.burst(p.x, p.y, this.zone.edge, 8); }
      p.vy = 0;
      p.ground = true;
    } else p.ground = false;

    if (p.x < 6 || p.x > this.W - 6) {
      const side = p.x < 6 ? 'W' : 'E', feet = Math.floor((p.y - 1) / TILE);
      const door = this.room.doors.find(d => { const s = doorSpan(this.room, d); return d.side === side && feet >= s.ty0 && feet <= s.ty1; });
      if (door?.to) return this.go(door);
      p.x = Phaser.Math.Clamp(p.x, 20, this.W - 20);
    }

    this.nearOrb = this.actors.find(a => a.type === 'orb' && a.ready() && Math.abs(p.x - a.x) < 120 && Math.abs(p.y - a.y) < 230) || null;
    if (input.openQueued) {
      input.openQueued = false;
      if (this.nearOrb) return this.openOrb(this.nearOrb);
    }

    this.fireCD -= dt;
    let wantsFire = input.fire.size || input.fireQueued;
    if (!wantsFire && this.autoFire) {
      // Don't fire shots that are already committed to a kill; a miss frees the shot and auto re-fires.
      const t = this.aimTarget();
      wantsFire = !!t && !(t.hp !== undefined && remainingHp(t, this.shots) <= 0);
    }
    if (wantsFire && this.fireCD <= 0) { this.shoot(); input.fireQueued = false; }

    for (const a of [...this.actors]) if (a.alive) a.update(dt);
    const dead = this.actors.filter(a => !a.alive);
    dead.forEach(a => a.destroy());
    this.actors = this.actors.filter(a => a.alive);
    if (this.boss) {
      if (this.bossIntro > 0) this.bossIntro -= dt;
      else this.boss.update(dt);
    }
    this.updateShots(dt);

    const cam = this.cameras.main;
    const tx = Phaser.Math.Clamp(p.x - 480 + p.face * 60, 0, this.W - 960), ty = Phaser.Math.Clamp(p.y - 300, 0, Math.max(0, this.H - 540));
    cam.scrollX += (tx - cam.scrollX) * Math.min(1, dt * 6);
    cam.scrollY += (ty - cam.scrollY) * Math.min(1, dt * (p.vy > 400 ? 12 : 7));
  }

  aimTarget() {
    const p = this.p, oy = p.y - 46;
    let best = null, bestD = Infinity;
    for (const t of this.targets()) {
      const c = center(t.rect()), dx = c.x - p.x;
      if (dx * p.face <= 0 || Math.abs(dx) > 620 || Math.abs(c.y - oy) > 230) continue;
      // Prefer targets this beam can hurt; a mismatched one is only aimed at up close, never mid-boss.
      const fits = canDamage(t.math(), this.weapon);
      if (!fits && (Math.abs(dx) > 300 || this.boss?.alive)) continue;
      const d = Math.hypot(dx, c.y - oy) + (fits ? 0 : 2000);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  shoot() {
    const p = this.p, run = this.run, w = this.weapon;
    this.fireCD = 0.28;
    if (!P.spend(run, w)) {
      this.say(`×${w} EMPTY · switch beam or refill at a shrine`, 1.1);
      this.sfx(95, 0.05);
      this.fireCD = 0.45;
      this.log('empty', {weapon: w});
      return;
    }
    p.fire = 0.13;
    const ox = p.x + p.face * 40, oy = p.y - 46, t = this.aimTarget();
    let dx = p.face, dy = 0;
    if (t) { const c = center(t.rect()); dx = c.x - ox; dy = c.y - oy; }
    const len = Math.hypot(dx, dy) || 1;
    this.shots.push({x: ox, y: oy, vx: dx / len * SHOT_SPEED, vy: dy / len * SHOT_SPEED, n: w, life: 1.1, target: t});
    this.burst(ox, oy, COLOR[w], w === 1 ? 5 : 12);
    this.sfx(w === 1 ? 410 : 200 - w * 10, 0.08);
    this.log('shot', {weapon: w, ammo: w === 1 ? null : run.ammo[w]});
  }

  resolveHit(t, s) {
    const m = t.math(), r = t.rect();
    if (!canDamage(m, s.n)) {
      s.reflected = true;
      s.vx = -s.vx * 0.5;
      s.vy = -240;
      s.life = 0.55;
      this.float(r.x + r.w / 2, r.y - 26, reflectText(m, s.n), '#edcfff', 16);
      this.burst(s.x, s.y, 0xf4dbff, 16);
      this.sfx(950, 0.12);
      this.log('reflect', {weapon: s.n, target: m});
      return;
    }
    s.life = 0;
    t.applyDamage(s.n);
    this.hitStop = s.n > 1 ? 0.045 : 0.015;
    if (s.n > 1) this.cameras.main.shake(65, 0.0018);
    this.log('hit', {weapon: s.n, target: m});
  }

  updateShots(dt) {
    const targets = this.targets(), locks = this.lockRects();
    for (const s of this.shots) {
      s.life -= dt;
      if (s.reflected) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; continue; }
      // Substep so a slow frame can't carry a 780 px/s shot past a 24 px seal.
      const steps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * dt / 8));
      for (let i = 0; i < steps && s.life > 0 && !s.reflected; i++) {
        s.x += s.vx * dt / steps;
        s.y += s.vy * dt / steps;
        if (this.grid.at(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === '#' || locks.some(r => within(r, s.x, s.y))) {
          s.life = 0;
          this.burst(s.x, s.y, 0x9fb3c4, 5);
          break;
        }
        const t = targets.find(t => t.alive !== false && within(t.rect(), s.x, s.y));
        if (t) this.resolveHit(t, s);
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
    const pr = this.playerRect();
    for (const s of this.enemyShots) {
      s.vy += (s.g || 0) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (this.grid.at(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === '#') { s.life = 0; this.burst(s.x, s.y, s.color, 6); continue; }
      if (overlaps({x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2}, pr)) {
        s.life = 0;
        if (s.harmless) { this.float(this.p.x, this.p.y - 100, '0', '#d8e2ec', 20); this.burst(s.x, s.y, s.color, 8); this.sfx(900, 0.05); this.log('harmless-hit'); }
        else this.hurtPlayer(s.x);
      }
    }
    this.enemyShots = this.enemyShots.filter(s => s.life > 0);
  }

  draw(dt) {
    const g = this.g, f = this.fx, t = this.clock, p = this.p, cam = this.cameras.main;
    g.clear();
    f.clear();
    // One oversized image drifts at most 96 px each way, so the non-tiling art never shows a seam.
    this.bg.x = 576 - 192 * (this.W > 960 ? cam.scrollX / (this.W - 960) : 0.5);
    this.bg.y = 324 - 108 * (this.H > 544 ? cam.scrollY / (this.H - 540) : 0.5);
    
    const locked = this.boss?.alive;
    for (const d of this.room.doors) {
      const s = doorSpan(this.room, d), x = s.tx * TILE, y = s.ty0 * TILE;
      g.fillStyle(this.zone.edge); g.fillRect(x - 3, y - 10, TILE + 6, 10); g.fillRect(x - 3, y + 128, TILE + 6, 6);
      const dist = Math.abs(p.x - (x + 16)), near = Math.abs(p.y - (s.ty1 + 1) * TILE) < 100;
      const open = locked || !d.to ? 0 : Phaser.Math.Clamp(1 - (dist - 70) / 90, 0, near ? 1 : 0);
      const h = 128 * (1 - open);
      if (h > 1) {
        g.fillStyle(locked ? 0xb2433a : 0x2f6aa8, 0.95); g.fillRect(x + 6, y, 20, h);
        g.fillStyle(locked ? 0xff9a8a : 0x9fd3ff, 0.9); g.fillRect(x + 6, y, 3, h); g.fillRect(x + 23, y, 3, h);
      }
    }

    for (const a of this.actors) a.draw(g, t);
    this.boss?.draw(g, t);

    const moving = input.left.size || input.right.size;
    const fr = p.land > 0 ? 10 : !p.ground ? (p.vy < 0 ? 7 : 8) : p.fire > 0 ? 9 : moving && this.mode === 'play' ? Math.floor(t * 12) % 6 : 6;
    this.hero.setPosition(p.x, p.y + 7).setFrame(fr).setFlipX(p.face < 0)
      .setAlpha(p.inv > 0 && Math.floor(t * 15) % 2 ? 0.45 : 1);

    for (const q of this.floaters) {
      q.life -= dt;
      q.text.y -= dt * 34;
      q.text.setAlpha(Math.min(1, q.life * 3));
      if (q.life <= 0) q.text.destroy();
    }
    this.floaters = this.floaters.filter(q => q.life > 0);

    for (const s of this.shots) {
      f.lineStyle(s.n === 1 ? 3 : 7, s.reflected ? 0xefb5ff : COLOR[s.n]);
      f.lineBetween(s.x - s.vx * 0.028, s.y - s.vy * 0.028, s.x, s.y);
      f.fillStyle(0xfff3d2); f.fillCircle(s.x, s.y, s.n === 1 ? 2 : 4);
      if (s.n > 1) { f.lineStyle(1, COLOR[s.n], 0.7); f.strokeCircle(s.x, s.y, 5 + s.n * 2); }
    }
    for (const s of this.enemyShots) {
      if (s.wave) {
        f.fillStyle(s.color, 0.3); f.fillEllipse(s.x, s.y + 6, 44, 30);
        f.fillStyle(s.color, 0.9); f.fillTriangle(s.x - 16, s.y + 16, s.x, s.y - 14, s.x + 16, s.y + 16);
        continue;
      }
      f.fillStyle(s.color, 0.25); f.fillCircle(s.x, s.y, s.r + 5);
      f.fillStyle(s.color); f.fillCircle(s.x, s.y, s.r);
      if (s.spin) { f.lineStyle(3, 0x8a7f6c); const a = t * 14; f.lineBetween(s.x - Math.cos(a) * 12, s.y - Math.sin(a) * 12, s.x + Math.cos(a) * 12, s.y + Math.sin(a) * 12); }
    }
    const sh = this.run.shield;
    if (sh.owned && sh.charges > 0) {
      f.lineStyle(2, 0x8ff5e0, 0.18 + 0.12 * sh.charges / sh.max + 0.06 * Math.sin(t * 4));
      f.strokeEllipse(p.x, p.y - 40, 78, 100);
    }
    if (p.fire > 0) {
      f.fillStyle(COLOR[this.weapon]);
      f.fillTriangle(p.x + p.face * 40, p.y - 56, p.x + p.face * 60, p.y - 46, p.x + p.face * 40, p.y - 36);
    }
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 160 * dt;
      f.fillStyle(q.c, Math.max(0, q.life));
      f.fillRect(q.x, q.y, 3, 3);
    }
    this.particles = this.particles.filter(q => q.life > 0);
    for (let i = 0; i < 18; i++) {
      const x = cam.scrollX + (i * 97 + t * 7) % 960, y = cam.scrollY + 120 + (i * 53) % 300;
      f.fillStyle(0xc4e6d6, 0.25); f.fillRect(x, y, 2, 2);
    }
  }

  exposeHooks() {
    const S = this;
    window.gameState = () => ({
      mode: S.mode, room: S.room.id, face: S.p.face, x: +S.p.x.toFixed(1), y: +S.p.y.toFixed(1), vy: +S.p.vy.toFixed(1), ground: S.p.ground,
      hearts: S.run.hearts, maxHearts: S.run.maxHearts, weapon: S.weapon, owned: {...S.run.owned}, ammo: {...S.run.ammo}, cap: {...S.run.cap},
      boots: S.run.boots, shield: {...S.run.shield}, match: {...S.run.match}, items: [...S.run.items], visited: [...S.run.visited], mapPercent: P.mapPercent(S.run, ROOM_COUNT), active: +S.run.active.toFixed(3),
      nearOrb: S.nearOrb ? S.nearOrb.id : null,
      question: S.question ? {family: S.question.family, k: S.question.k} : null,
      boss: S.boss ? {id: S.boss.id, kind: S.boss.kind, alive: S.boss.alive, index: S.boss.index, plates: S.boss.plates.map(p => ({a: p.a, b: p.b, hp: p.hp})), problem: S.boss.problem || null} : null,
      hazards: S.enemyShots.map(h => ({x: Math.round(h.x), y: Math.round(h.y), vx: Math.round(h.vx), wave: !!h.wave})),
      targets: S.targets().map(t => ({...center(t.rect()), ...t.math()})),
      actors: S.actors.map(a => ({type: a.type, id: a.id, x: a.x, hp: a.hp, armor: a.armor, ...(a.math ? a.math() : {})})),
    });
    window.pocEvents = () => S.events.slice();
  }
}
