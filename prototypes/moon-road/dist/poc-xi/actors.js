import {TILE, moveBody} from './physics.js';
import {hitText, isMatch, armorFor, damageFor} from './rules.js';
import {collect, addAmmo, orbReady, healFull, shieldKill, recordMatch, refill} from './progress.js';
import {ART} from './art/art.js';

export const COLOR = {1: 0xd6e8ef, 2: 0xffb44a, 3: 0x57b8ff, 4: 0x7fe0a0, 5: 0xff6f8a};
export const CSS = {1: '#eaf3ef', 2: '#ffce87', 3: '#a7ddff', 4: '#b5f5c8', 5: '#ffb3c1'};
const label = (S, x, y, text, size = 15, color = '#f3eddc') =>
  S.add.text(x, y, text, {fontFamily: 'monospace', fontSize: size, fontStyle: 'bold', color, stroke: '#081422', strokeThickness: 4}).setOrigin(0.5).setDepth(6);
export const ICON = Object.fromEntries(ART.items.names.map((n, i) => [n, i]));
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const sealColor = e => COLOR[Math.min(...[e.a, e.b].filter(n => n > 1)) || 2];

// Every non-boss monster shows its problem hovering above it and a segmented health bar.
function problem(S, x, y, e) {
  return label(S, x, y, `${e.a} · ${e.b}`, 17, '#f7ecd0');
}

// Health segments (a x b) plus silver armor segments capping the right end.
function healthBar(g, x, y, hp, max, armor = 0, armorMax = 0) {
  const total = max + armorMax, w = 54 / total;
  g.fillStyle(0x0b1322); g.fillRect(x - 28, y, 56, 7);
  g.fillStyle(0xe5b68a); g.fillRect(x - 27, y + 1, w * hp, 5);
  g.fillStyle(0xd8e2ec); g.fillRect(x - 27 + w * max, y + 1, w * armor, 5);
  for (let k = 1; k < total; k++) { g.fillStyle(0x111e30); g.fillRect(x - 27 + w * k, y + 1, 1, 5); }
  if (armor > 0) { g.lineStyle(2, 0xd8e2ec, 0.95); g.strokeRect(x - 29, y - 1, 58, 9); }
}

// Armor soaks hits first: x1 chips one point; a matching power beam shatters all of it in one shot.
// Returns true when the hit was spent on armor.
function hitArmor(self, w, S) {
  if (self.armor <= 0) return false;
  const shatter = isMatch(self.math(), w);
  self.armor = shatter ? 0 : self.armor - 1;
  S.float(self.x, self.y - (self.type === 'bat' ? 80 : 124), shatter ? 'ARMOR BREAK!' : self.armor ? 'ARMOR' : 'ARMOR GONE', shatter ? '#ffe08a' : '#d8e2ec', shatter ? 18 : 14);
  S.burst(self.x, self.y - (self.type === 'bat' ? 0 : 40), 0xd8e2ec, shatter ? 26 : 8);
  S.sfx(shatter ? 1500 : 620, 0.1);
  return true;
}

const lowestBeam = S => [2, 3, 4, 5].filter(n => S.run.owned[n]).sort((m, n) => S.run.ammo[m] / S.run.cap[m] - S.run.ammo[n] / S.run.cap[n])[0];

// A matching power hit: brief stagger (no movement, no contact damage) and the rounds are tallied for a refund.
function strike(self, w, S) {
  self.used.add(w);
  if (!isMatch(self.math(), w)) return;
  self.stun = 0.55;
  self.spent[w] = (self.spent[w] || 0) + 1;
  if (!self.matched) S.float(self.x, self.y - (self.type === 'bat' ? 104 : 150), 'MATCH!', '#ffe08a', 18);
  self.matched = true;
}

// Shared kill rewards. A match kill refunds every round spent on the monster (+1), shows the
// multiplication when one beam did all the work, and builds the streak; every third pays a bonus.
function onKill(S, x, y, w, e, kind, self) {
  S.kills++;
  const before = S.run.shield.charges;
  shieldKill(S.run);
  if (S.run.shield.charges > before) S.float(x, y - 70, '+◆', '#8ff5e0', 18);
  const math = {kind, a: e.a, b: e.b}, hp = e.a * e.b;
  if (isMatch(math, w)) {
    const refund = (self.spent[w] || 0) + 1, streak = recordMatch(S.run);
    addAmmo(S.run, w, refund);
    S.float(x, y - 100, self.used.size === 1 ? `${w} × ${hp / w} = ${hp}` : 'MATCH KILL', CSS[w], 24);
    S.float(x, y - 72, `+${refund} ×${w} back`, CSS[w], 15);
    S.burst(x, y, 0xffe08a, 34);
    S.sfx(1320 + Math.min(streak, 6) * 90, 0.22);
    if (streak % 3 === 0) {
      let prize;
      if (S.run.hearts < S.run.maxHearts) { S.spawn(pickup({kind: 'heart'}, x, y, S)); prize = '♥'; }
      else if (S.run.shield.owned && S.run.shield.charges < S.run.shield.max) { S.run.shield.charges++; prize = '◆'; }
      else { const low = lowestBeam(S); if (low) S.spawn(pickup({kind: 'ammo', family: low, amount: 4}, x, y, S)); prize = 'AMMO'; }
      S.float(x, y - 128, `STREAK ${streak}! ${prize}`, '#ffe08a', 20);
    }
    S.log('match-kill', {kind, a: e.a, b: e.b, weapon: w, refund, streak, pure: self.used.size === 1});
  } else {
    const low = lowestBeam(S);
    if (S.kills % 3 === 0 && S.run.hearts < S.run.maxHearts) S.spawn(pickup({kind: 'heart'}, x, y, S));
    else if (low && S.kills % 2 === 0) S.spawn(pickup({kind: 'ammo', family: low, amount: 2}, x, y, S));
  }
  S.log('kill', {kind, a: e.a, b: e.b, weapon: w, shield: S.run.shield.charges, match: isMatch(math, w)});
}

