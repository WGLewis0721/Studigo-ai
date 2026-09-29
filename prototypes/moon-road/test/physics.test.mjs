import test from 'node:test';
import assert from 'node:assert/strict';
import {TILE, makeGrid, moveBody} from '../dist/poc-ix/physics.js';

// 10 wide x 8 tall, floor at row 6, one-way at row 3 cols 2-4, wall at col 8 rows 4-5.
const rows = [
  '##########',
  '#........#',
  '#........#',
  '#.===....#',
  '#.......##',
  '#.......##',
  '##########',
  '##########',
];
const grid = makeGrid(rows);
const body = (x, y) => ({x, y, w: 20, h: 40});
const settle = (b, dx = 0, frames = 60, rects) => { let r; for (let i = 0; i < frames; i++) r = moveBody(b, dx, 10, grid, rects); return r; };

test('grid bounds', () => {
  assert.equal(TILE, 32);
  assert.equal(grid.w, 10);
  assert.equal(grid.h, 8);
  assert.equal(grid.at(3, -1), '#');
  assert.equal(grid.at(3, 8), '#');
  assert.equal(grid.at(-1, 2), '.');
  assert.equal(grid.at(10, 2), '.');
});

test('falls onto solid floor', () => {
  const b = body(100, 100);
  const r = settle(b);
  assert.ok(r.ground);
  assert.equal(b.y, 6 * TILE);
});

test('passes up through one-way, lands on it falling', () => {
  const b = body(100, 6 * TILE);
  moveBody(b, 0, -100, grid);
  assert.ok(b.y < 3 * TILE);
  const r = settle(b);
  assert.ok(r.ground);
  assert.equal(b.y, 3 * TILE);
});

test('walls block horizontal movement', () => {
  const b = body(200, 6 * TILE);
  const r = moveBody(b, 200, 0, grid);
  assert.ok(r.wall);
  assert.equal(b.x + b.w / 2, 8 * TILE);
});

test('ceiling stops upward movement', () => {
  const b = body(250, 3 * TILE);
  const r = moveBody(b, 0, -200, grid);
  assert.ok(r.ceiling);
  assert.equal(b.y - b.h, TILE);
});

test('extra rects are solid', () => {
  const b = body(60, 6 * TILE);
  const r = moveBody(b, 100, 0, grid, [{x: 100, y: 100, w: 32, h: 92}]);
  assert.ok(r.wall);
  assert.equal(b.x + b.w / 2, 100);
});

test('walking off a ledge loses ground', () => {
  const b = body(100, 3 * TILE);
  assert.ok(moveBody(b, 0, 1, grid).ground);
  moveBody(b, 80, 0, grid);
  assert.ok(!moveBody(b, 0, 1, grid).ground);
});
