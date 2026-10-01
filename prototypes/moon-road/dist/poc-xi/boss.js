import {TILE} from './physics.js';
import {canDamage} from './rules.js';
import {COLOR, CSS, overlaps, item, pickup} from './actors.js';
import {ART} from './art/art.js';

const FLOOR = 15 * TILE;
const NONE = {kind: 'plate', a: 0, b: 0};

// Shared plate bookkeeping: operands, damage, ammo safety and defeat.
function platesFor(def, S, onDefeat) {
  const plates = def.plates.map(p => ({...p, hp: p.a * p.b}));
  const state = {plates, index: 0, done: false, stuck: 0};
  const current = () => plates[state.index];
  const familyFor = p => [p.a, p.b].filter(n => n > 1 && S.run.owned[n]).sort((x, y) => y - x)[0];
  // Enough rounds of the best owned matching beam to finish a plate, plus two for misses (at least 3).
  const supply = (p, x, y) => {
    const f = familyFor(p);
    if (!f) return;
    const n = Math.max(3, Math.ceil(p.hp / f) + 2 - S.run.ammo[f]);
    if (Math.ceil(p.hp / f) + 2 > S.run.ammo[f]) S.spawn(pickup({kind: 'ammo', family: f, amount: n}, x, y, S));
  };
  state.current = current;
  state.math = () => (state.done ? NONE : {kind: 'plate', a: current().a, b: current().b});
  state.damage = (w, x, y) => {
    const p = current();
    p.hp = Math.max(0, p.hp - w);
    S.float(x + (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 25), y + 30, '−' + w, CSS[w], 26);
    S.burst(x, y, COLOR[w], w > 1 ? 26 : 12);
    S.sfx(140, 0.1);
    S.log('plate-hit', {boss: def.id, plate: state.index, a: p.a, b: p.b, weapon: w, hp: p.hp});
    if (p.hp) return;
    S.burst(x, y, 0xfff1c8, 50);
    S.sfx(700, 0.25);
    S.cameras.main.shake(140, 0.004);
    state.index++;
    if (state.index >= plates.length) { state.done = true; onDefeat(); return; }
    supply(current(), S.p.x + (S.p.x < 480 ? 60 : -60), S.p.y - 120);
    S.say(`NEXT PLATE · ${current().a} · ${current().b}`, 1.4);
  };
  // If no owned beam with ammo can hurt the current plate, a capsule appears beside the dragon after 3 s.
  state.safety = dt => {
    if (state.done) return;
    const p = current();
    const ok = [1, 2, 3, 4, 5].some(w => S.run.owned[w] && (w === 1 || S.run.ammo[w] > 0) && canDamage({kind: 'plate', a: p.a, b: p.b}, w));
    state.stuck = ok ? 0 : state.stuck + dt;
    if (state.stuck > 3 && familyFor(p)) {
      state.stuck = 0;
      supply(p, S.p.x + (S.p.x < 480 ? 70 : -70), S.p.y - 140);
      S.say(`✦ ×${familyFor(p)} capsule`, 1.2);
    }
  };
  return state;
}

function reward(def, S) {
  def.rewards.forEach((r, i) => S.spawn(item({...r, tx: 13 + i * 3, ty: 15}, S)));
  S.bossDefeated(def);
}

// World position of a generated clock dial for the current frame (origin bottom-centre or centre).
function dialAt(sprite, F, frame, originY) {
  const d = F.dials[frame] || F.dials[0], w = F.frameWidth * sprite.scaleX, h = F.frameHeight * sprite.scaleY;
  const fx = sprite.flipX ? 1 - d.x : d.x;
  return {x: sprite.x + (fx - 0.5) * w, y: sprite.y - originY * h + d.y * h, r: d.r * w};
}