export function skeleton(e, S) {
  const home = (e.tx + 0.5) * TILE, y = e.ty * TILE, max = e.a * e.b, F = ART.skeleton;
  const sprite = S.add.sprite(home, y, 'skeleton', 0).setOrigin(0.5, (F.frameHeight - 4) / F.frameHeight).setDepth(4);
  const badge = problem(S, home, y - 106, e);
  const self = {
    type: 'skeleton', id: e.id, target: true, alive: true, x: home, y, a: e.a, b: e.b, hp: max, max, armor: armorFor(e.a, e.b), armorMax: armorFor(e.a, e.b),
    dir: 1, hit: 0, recoil: 0, dying: 0, phase: Math.random() * 6, lunge: false, stun: 0, spent: {}, used: new Set(), matched: false,
    math: () => ({kind: 'skeleton', a: e.a, b: e.b}),
    rect: () => ({x: self.x - 18, y: self.y - 76, w: 36, h: 76}),
    applyDamage(w) {
      self.hit = 0.2;
      self.recoil = Math.sign(self.x - S.p.x) || 1;
      strike(self, w, S);
      if (hitArmor(self, w, S)) return;
      self.hp = Math.max(0, self.hp - w);
      S.float(self.x, self.y - 124, hitText(self.math(), w, self.hp), CSS[w]);
      if (!self.hp) {
        self.target = false;
        self.dying = 0.001;
        S.burst(self.x, self.y - 40, 0xffe4ae, 28);
        onKill(S, self.x, self.y - 50, w, e, 'skeleton', self);
      }
    },
    update(dt) {
      self.hit = Math.max(0, self.hit - dt);
      if (self.dying) { self.dying += dt; if (self.dying > 0.5) self.alive = false; return; }
      if (self.stun > 0) { self.stun -= dt; return; }
      const p = S.p, near = Math.abs(p.y - self.y) < 90 && Math.abs(p.x - self.x) < 300;
      if (near) self.dir = Math.sign(p.x - self.x) || self.dir;
      self.lunge = near && Math.abs(p.x - self.x) < 110;
      self.x += self.dir * (near ? 62 : 36) * dt;
      const lim = e.range * TILE + (near ? TILE : 0);
      if (self.x > home + lim) { self.x = home + lim; if (!near) self.dir = -1; }
      if (self.x < home - lim) { self.x = home - lim; if (!near) self.dir = 1; }
      if (overlaps(self.rect(), S.playerRect())) S.hurtPlayer(self.x);
    },
    draw(g, t) {
      const x = self.x + (self.hit ? self.recoil * self.hit * 30 : 0);
      const frame = self.hit || self.dying || self.stun > 0 ? 3 : self.lunge ? 2 : Math.floor(t * 5 + self.phase) % 2;
      sprite.setFrame(frame).setPosition(x + (self.stun > 0 ? Math.sin(t * 70) * 2 : 0), self.y + (self.dying ? self.dying * 30 : 0)).setFlipX(self.dir < 0)
        .setRotation(self.dying ? Math.min(1.4, self.dying * 4) * -self.recoil : 0)
        .setAlpha(self.dying ? Math.max(0, 1 - self.dying * 2) : 1)
        .setTint(self.stun > 0 ? (Math.floor(t * 20) % 2 ? 0xffe08a : 0xfff4c8) : self.hit ? 0xffd9c9 : 0xffffff);
      badge.setPosition(self.x, self.y - 106 + Math.sin(t * 2.4 + self.phase) * 2).setVisible(!self.dying);
      if (!self.dying) healthBar(g, self.x, self.y - 94, self.hp, max, self.armor, self.armorMax);
    },
    destroy() { sprite.destroy(); badge.destroy(); },
  };
  return self;
}

