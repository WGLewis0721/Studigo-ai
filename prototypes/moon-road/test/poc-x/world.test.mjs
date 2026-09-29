import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS, ROOM_COUNT, SCREEN_W, SCREEN_H, COLLECTIBLES, doorSpan} from '../../dist/poc-x/world.js';
import {solve} from './solver.mjs';

const rooms = Object.values(ROOMS);

test('room count and dimensions', () => {
  assert.equal(rooms.length, ROOM_COUNT);
  for (const r of rooms) {
    assert.equal(r.rows.length, r.h * SCREEN_H, r.id);
    for (const row of r.rows) assert.equal(row.length, r.w * SCREEN_W, r.id);
  }
});

test('rooms do not overlap and fit the 9 x 5 map', () => {
  const cells = new Map();
  for (const r of rooms) for (let x = r.gx; x < r.gx + r.w; x++) for (let y = r.gy; y < r.gy + r.h; y++) {
    assert.ok(x >= 0 && x < 9 && y >= 0 && y < 5, `${r.id} off the map`);
    assert.ok(!cells.has(`${x},${y}`), `${r.id} overlaps ${cells.get(`${x},${y}`)}`);
    cells.set(`${x},${y}`, r.id);
  }
});

test('doors are carved and reciprocal', () => {
  for (const r of rooms) for (const d of r.doors) {
    const s = doorSpan(r, d);
    for (let y = s.ty0; y <= s.ty1; y++) assert.equal(r.rows[y][s.tx], '.', `${r.id} door ${d.side}${d.row}`);
    assert.ok(d.to, `${r.id} has a dead door`);
    const t = ROOMS[d.to], opposite = d.side === 'E' ? 'W' : 'E';
    const back = t.doors.find(b => b.side === opposite && b.to === r.id);
    assert.ok(back, `${r.id}→${d.to} has no way back`);
    assert.equal(r.gy + d.row, t.gy + back.row, `${r.id}→${d.to} global row`);
    assert.equal(d.side === 'E' ? r.gx + r.w : r.gx - t.w, t.gx, `${r.id}→${d.to} adjacency`);
  }
});

test('barriers referenced by doors and items exist', () => {
  for (const r of rooms) for (const x of [...r.doors, ...r.entities]) {
    if (x.via) assert.ok(r.entities.some(e => e.id === x.via), `${r.id} via ${x.via}`);
  }
});

test('ground actors stand on a surface; flyers hang in open air', () => {
  for (const r of rooms) for (const e of r.entities) {
    if (e.type === 'bat') { assert.equal(r.rows[e.ty][e.tx], '.', `${r.id} bat inside a wall`); continue; }
    if (!['skeleton', 'item', 'shrine', 'orb', 'finale'].includes(e.type)) continue;
    const c = r.rows[e.ty][e.tx];
    assert.ok(c === '#' || c === '=', `${r.id} ${e.id || e.type} at ${e.tx},${e.ty} stands on '${c}'`);
    assert.equal(r.rows[e.ty - 1][e.tx], '.', `${r.id} ${e.id || e.type} is buried`);
  }
});

test('every non-boss monster carries a two-number problem', () => {
  for (const r of rooms) for (const e of r.entities) {
    if (e.type !== 'skeleton' && e.type !== 'bat') continue;
    assert.ok(e.a >= 1 && e.a <= 5 && e.b >= 1 && e.b <= 5, `${r.id} ${e.type} ${e.a}·${e.b}`);
  }
});

test('whole slice completes in order', () => {
  const s = solve();
  assert.equal(s.rooms.size, ROOM_COUNT);
  for (const id of [...COLLECTIBLES, 'w2', 'w3', 'w5', 'shield']) assert.ok(s.have.has(id), id);
  assert.deepEqual([...s.owned].sort(), [1, 2, 3, 4, 5]);
});

test('x4 opens the Clock Tower; x5 opens the trial', () => {
  const noX4 = solve({without: ['orb-4']});
  assert.ok(!noX4.rooms.has('M') && !noX4.have.has('w5'));
  const noX5 = solve({without: ['w5']});
  assert.ok(noX5.rooms.has('P') && !noX5.rooms.has('Q') && !noX5.have.has('shieldplus'));
});

test('the Clockwork Warden is beatable before x5; the trial has 25% of its health', () => {
  const plates = ROOMS.P.entities.find(e => e.id === 'clock').plates;
  assert.ok(plates.every(p => [1, 2, 3, 4].some(w => (w === 1 ? p.a === 1 || p.b === 1 : w === p.a || w === p.b))));
  const total = plates.reduce((n, p) => n + p.a * p.b, 0);
  const trial = ROOMS.Q.entities.find(e => e.id === 'trial');
  assert.equal(trial.hp, Math.round(total / 4));
});