export function twinWarden(def, S) {
  const twins = [0, 1].map(i => ({
    i, x: i ? 800 : 440, y: FLOOR, vx: 0, vy: 0, air: false, state: 'idle', timer: 1.6 + i * 0.9, hit: 0,
    throwT: 0, step: 0, walking: false, sprite: S.add.sprite(0, 0, 'twin', 0).setOrigin(0.5, (ART.twin.frameHeight - 4) / ART.twin.frameHeight).setDepth(4),
  }));
  const badge = S.add.text(0, 0, '', {fontFamily: 'monospace', fontSize: 22, fontStyle: 'bold', color: '#fff3d6', stroke: '#200a10', strokeThickness: 5}).setOrigin(0.5).setDepth(6);
  let dying = 0;
  const P = platesFor(def, S, () => { dying = 0.001; S.sfx(90, 0.6); });
  const active = tw => !P.done && P.current().owner === tw.i;
  const targets = twins.map(tw => ({
    target: true, alive: true,
    rect: () => ({x: tw.x - 36, y: tw.y - 146, w: 72, h: 146}),
    math: () => (active(tw) ? P.math() : NONE),
    applyDamage: w => { tw.hit = 0.18; P.damage(w, tw.x, tw.y - 175); },
  }));
  const boss = {
    name: def.name, id: def.id, kind: def.kind, alive: true, get plates() { return P.plates; }, get index() { return P.index; },
    // The dormant twin is a ghost: shots pass through it until its plate comes up.
    targets: () => (P.done ? [] : targets.filter((_, i) => active(twins[i]))),
    update(dt) {
      if (dying) {
        dying += dt;
        if (dying > 1.2 && boss.alive) { boss.alive = false; reward(def, S); }
        return;
      }
      P.safety(dt);
      for (const tw of twins) {
        tw.hit = Math.max(0, tw.hit - dt);
        tw.throwT = Math.max(0, tw.throwT - dt);
        tw.timer -= dt;
        if (tw.air) {
          tw.vy += 1150 * dt;
          tw.x = Math.max(90, Math.min(870, tw.x + tw.vx * dt));
          tw.y += tw.vy * dt;
          if (tw.y >= FLOOR) { tw.y = FLOOR; tw.air = false; tw.timer = 0.9; S.cameras.main.shake(120, 0.004); S.burst(tw.x, FLOOR, 0xb8a888, 18); S.sfx(90, 0.2); }
        } else if (tw.timer <= 0) {
          const hop = active(tw) && tw.state !== 'hop';
          tw.state = hop ? 'hop' : 'throw';
          if (hop) {
            // Big leap (~260 px high) that arcs over the dragon and lands beyond it; its shadow marks
            // the landing spot. Classic dodge: run underneath while it's airborne.
            tw.air = true;
            tw.vy = -780;
            const land = Math.max(90, Math.min(870, S.p.x + (tw.x < S.p.x ? 190 : -190)));
            tw.vx = Math.max(-420, Math.min(420, (land - tw.x) / (2 * 780 / 1150)));
            tw.land = land;
            S.sfx(240, 0.25);
          } else {
            const dx = S.p.x - tw.x;
            S.enemyShot({x: tw.x, y: tw.y - 130, vx: dx / 1.05, vy: -470, g: 900, r: 9, color: 0xeae3d4, spin: true});
            S.sfx(300, 0.08);
            tw.throwT = 0.4;
            tw.timer = active(tw) ? 1.3 : 3.2;
          }
        }
        tw.walking = false;
        if (!tw.air && tw.throwT <= 0 && !P.done) {
          // Walk: the live twin stalks the dragon and keeps its range; the dormant one drifts away from it.
          const dx = S.p.x - tw.x, adx = Math.abs(dx), other = twins[1 - tw.i];
          const v = active(tw) ? (adx > 270 ? Math.sign(dx) * 78 : adx < 150 ? -Math.sign(dx) * 54 : 0) : (adx < 340 ? -Math.sign(dx) * 44 : 0);
          const nx = Math.max(90, Math.min(870, tw.x + v * dt));
          if (v && (Math.abs(nx - other.x) >= 80 || Math.abs(nx - other.x) > Math.abs(tw.x - other.x))) {
            const before = Math.floor(tw.step) % 4;
            tw.step += Math.abs(v) * dt / 20;
            tw.x = nx;
            tw.walking = true;
            const after = Math.floor(tw.step) % 4;
            if (after !== before && (after === 1 || after === 3) && active(tw)) { S.burst(tw.x + (after === 1 ? -14 : 14), FLOOR, 0xb8a888, 3); S.sfx(110, 0.05); }
          }
        }
        if (overlaps(targets[tw.i].rect(), S.playerRect())) S.hurtPlayer(tw.x);
      }
    },
    draw(g, t) {
      for (const tw of twins) {
        const on = active(tw), fall = dying ? Math.min(1.4, dying * 2) : 0;
        const stride = tw.walking && !tw.air && tw.throwT <= 0 && !dying;
        tw.sprite.setTexture(stride ? 'twin-walk' : 'twin', stride ? Math.floor(tw.step) % 4 : tw.throwT > 0 ? 1 : 0).setPosition(tw.x + (tw.hit ? Math.sin(t * 90) * 5 : 0), tw.y).setFlipX(S.p.x < tw.x)
          .setRotation(fall * (tw.i ? 1 : -1)).setAlpha(dying ? Math.max(0, 1 - dying * 0.7) : on ? 1 : 0.42 + 0.08 * Math.sin(t * 4))
          .setTint(tw.hit ? 0xffffff : on ? 0xf2eadb : 0x8a90b8);
        if (on && !dying) { g.lineStyle(3, 0xffd59a, 0.35 + 0.2 * Math.sin(t * 6)); g.strokeEllipse(tw.x, tw.y - 70, 120, 170); }
        if (tw.air && !dying) {
          const k = Math.max(0.3, 1 - (FLOOR - tw.y) / 300);
          g.fillStyle(0x000000, 0.35 * k); g.fillEllipse(tw.x, FLOOR - 2, 90 * k, 16 * k);
        }
      }
      const tw = twins[P.done ? 0 : P.current().owner];
      badge.setVisible(!P.done).setPosition(tw.x, tw.y - 185).setText(P.done ? '' : `${P.current().a} · ${P.current().b}`);
    },
    destroy() { twins.forEach(tw => tw.sprite.destroy()); badge.destroy(); },
  };
  return boss;
}