// Clockwork bat: hovers over its home, then swoops at the dragon and climbs back.
export function bat(e, S) {
  const hx = (e.tx + 0.5) * TILE, hy = (e.ty + 0.5) * TILE, max = e.a * e.b;
  const sprite = S.add.sprite(hx, hy, 'bat', 0).setDepth(4);
  const badge = problem(S, hx, hy - 58, e);
  const self = {
    type: 'bat', id: e.id, target: true, alive: true, x: hx, y: hy, a: e.a, b: e.b, hp: max, max, armor: armorFor(e.a, e.b), armorMax: armorFor(e.a, e.b),
    hit: 0, dying: 0, phase: Math.random() * 6, state: 'hover', timer: 1 + Math.random(), tx: 0, ty: 0, face: 1, stun: 0, spent: {}, used: new Set(), matched: false,
    math: () => ({kind: 'bat', a: e.a, b: e.b}),
    rect: () => ({x: self.x - 24, y: self.y - 18, w: 48, h: 36}),
    applyDamage(w) {
      self.hit = 0.2;
      strike(self, w, S);
      if (hitArmor(self, w, S)) return;
      self.hp = Math.max(0, self.hp - w);
      S.float(self.x, self.y - 80, hitText(self.math(), w, self.hp), CSS[w]);
      if (!self.hp) {
        self.target = false;
        self.dying = 0.001;
        S.burst(self.x, self.y, 0xe0a060, 26);
        onKill(S, self.x, self.y, w, e, 'bat', self);
      }
    },
    update(dt) {
      self.hit = Math.max(0, self.hit - dt);
      if (self.dying) { self.dying += dt; self.y += 260 * dt; if (self.dying > 0.6) self.alive = false; return; }
      if (self.stun > 0) { self.stun -= dt; return; }
      const p = S.p, px = p.x, py = p.y - 40;
      self.timer -= dt;
      if (self.state === 'hover') {
        const t = S.clock + self.phase, gx = hx + Math.sin(t * 0.9) * e.range * TILE, gy = hy + Math.sin(t * 2.1) * 14;
        self.x += (gx - self.x) * Math.min(1, dt * 3);
        self.y += (gy - self.y) * Math.min(1, dt * 3);
        if (self.timer <= 0 && Math.hypot(px - self.x, py - self.y) < 260) { self.state = 'dive'; self.timer = 0.9; self.tx = px; self.ty = py; S.sfx(700, 0.08); }
      } else {
        const back = self.state === 'return', gx = back ? hx : self.tx, gy = back ? hy : self.ty, speed = back ? 150 : 250;
        const d = Math.hypot(gx - self.x, gy - self.y) || 1;
        self.x += (gx - self.x) / d * Math.min(d, speed * dt);
        self.y += (gy - self.y) / d * Math.min(d, speed * dt);
        if (!back && (self.timer <= 0 || d < 6)) { self.state = 'return'; self.timer = 2.4; }
        if (back && (d < 8 || self.timer <= 0)) { self.state = 'hover'; self.timer = 1.8 + Math.random(); }
      }
      if (Math.abs(px - self.x) > 4) self.face = px > self.x ? 1 : -1;
      if (overlaps(self.rect(), S.playerRect())) S.hurtPlayer(self.x);
    },
    draw(g, t) {
      sprite.setFrame(Math.floor(t * 9 + self.phase) % 2).setPosition(self.x, self.y).setFlipX(self.face < 0)
        .setRotation(self.dying ? self.dying * 5 : 0).setAlpha(self.dying ? Math.max(0, 1 - self.dying * 1.7) : 1)
        .setTint(self.stun > 0 ? (Math.floor(t * 20) % 2 ? 0xffe08a : 0xfff4c8) : self.hit ? 0xffe0c8 : 0xffffff);
      badge.setPosition(self.x, self.y - 58).setVisible(!self.dying);
      if (!self.dying) healthBar(g, self.x, self.y - 46, self.hp, max, self.armor, self.armorMax);
    },
    destroy() { sprite.destroy(); badge.destroy(); },
  };
  return self;
}

