import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS, ROOM_COUNT, SCREEN_W, SCREEN_H, COLLECTIBLES, doorSpan} from '../dist/poc-ix/world.js';
import {solve} from './solver.mjs';

const rooms = Object.values(ROOMS);

test('room count and dimensions', () => {
  assert.equal(rooms.length, ROOM_COUNT);
  for (const r of rooms) {
    assert.equal(r.rows.length, r.h * SCREEN_H, r.id);
    for (const row of r.rows) assert.equal(row.length, r.w * SCREEN_W, r.id);
  }
});

test('rooms do not overlap on the map grid', () => {
  const cells = new Map();
  for (const r of rooms) for (let x = r.gx; x < r.gx + r.w; x++) for (let y = r.gy; y < r.gy + r.h; y++) {
    assert.ok(!cells.has(`${x},${y}`), `${r.id} overlaps ${cells.get(`${x},${y}`)}`);
    cells.set(`${x},${y}`, r.id);
  }
});

test('doors are carved and reciprocal', () => {
  for (const r of rooms) for (const d of r.doors) {
    const s = doorSpan(r, d);
    for (let y = s.ty0; y <= s.ty1; y++) assert.equal(r.rows[y][s.tx], '.', `${r.id} door ${d.side}${d.row}`);
    if (!d.to) continue;
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

test('actors stand on a surface', () => {
  for (const r of rooms) for (const e of r.entities) {
    if (!['skeleton', 'item', 'shrine', 'orb', 'finale'].includes(e.type)) continue;
    const c = r.rows[e.ty][e.tx];
    assert.ok(c === '#' || c === '=', `${r.id} ${e.id || e.type} at ${e.tx},${e.ty} stands on '${c}'`);
    assert.equal(r.rows[e.ty - 1][e.tx], '.', `${r.id} ${e.id || e.type} is buried`);
  }
});

test('whole slice completes in order', () => {
  const s = solve();
  assert.equal(s.rooms.size, ROOM_COUNT);
  for (const id of [...COLLECTIBLES, 'w2', 'w3']) assert.ok(s.have.has(id), id);
  assert.deepEqual([...s.owned].sort(), [1, 2, 3, 4]);
});

test('Moon Boots gate the upper shaft', () => {
  const s = solve({without: ['boots']});
  assert.ok(!s.rooms.has('H') && !s.rooms.has('K') && !s.rooms.has('L'));
  assert.ok(!s.have.has('tank1'));
});

test('x3 opens the vault; x4 opens the closet', () => {
  const s = solve({without: ['w3']});
  assert.ok(!s.rooms.has('K') && s.rooms.has('L'));
  const t = solve({without: ['orb-4']});
  assert.ok(!t.have.has('tank3') && t.rooms.has('L'));
});

test('x5 teaser stays sealed', () => {
  const c = ROOMS.C.doors.find(d => d.via === 'seal-5');
  assert.equal(c.to, null);
});