export function trineGuardian(def, S) {
  const scale = 230 / 256, frames = S.cache.json.get('frames').guardian;
  const sprite = S.add.sprite(480, 380, 'guardian', 0).setOrigin(0.5, 1).setScale(scale).setDepth(4);
  const badge = S.add.text(0, 0, '', {fontFamily: 'monospace', fontSize: 22, fontStyle: 'bold', color: '#fff3d6', stroke: '#1a0c22', strokeThickness: 5}).setOrigin(0.5).setDepth(6);
  const b = {x: 480, y: 380, state: 'float', timer: 2.2, hit: 0, frame: 0, tx: 480, from: null, vx: 0, ghost: 0};
  let dying = 0, clock = 0;
  const P = platesFor(def, S, () => { dying = 0.001; S.sfx(80, 0.8); });
  const core = () => {
    const m = frames[b.frame];
    return {x: b.x + (m.coreX - 128) * scale, y: b.y + (m.coreY - 256) * scale};
  };
  const target = {
    target: true, alive: true,
    rect: () => ({x: b.x - 72, y: b.y - 200, w: 144, h: 195}),
    math: () => P.math(),
    applyDamage: w => { b.hit = 0.2; const c = core(); P.damage(w, c.x, c.y - 40); },
  };
  const boss = {
    name: def.name, id: def.id, kind: def.kind, alive: true, get plates() { return P.plates; }, get index() { return P.index; },
    targets: () => (P.done ? [] : [target]),
    update(dt) {
      clock += dt;
      b.hit = Math.max(0, b.hit - dt);
      if (dying) {
        dying += dt;
        b.frame = dying < 0.5 ? 6 : 7;
        if (dying > 1.4 && boss.alive) { boss.alive = false; reward(def, S); }
        return;
      }
      P.safety(dt);
      b.timer -= dt;
      if (b.state === 'float') {
        b.frame = b.hit ? 5 : 0;
        // Drift across the arena, shading toward the dragon so it never just hangs in one spot.
        const want = Math.max(150, Math.min(810, 0.62 * (480 + Math.sin(clock * 0.7) * 260) + 0.38 * S.p.x));
        const nx = b.x + (want - b.x) * Math.min(1, dt * 1.8);
        b.vx = (nx - b.x) / Math.max(dt, 0.001);
        b.x = nx;
        b.y = 380 + Math.sin(clock * 2.2) * 16 + Math.sin(clock * 5.3) * 3;
        if (b.timer <= 0) { b.state = Math.random() < 0.55 ? 'volley' : 'telegraph'; b.timer = b.state === 'volley' ? 0.55 : 0.65; b.tx = S.p.x; }
      } else if (b.state === 'volley') {
        b.frame = 2;
        if (b.timer <= 0) {
          const c = core(), ang = Math.atan2(S.p.y - 40 - c.y, S.p.x - c.x);
          for (const d of [-0.28, 0, 0.28]) S.enemyShot({x: c.x, y: c.y, vx: Math.cos(ang + d) * 290, vy: Math.sin(ang + d) * 290, g: 0, r: 10, color: 0xc9a7ff});
          S.sfx(520, 0.15);
          b.state = 'float'; b.timer = 2.1;
        }
      } else if (b.state === 'telegraph') {
        b.frame = 1;
        if (b.timer <= 0) { b.state = 'dive'; b.timer = 0.45; b.from = {x: b.x, y: b.y}; S.sfx(200, 0.3); }
      } else if (b.state === 'dive') {
        const k = 1 - b.timer / 0.45;
        b.vx = (b.tx - b.from.x) / 0.45;
        b.x = b.from.x + (b.tx - b.from.x) * k;
        b.y = b.from.y + (FLOOR - b.from.y) * k;
        if (b.timer <= 0) { b.state = 'rise'; b.timer = 0.8; S.cameras.main.shake(120, 0.005); }
      } else if (b.state === 'rise') {
        b.y += (380 - b.y) * Math.min(1, dt * 3);
        if (b.timer <= 0) { b.state = 'float'; b.timer = 2.2; }
      }
      if (overlaps({x: b.x - 60, y: b.y - 170, w: 120, h: 160}, S.playerRect())) S.hurtPlayer(b.x);
    },
    draw(g, t) {
      // Lean into movement, wind up (squash + shake) before a dive, stretch through it, and leave afterimages.
      const lean = dying ? 0 : Math.max(-0.14, Math.min(0.14, b.vx * 0.00045)), dive = b.state === 'dive', wind = b.state === 'telegraph';
      sprite.setFrame(b.frame).setPosition(b.x + (wind ? Math.sin(t * 70) * 2 : 0), b.y).setRotation(lean)
        .setScale(scale * (dive ? 0.92 : wind ? 1.05 : 1), scale * (dive ? 1.12 : wind ? 0.93 : 1))
        .setAlpha(dying ? Math.max(0, 1 - (dying - 0.5) * 1.1) : 1)
        .setTint(b.hit ? 0xffffff : wind && Math.floor(t * 16) % 2 ? 0xff9a8a : 0xffffff);
      b.ghost -= 1 / 60;
      if (dive && b.ghost <= 0) {
        b.ghost = 0.045;
        const gh = S.add.sprite(b.x, b.y, 'guardian', b.frame).setOrigin(0.5, 1).setScale(scale).setDepth(3).setAlpha(0.35).setTint(0xc9a7ff);
        S.tweens.add({targets: gh, alpha: 0, duration: 280, onComplete: () => gh.destroy()});
      }
      const c = core();
      badge.setVisible(!P.done).setPosition(c.x, c.y - 70).setText(P.done ? '' : `${P.current().a} · ${P.current().b}`);
      if (!P.done) { g.fillStyle(0xfff0c0, 0.18 + 0.1 * Math.sin(t * 5)); g.fillCircle(c.x, c.y, 26); }
      if (b.state === 'telegraph') { g.lineStyle(2, 0xff9a8a, 0.6); g.lineBetween(b.tx, FLOOR, b.tx, FLOOR - 30); }
    },
    destroy() { sprite.destroy(); badge.destroy(); },
  };
  return boss;
}