export function seal(e, S) {
  const x = e.tx * TILE, y = e.ty * TILE, c = e.a === 5 ? COLOR[5] : sealColor(e), max = e.a * e.b;
  const text = label(S, x + 16, y + 64, e.label || `${e.a}\n·\n${e.b}`, e.label ? 15 : 17, '#fff7df').setLineSpacing(-6);
  const tip = e.teaser ? label(S, x + (e.tx < 3 ? 70 : -40), y - 22, e.teaser, 12, '#ffb3c1') : null;
  const self = {
    type: 'seal', id: e.id, target: true, solid: true, alive: true, hp: max, max, flash: 0,
    math: () => ({kind: 'seal', a: e.a, b: e.b}),
    rect: () => ({x: x + 4, y, w: 24, h: 128}),
    applyDamage(w) {
      self.hp = Math.max(0, self.hp - w);
      self.flash = 0.2;
      S.float(x + 16, y - 16, hitText(self.math(), w, self.hp), CSS[w]);
      S.burst(x + 16, y + 64, c, 14);
      if (!self.hp) {
        self.alive = false;
        S.run.items.add(e.id);
        S.burst(x + 16, y + 64, c, 60);
        S.sfx(980, 0.3);
        S.say(e.label ? `${e.label} GATE OPEN` : `${e.a} · ${e.b} SEAL OPEN`, 1.6);
        S.log('seal', {id: e.id, weapon: w});
      }
    },
    update(dt) { self.flash = Math.max(0, self.flash - dt); },
    draw(g, t) {
      g.fillStyle(0x0c1524); g.fillRect(x + 2, y - 4, 28, 136);
      g.fillStyle(c, 0.25 + 0.1 * Math.sin(t * 3)); g.fillRect(x + 4, y, 24, 128);
      g.lineStyle(2, self.flash ? 0xffffff : c, 0.9); g.strokeRect(x + 4, y, 24, 128);
      for (let k = 0; k < max; k++) {
        g.fillStyle(k < self.hp ? c : 0x1a2436, 0.95);
        g.fillRect(x + 7, y + 4 + k * (120 / max), 3, 120 / max - 2);
      }
    },
    destroy() { text.destroy(); tip?.destroy(); },
  };
  return self;
}

export function block(e, S) {
  const x = e.tx * TILE, y = e.ty * TILE, w = e.tw * TILE, h = e.th * TILE;
  const text = label(S, x + w / 2, y + h / 2, String(e.product), 30, '#fff4d0');
  const self = {
    type: 'block', id: e.id, target: true, solid: true, alive: true, hp: e.product, max: e.product, flash: 0,
    math: () => ({kind: 'block', product: e.product}),
    rect: () => ({x, y, w, h}),
    applyDamage(n) {
      self.hp = Math.max(0, self.hp - n);
      self.flash = 0.2;
      const words = hitText(self.math(), n, self.hp);
      S.float(x + w / 2, y - 18 - (self.hp ? 0 : 16), words, CSS[n], self.hp ? 24 : 26);
      S.burst(x + w / 2, y + h / 2, 0xcbb89a, 12);
      S.sfx(260 + (e.product - self.hp) * 40, 0.08);
      if (!self.hp) {
        self.alive = false;
        S.run.items.add(e.id);
        S.burst(x + w / 2, y + h / 2, COLOR[n], 55);
        S.sfx(1046, 0.35);
        S.log('block', {id: e.id, weapon: n, product: e.product});
      }
    },
    update(dt) { self.flash = Math.max(0, self.flash - dt); },
    draw(g) {
      const cracks = 1 - self.hp / e.product;
      g.fillStyle(self.flash ? 0x6b6356 : 0x4a4439); g.fillRect(x, y, w, h);
      g.lineStyle(2, 0xb8a784, 0.9); g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.lineStyle(1, 0x2a251e, 0.9);
      for (let i = 1; i < e.tw; i++) g.lineBetween(x + i * TILE, y + 2, x + i * TILE, y + h - 2);
      for (let i = 1; i < e.th; i++) g.lineBetween(x + 2, y + i * TILE, x + w - 2, y + i * TILE);
      if (cracks > 0) {
        g.lineStyle(2, 0x15110c, 0.9);
        g.lineBetween(x + w * 0.2, y + 4, x + w * (0.2 + cracks * 0.5), y + h * cracks);
        g.lineBetween(x + w * 0.8, y + h - 4, x + w * (0.8 - cracks * 0.4), y + h * (1 - cracks * 0.8));
      }
      text.setText(String(e.product));
    },
    destroy() { text.destroy(); },
  };
  return self;
}

const ITEM_COPY = {
  tank: () => ['ENERGY TANK', 'MAX HEARTS +1'],
  expansion: i => [`×${i.family} AMMO EXPANSION`, '+4 ROUNDS OF CAPACITY'],
  boots: () => ['MOON BOOTS', 'HOLD JUMP TO LEAP HIGHER'],
  weapon: i => [`×${i.family} BEAM`, `PRESS ${i.family} OR TAP THE BEAM BUTTON`],
  shield: () => ['CLOCK SHIELD', '3 CHARGES · EACH MONSTER YOU BEAT RECHARGES ONE'],
  shieldplus: () => ['SHIELD UPGRADE', '+1 SHIELD CHARGE'],
};
const ICON_OF = {tank: 'tank', boots: 'boots', expansion: 'expansion', shield: 'shield', shieldplus: 'shieldplus'};

