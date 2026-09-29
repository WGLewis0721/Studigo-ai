import {TILE} from './physics.js';
import {canDamage} from './rules.js';
import {COLOR, CSS, overlaps, item, pickup} from './actors.js';

const FLOOR = 15 * TILE;
const NONE = {kind: 'plate', a: 0, b: 0};

// Shared plate bookkeeping: operands, damage, ammo safety and defeat.
function platesFor(def, S, onDefeat) {
  const plates = def.plates.map(p => ({...p, hp: p.a * p.b}));
  const state = {plates, index: 0, done: false, stuck: 0};
  const current = () => plates[state.index];
  const familyFor = p => [p.a, p.b].filter(n => n > 1 && S.run.owned[n]).sort((x, y) => y - x)[0];
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
    const f = familyFor(current());
    if (f) S.spawn(pickup({kind: 'ammo', family: f, amount: 4}, S.p.x + (S.p.x < 480 ? 60 : -60), S.p.y - 120, S));
    S.say(`NEXT PLATE · ${current().a} · ${current().b}`, 1.4);
  };
  // If no owned weapon with ammo can hurt the current plate, offer a matching capsule every 8 s.
  state.safety = dt => {
    if (state.done) return;
    const p = current();
    const ok = [1, 2, 3, 4].some(w => S.run.owned[w] && (w === 1 || S.run.ammo[w] > 0) && canDamage({kind: 'plate', a: p.a, b: p.b}, w));
    state.stuck = ok ? 0 : state.stuck + dt;
    const f = familyFor(p);
    if (state.stuck > 8 && f) {
      state.stuck = 0;
      S.spawn(pickup({kind: 'ammo', family: f, amount: 4}, 480, 200, S));
      S.say(`✦ ×${f} capsule`, 1.2);
    }
  };
  return state;
}

function reward(def, S) {
  S.spawn(item({...def.reward, tx: 14, ty: 15}, S));
  S.bossDefeated(def);
}

export function twinWarden(def, S) {
  const twins = [0, 1].map(i => ({
    i, x: i ? 800 : 440, y: FLOOR, vx: 0, vy: 0, air: false, state: 'idle', timer: 1.6 + i * 0.9, hit: 0,
    sprite: S.add.image(0, 0, 'skeleton').setOrigin(0.5, 0.77).setScale(2.3).setDepth(4),
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
    name: def.name, id: def.id, alive: true, get plates() { return P.plates; }, get index() { return P.index; },
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
        tw.timer -= dt;
        if (tw.air) {
          tw.vy += 1150 * dt;
          tw.x = Math.max(90, Math.min(870, tw.x + tw.vx * dt));
          tw.y += tw.vy * dt;
          if (tw.y >= FLOOR) { tw.y = FLOOR; tw.air = false; tw.timer = 0.8; S.cameras.main.shake(80, 0.002); }
        } else if (tw.timer <= 0) {
          const hop = active(tw) && tw.state !== 'hop';
          tw.state = hop ? 'hop' : 'throw';
          if (hop) {
            tw.air = true;
            tw.vy = -560;
            const land = S.p.x + (tw.x < S.p.x ? -150 : 150);
            tw.vx = Math.max(-260, Math.min(260, (land - tw.x) / 0.97));
          } else {
            const dx = S.p.x - tw.x;
            S.enemyShot({x: tw.x, y: tw.y - 130, vx: dx / 1.05, vy: -470, g: 900, r: 9, color: 0xeae3d4, spin: true});
            S.sfx(300, 0.08);
            tw.timer = active(tw) ? 1.3 : 3.2;
          }
        }
        if (overlaps(targets[tw.i].rect(), S.playerRect())) S.hurtPlayer(tw.x);
      }
    },
    draw(g, t) {
      for (const tw of twins) {
        const on = active(tw), fall = dying ? Math.min(1.4, dying * 2) : 0;
        tw.sprite.setPosition(tw.x + (tw.hit ? Math.sin(t * 90) * 5 : 0), tw.y).setFlipX(S.p.x < tw.x)
          .setRotation(fall * (tw.i ? 1 : -1)).setAlpha(dying ? Math.max(0, 1 - dying * 0.7) : on ? 1 : 0.42 + 0.08 * Math.sin(t * 4))
          .setTint(tw.hit ? 0xffffff : on ? 0xf2eadb : 0x8a90b8);
        if (on && !dying) { g.lineStyle(3, 0xffd59a, 0.35 + 0.2 * Math.sin(t * 6)); g.strokeEllipse(tw.x, tw.y - 70, 120, 170); }
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
  const b = {x: 480, y: 380, state: 'float', timer: 2.2, hit: 0, frame: 0, tx: 480, from: null};
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
    name: def.name, id: def.id, alive: true, get plates() { return P.plates; }, get index() { return P.index; },
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
        b.x += (480 + Math.sin(clock * 0.7) * 260 - b.x) * Math.min(1, dt * 1.5);
        b.y = 380 + Math.sin(clock * 2.2) * 14;
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
      sprite.setFrame(b.frame).setPosition(b.x, b.y)
        .setAlpha(dying ? Math.max(0, 1 - (dying - 0.5) * 1.1) : 1)
        .setTint(b.hit ? 0xffffff : b.state === 'telegraph' && Math.floor(t * 16) % 2 ? 0xff9a8a : 0xffffff);
      const c = core();
      badge.setVisible(!P.done).setPosition(c.x, c.y - 70).setText(P.done ? '' : `${P.current().a} · ${P.current().b}`);
      if (!P.done) { g.fillStyle(0xfff0c0, 0.18 + 0.1 * Math.sin(t * 5)); g.fillCircle(c.x, c.y, 26); }
      if (b.state === 'telegraph') { g.lineStyle(2, 0xff9a8a, 0.6); g.lineBetween(b.tx, FLOOR, b.tx, FLOOR - 30); }
    },
    destroy() { sprite.destroy(); badge.destroy(); },
  };
  return boss;
}

export function makeBoss(def, S) {
  return def.kind === 'twin' ? twinWarden(def, S) : trineGuardian(def, S);
}