// Clockwork Warden: plates print on its clock dial; floor-shockwave slams and arcing gears.
export function clockWarden(def, S) {
  // ~180 px tall. Only the lower body (80 x 130) hurts on contact, so a Moon Boots jump clears it
  // from a ~75 px take-off window instead of a pixel-perfect one.
  const F = ART.clockwarden, oy = (F.frameHeight - 4) / F.frameHeight, scale = 0.7;
  const sprite = S.add.sprite(640, FLOOR, 'clockwarden', 0).setOrigin(0.5, oy).setScale(scale).setDepth(4);
  const dial = S.add.text(0, 0, '', {fontFamily: 'monospace', fontSize: 21, fontStyle: 'bold', color: '#2a1a0c'}).setOrigin(0.5).setDepth(6);
  const b = {x: 640, state: 'walk', timer: 1.8, hit: 0, frame: 0, next: 'slam', step: 0, walking: false, pace: 1, paceT: 1.2};
  const FW = ART.clockwardenWalk;
  const cur = () => (b.walking ? {F: FW, frame: Math.floor(b.step) % 4} : {F, frame: b.frame});
  let dying = 0;
  const P = platesFor(def, S, () => { dying = 0.001; S.sfx(70, 0.9); });
  const target = {
    target: true, alive: true,
    rect: () => ({x: b.x - 60, y: FLOOR - 172, w: 120, h: 162}),
    math: () => P.math(),
    applyDamage: w => { b.hit = 0.18; const c = cur(), d = dialAt(sprite, c.F, c.frame, oy); P.damage(w, d.x, d.y - 30); },
  };
  const boss = {
    name: def.name, id: def.id, kind: def.kind, alive: true, get plates() { return P.plates; }, get index() { return P.index; },
    targets: () => (P.done ? [] : [target]),
    update(dt) {
      b.hit = Math.max(0, b.hit - dt);
      b.walking = false;
      if (dying) {
        dying += dt;
        b.frame = 4;
        if (dying > 1.6 && boss.alive) { boss.alive = false; reward(def, S); }
        return;
      }
      P.safety(dt);
      b.timer -= dt;
      if (b.state === 'walk') {
        b.frame = b.hit ? 3 : 0;
        // Stomp toward the dragon when far, back off when crowded, otherwise pace; every footfall shakes the floor.
        const dx = S.p.x - b.x, adx = Math.abs(dx);
        b.paceT -= dt;
        if (b.paceT <= 0) { b.pace = -b.pace; b.paceT = 1.2 + Math.random(); }
        let v = adx > 230 ? Math.sign(dx) * 92 : adx < 140 ? -Math.sign(dx) * 66 : b.pace * 38;
        const nx = Math.max(300, Math.min(660, b.x + v * dt));
        if (nx === b.x) v = 0;
        if (v && !b.hit) {
          const before = Math.floor(b.step) % 4;
          b.step += Math.abs(v) * dt / 26;
          const after = Math.floor(b.step) % 4;
          b.walking = true;
          if (after !== before && (after === 1 || after === 3)) {
            const side = after === 1 ? -1 : 1;
            S.cameras.main.shake(70, 0.0022);
            S.burst(b.x + side * 34, FLOOR, 0xb8a888, 7);
            S.sfx(70, 0.1);
          }
        }
        b.x = nx;
        if (b.timer <= 0) { b.state = b.next + '-wind'; b.timer = b.next === 'slam' ? 0.8 : 0.55; b.next = b.next === 'slam' ? 'gears' : 'slam'; S.sfx(260, 0.2); }
      } else if (b.state === 'slam-wind' || b.state === 'gears-wind') {
        b.frame = 1;
        if (b.timer <= 0 && b.state === 'slam-wind') {
          b.state = 'slam'; b.timer = 0.5; b.frame = 2;
          for (const dir of [-1, 1]) S.enemyShot({x: b.x + dir * 56, y: FLOOR - 14, vx: dir * 250, vy: 0, g: 0, r: 11, color: 0xffb25a, life: 3.6, wave: true});
          S.cameras.main.shake(180, 0.006);
          S.sfx(90, 0.35);
        } else if (b.timer <= 0) {
          b.state = 'slam'; b.timer = 0.45; b.frame = 2;
          const dx = S.p.x - b.x;
          for (const k of [0.8, 1.2]) S.enemyShot({x: b.x, y: FLOOR - 150, vx: dx / 1.1 * k, vy: -460, g: 900, r: 11, color: 0xd9a24c, spin: true});
          S.sfx(420, 0.12);
        }
      } else if (b.state === 'slam') {
        b.frame = 2;
        if (b.timer <= 0) { b.state = 'walk'; b.timer = 2.0; }
      }
      if (overlaps({x: b.x - 40, y: FLOOR - 130, w: 80, h: 130}, S.playerRect())) S.hurtPlayer(b.x);
    },
    draw(g, t) {
      const c = cur();
      sprite.setTexture(b.walking ? 'clockwarden-walk' : 'clockwarden', c.frame).setPosition(b.x + (b.hit ? Math.sin(t * 80) * 4 : 0), FLOOR).setFlipX(S.p.x > b.x)
        .setAlpha(dying ? Math.max(0, 1 - (dying - 0.6)) : 1)
        .setTint(b.hit ? 0xfff0d8 : b.state === 'slam-wind' && Math.floor(t * 16) % 2 ? 0xffb09a : 0xffffff);
      const d = dialAt(sprite, c.F, c.frame, oy);
      dial.setVisible(!P.done).setPosition(d.x, d.y).setText(P.done ? '' : `${P.current().a}·${P.current().b}`);
      if (!P.done) { g.lineStyle(2, 0xffe2a0, 0.35 + 0.2 * Math.sin(t * 5)); g.strokeCircle(d.x, d.y, d.r + 4); }
    },
    destroy() { sprite.destroy(); dial.destroy(); },
  };
  return boss;
}

export function makeBoss(def, S) {
  if (def.kind === 'twin') return twinWarden(def, S);
  if (def.kind === 'clock') return clockWarden(def, S);
  return trineGuardian(def, S);
}