export function item(e, S) {
  const x = (e.tx + 0.5) * TILE, y = e.ty * TILE - 26;
  const tint = e.family ? COLOR[e.family] : e.kind === 'tank' ? 0xff9b8a : e.kind === 'boots' ? 0xd5eda7 : 0x8ff5e0;
  const icon = e.kind === 'weapon' ? (e.family === 5 ? 'core5' : null) : ICON_OF[e.kind];
  const sprite = icon ? S.add.sprite(x, y, 'items', ICON[icon]).setDepth(3) : S.add.image(x, y, 'core').setDisplaySize(30, 30).setTint(tint).setDepth(3);
  const buried = () => e.via && S.room.entities.some(b => b.id === e.via && b.type === 'block') && !S.run.items.has(e.via);
  const self = {
    type: 'item', id: e.id, alive: true,
    rect: () => ({x: x - 18, y: y - 18, w: 36, h: 36}),
    update() {
      if (buried() || !overlaps(self.rect(), S.playerRect())) return;
      self.alive = false;
      collect(S.run, e);
      if (e.kind === 'weapon') S.weapon = e.family;
      const [title, sub] = ITEM_COPY[e.kind](e);
      S.banner(title, sub);
      if (e.kind === 'weapon' && e.family === 2) S.say('Tip: match a monster’s number with ×2 — it staggers, and a match kill gives the rounds back', 4.5);
      S.burst(x, y, tint, 60);
      S.sfx(1318, 0.5);
      S.cameras.main.flash(160, 190, 230, 170);
      S.log('item', {id: e.id, kind: e.kind, family: e.family});
    },
    draw(g, t) {
      const bob = Math.sin(t * 2.6) * 5;
      sprite.setVisible(!buried()).setY(y + bob);
      if (!icon) sprite.setRotation(t * 0.8);
      if (buried()) return;
      g.lineStyle(2, tint, 0.55); g.strokeCircle(x, y + bob, 26 + Math.sin(t * 4) * 2);
      g.fillStyle(tint, 0.08); g.fillCircle(x, y + bob, 32);
    },
    destroy() { sprite.destroy(); },
  };
  return self;
}

export function pickup(drop, x, y, S) {
  const tint = drop.kind === 'heart' ? 0xffffff : COLOR[drop.family];
  const sprite = S.add.sprite(x, y, 'items', ICON[drop.kind === 'heart' ? 'heart' : 'crystal']).setScale(0.55).setTint(tint).setDepth(3);
  const body = {x, y, w: 14, h: 14}, self = {
    type: 'pickup', alive: true, vy: -220, life: 9,
    rect: () => ({x: body.x - 10, y: body.y - 16, w: 20, h: 20}),
    update(dt) {
      self.life -= dt;
      if (self.life <= 0) { self.alive = false; return; }
      self.vy = Math.min(600, self.vy + 900 * dt);
      const dx = S.p.x - body.x, dy = S.p.y - 40 - body.y;
      if (Math.hypot(dx, dy) < 150) { body.x += dx * dt * 5; body.y += dy * dt * 5; self.vy = 0; }
      else if (moveBody(body, 0, self.vy * dt, S.grid, S.solidRects()).ground) self.vy = 0;
      if (!overlaps(self.rect(), S.playerRect())) return;
      self.alive = false;
      if (drop.kind === 'heart') S.run.hearts = Math.min(S.run.maxHearts, S.run.hearts + 1);
      else addAmmo(S.run, drop.family, drop.amount);
      S.float(body.x, body.y - 30, drop.kind === 'heart' ? '+♥' : `+${drop.amount} ×${drop.family}`, drop.kind === 'heart' ? '#ffc9bd' : CSS[drop.family], 16);
      S.sfx(880, 0.1);
      S.log('pickup', drop);
    },
    draw(g, t) {
      sprite.setPosition(body.x, body.y - 8 + Math.sin(t * 5) * 2).setAlpha(self.life < 2 && Math.floor(t * 10) % 2 ? 0.3 : 1);
    },
    destroy() { sprite.destroy(); },
  };
  return self;
}

export function orb(e, S, x, y) {
  const id = e.id, family = e.family;
  const sprite = S.add.image(x, y, 'core').setDisplaySize(40, 40).setTint(e.bossOrb || e.refillAll ? 0xfff0b0 : COLOR[family]).setDepth(5).setInteractive({useHandCursor: true});
  const tag = label(S, x, y - 44, e.bossOrb || e.refillAll ? '✚ REFILL' : e.unlock ? `×${family} BEAM` : `×${family} AMMO`, 14, '#e7edc4');
  sprite.on('pointerdown', () => S.openOrb(self));
  const self = {
    type: 'orb', id, family, unlock: !!e.unlock, bossOrb: !!e.bossOrb, refillAll: !!(e.bossOrb || e.refillAll), alive: true, x, y, wasReady: true,
    visible: () => (e.bossOrb ? !!(S.boss?.alive && S.bossIntro <= 0) : e.refillAll ? [2, 3, 4, 5].some(n => S.run.owned[n]) : e.unlock ? !S.run.owned[family] : S.run.owned[family]),
    ready: () => self.visible() && orbReady(S.run, id),
    update() {
      const ready = self.ready();
      if (ready && !self.wasReady) { S.burst(x, y, COLOR[family], 26); S.sfx(830, 0.22); S.say(`✦ ×${family} orb glows again`, 1.6); S.log('respawn', {id}); }
      self.wasReady = ready;
    },
    draw(g, t) {
      const on = self.ready(), shown = self.visible();
      sprite.setVisible(on).setY(y + Math.sin(t * 2.5) * 6);
      tag.setVisible(shown).setAlpha(on ? 1 : 0.35);
      if (!on) return;
      g.lineStyle(1, COLOR[family], 0.6); g.strokeEllipse(x, y, 66, 50);
      for (let i = 0; i < 4; i++) {
        const a = t * 1.7 + i * Math.PI / 2;
        g.fillStyle(COLOR[family], 0.8); g.fillRect(x + Math.cos(a) * 32 - 1, y + Math.sin(a) * 22 - 1, 3, 3);
      }
    },
    destroy() { sprite.destroy(); tag.destroy(); },
  };
  return self;
}

export function shrine(e, S) {
  const x = (e.tx + 0.5) * TILE, y = e.ty * TILE;
  let armed = true;
  const self = {
    type: 'shrine', id: e.id, alive: true, x, y,
    update() {
      const near = Math.abs(S.p.x - x) < 50 && Math.abs(S.p.y - y) < 40;
      if (near && armed) {
        armed = false;
        S.run.shrine = {room: S.room.id, x};
        healFull(S.run);
        S.say('SHRINE · SAVED AND HEALED', 1.8);
        S.sfx(660, 0.3);
        S.burst(x, y - 60, 0xd5eda7, 30);
        S.log('shrine', {room: S.room.id});
      }
      if (!near) armed = true;
    },
    draw(g, t) {
      g.fillStyle(0x0d1a28); g.fillRect(x - 22, y - 12, 44, 12);
      g.fillStyle(0x2c4152); g.fillRect(x - 10, y - 70, 20, 58);
      g.fillStyle(0x7d9b8f); g.fillRect(x - 16, y - 76, 32, 7);
      g.fillStyle(0xf4dfa4, 0.95); g.fillRect(x - 5, y - 64, 10, 14);
      g.fillStyle(0xffdda0, 0.1 + 0.04 * Math.sin(t * 3)); g.fillCircle(x, y - 58, 38);
    },
    destroy() {},
  };
  return self;
}

export function finale(e, S) {
  const x = (e.tx + 0.5) * TILE, y = e.ty * TILE, needs = e.needs || [];
  const open = () => needs.every(id => S.run.items.has(id));
  const beacon = S.add.image(x, y - 120, 'core').setDisplaySize(60, 60).setDepth(3);
  const sign = label(S, x, y - 200, '', 18, '#e7efc7');
  let armed = true;
  const self = {
    type: 'finale', alive: true,
    update() {
      const near = Math.abs(S.p.x - x) < 60;
      if (near && armed && open()) { armed = false; S.finish(); }
      if (Math.abs(S.p.x - x) > 160) armed = true;
    },
    draw(g, t) {
      const on = open();
      sign.setText(on ? 'CORE CLASH →' : 'CHARGE THE FOUR RUNES');
      beacon.setY(y - 120 + Math.sin(t * 2) * 7).setVisible(on);
      g.lineStyle(6, 0x759b97, on ? 0.8 : 0.35); g.strokeRoundedRect(x - 44, y - 182, 88, 182, 36);
      if (!on) return;
      [2, 3, 4, 5].forEach((n, i) => {
        const k = t * 1.6 + i * Math.PI / 2;
        g.lineStyle(3, COLOR[n], 0.75); g.strokeRoundedRect(x - 36 + Math.sin(k) * 3, y - 173 + Math.cos(k) * 3, 72, 173, 30);
        g.fillStyle(COLOR[n], 0.9); g.fillCircle(x + Math.cos(k) * 30, y - 90 + Math.sin(k) * 70, 4);
      });
      g.fillStyle(0xfff4d0, 0.1 + 0.05 * Math.sin(t * 3)); g.fillRect(x - 33, y - 140, 66, 140);
    },
    destroy() { beacon.destroy(); sign.destroy(); },
  };
  return self;
}

// Rune: charged only by its own beam, skip counting to 5N like the stone blocks. Charging refills that beam.
export function rune(e, S) {
  const x = (e.tx + 0.5) * TILE, y = e.ty * TILE + 16, c = COLOR[e.n];
  const charged = () => S.run.items.has(e.id);
  const mark = label(S, x, y, `×${e.n}`, 22, CSS[e.n]);
  const count = label(S, x, y + 50, '', 13, CSS[e.n]);
  const self = {
    type: 'rune', id: e.id, target: !charged(), alive: true, x, y, hp: charged() ? 0 : e.product, max: e.product, flash: 0,
    math: () => ({kind: 'rune', n: e.n, product: e.product}),
    rect: () => ({x: x - 32, y: y - 32, w: 64, h: 64}),
    applyDamage(w) {
      self.hp = Math.max(0, self.hp - w);
      self.flash = 0.2;
      S.float(x, y - 58 - (self.hp ? 0 : 16), hitText(self.math(), w, self.hp), CSS[w], self.hp ? 22 : 26);
      S.burst(x, y, c, 14);
      S.sfx(300 + (e.product - self.hp) * 30, 0.08);
      if (self.hp) return;
      self.target = false;
      S.run.items.add(e.id);
      refill(S.run, e.n);
      S.float(x, y + 74, `×${e.n} REFILLED`, CSS[e.n], 15);
      S.burst(x, y, c, 60);
      S.sfx(1320, 0.4);
      S.log('rune', {n: e.n});
      if ([2, 3, 4, 5].every(n => S.run.items.has(`rune-${n}`))) { S.banner('THE PORTAL OPENS', 'All four runes are charged'); S.cameras.main.flash(260, 230, 230, 255); }
    },
    update(dt) { self.flash = Math.max(0, self.flash - dt); },
    draw(g, t) {
      const on = charged(), lit = on ? 5 : Math.floor((e.product - self.hp) / e.n);
      if (on) { g.fillStyle(c, 0.12 + 0.05 * Math.sin(t * 3)); g.fillCircle(x, y, 54 + Math.sin(t * 2) * 4); }
      g.fillStyle(0x0b1322, 0.8); g.fillCircle(x, y, 30);
      g.fillStyle(c, on ? 0.45 + 0.1 * Math.sin(t * 4) : 0.08 + 0.06 * lit);
      g.fillCircle(x, y, 27);
      g.lineStyle(3, self.flash ? 0xffffff : c, on ? 0.95 : 0.55); g.strokeCircle(x, y, 30);
      for (let i = 0; i < 5; i++) {
        const k = -Math.PI / 2 + i * Math.PI * 2 / 5;
        g.fillStyle(i < lit ? c : 0x1a2436, i < lit ? 1 : 0.9); g.fillCircle(x + Math.cos(k) * 40, y + Math.sin(k) * 40, 5);
      }
      count.setText(on ? 'CHARGED' : `${e.product - self.hp} / ${e.product}`);
    },
    destroy() { mark.destroy(); count.destroy(); },
  };
  return self;
}

// Training dummy: the Pendulum Sentinel with monster rules and rewards, but nothing it does can hurt.
// Each problem is a "life": clearing it counts as a kill (streak, refund, drops), then a new problem swings in.
export function dummy(e, S) {
  const pivot = {x: (e.tx + 0.5) * TILE, y: 70}, len = 250;
  const sprite = S.add.sprite(pivot.x, 320, 'sentinel', 1).setDepth(4);
  const badge = label(S, 0, 0, '', 20, '#f7ecd0');
  const hint = label(S, 0, 0, '×5 = DOUBLE', 13, '#ffb3c1');
  const bag = [];
  const self = {
    type: 'dummy', id: e.id, target: true, alive: true, x: pivot.x, y: 320, a: 1, b: 2,
    hp: 2, max: 2, armor: 0, armorMax: 0, stun: 0, spent: {}, used: new Set(), matched: false,
    hit: 0, swing: 0, shown: 0, idle: 0, next: 0, attack: 2.4, frame: 1,
    math: () => ({kind: 'dummy', a: self.a, b: self.b}),
    rect: () => ({x: self.x - 44, y: self.y - 64, w: 88, h: 124}),
    glowing: () => self.a === 5 || self.b === 5,
    newProblem(first) {
      if (!bag.length) bag.push(...[1, 2, 3, 4, 5].sort(() => Math.random() - 0.5));
      let a = first ? 1 : bag.pop();
      if (a === self.a && bag.length && !first) { bag.unshift(a); a = bag.pop(); }
      const bs = [2, 3, 4, 6].filter(n => n !== a);
      Object.assign(self, {a, b: first ? 2 : bs[Math.floor(Math.random() * bs.length)], spent: {}, used: new Set(), matched: false, shown: 0, idle: 0, target: true});
      self.max = self.hp = self.a * self.b;
      self.armor = self.armorMax = armorFor(self.a, self.b);
      if (!first) { S.sfx(self.glowing() ? 1320 : 880, 0.18); S.burst(self.x, self.y, self.glowing() ? COLOR[5] : 0xffe2a0, 20); }
      S.log('dummy-problem', {a: self.a, b: self.b});
    },
    applyDamage(w) {
      self.hit = 0.18;
      self.idle = 0;
      strike(self, w, S);
      if (hitArmor(self, w, S)) return;
      const dmg = damageFor(self.math(), w);
      self.hp = Math.max(0, self.hp - dmg);
      S.float(self.x + (Math.random() < 0.5 ? -1 : 1) * 60, self.y - 40, dmg > w ? `−${dmg} ×2!` : '−' + dmg, CSS[w], dmg > w ? 26 : 22);
      if (self.hp) return;
      const problem = {a: self.a, b: self.b};
      onKill(S, self.x, self.y, w, problem, 'dummy', self);
      if (isMatch(self.math(), w)) { S.spawn(pickup({kind: 'ammo', family: w, amount: 2}, self.x, self.y, S)); S.log('dummy-drop', {family: w}); }
      self.target = false;
      self.next = 0.8;
    },
    update(dt) {
      self.hit = Math.max(0, self.hit - dt);
      if (self.next > 0) { self.next -= dt; if (self.next <= 0) self.newProblem(); }
      if (self.stun > 0) self.stun -= dt;
      else self.swing += dt;
      const ang = Math.sin(self.swing * 0.85) * 0.95;
      self.x = pivot.x + Math.sin(ang) * len * 1.25;
      self.y = pivot.y + Math.cos(ang) * len;
      self.ang = ang;
      self.shown += dt;
      self.idle += dt;
      // Untouched problems rotate so the player sees every beam; a 5 stays up only briefly.
      if (self.target && (self.idle > 8 || (self.glowing() && self.shown > 4))) self.newProblem();
      self.attack -= dt;
      if (self.attack <= 0) {
        self.attack = 3.2;
        const dx = S.p.x - self.x, dy = S.p.y - 40 - self.y, d = Math.hypot(dx, dy) || 1;
        S.enemyShot({x: self.x, y: self.y, vx: dx / d * 220, vy: dy / d * 220, g: 0, r: 10, color: 0xd8e2ec, harmless: true});
        S.sfx(520, 0.08);
      }
    },
    draw(g, t) {
      g.lineStyle(3, 0x8a6a3a, 0.8); g.lineBetween(pivot.x, pivot.y, self.x, self.y - 40);
      g.fillStyle(0xc89a52); g.fillCircle(pivot.x, pivot.y, 8);
      if (self.glowing() && self.target) {
        g.fillStyle(COLOR[5], 0.16 + 0.1 * Math.sin(t * 12)); g.fillCircle(self.x, self.y, 86);
        g.lineStyle(3, COLOR[5], 0.8); g.strokeCircle(self.x, self.y, 78 + Math.sin(t * 12) * 4);
      }
      // One hanging body (frame 1); the swing leans it and a hit squashes it, instead of swapping poses.
      const kick = self.hit ? Math.sin(self.hit * 55) * (self.hit / 0.18) : 0;
      sprite.setFrame(1).setPosition(self.x, self.y).setFlipX(S.p.x < self.x).setAlpha(self.target ? 1 : 0.55)
        .setRotation(-(self.ang || 0) * 0.3 + kick * 0.12).setScale(1 + (self.hit ? 0.06 * kick : 0), 1 - (self.hit ? 0.06 * kick : 0))
        .setTint(self.stun > 0 ? (Math.floor(t * 20) % 2 ? 0xffe08a : 0xfff4c8) : self.hit ? 0xfff0d8 : self.glowing() ? 0xffd0dc : 0xffffff);
      badge.setVisible(self.target).setPosition(self.x, self.y - 100 + Math.sin(t * 2.4) * 2).setText(`${self.a} · ${self.b}`)
        .setColor(self.glowing() ? '#ffb3c1' : '#f7ecd0');
      hint.setVisible(self.glowing() && self.target).setPosition(self.x, self.y - 124);
      if (self.target) healthBar(g, self.x, self.y - 86, self.hp, self.max, self.armor, self.armorMax);
    },
    destroy() { sprite.destroy(); badge.destroy(); hint.destroy(); },
  };
  self.newProblem(true);
  return self;
}

export function build(e, S) {
  switch (e.type) {
    case 'skeleton': return [skeleton(e, S)];
    case 'bat': return [bat(e, S)];
    case 'seal': return S.run.items.has(e.id) ? [] : [seal(e, S)];
    case 'block': return S.run.items.has(e.id) ? [] : [block(e, S)];
    case 'item': return S.run.items.has(e.id) ? [] : [item(e, S)];
    case 'shrine': {
      const x = (e.tx + 0.5) * TILE, y = e.ty * TILE;
      return [shrine(e, S), ...e.orbs.map((f, i) => orb({id: `${e.id}-x${f}`, family: f}, S, x + (i - (e.orbs.length - 1) / 2) * 110, y - 150))];
    }
    case 'orb': return S.run.items.has(e.id) ? [] : [orb(e, S, (e.tx + 0.5) * TILE, e.ty * TILE - (e.refillAll ? 60 : 70))];
    case 'finale': return [finale(e, S)];
    case 'rune': return [rune(e, S)];
    case 'dummy': return [dummy(e, S)];
    default: return [];
  }
}

