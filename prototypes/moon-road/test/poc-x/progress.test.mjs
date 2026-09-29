import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../dist/poc-x/progress.js';

test('fresh run owns only x1', () => {
  const r = P.newRun();
  assert.deepEqual(r.owned, {1: true, 2: false, 3: false, 4: false, 5: false});
  assert.equal(r.hearts, 5);
  assert.equal(r.shrine.room, 'A');
});

test('weapons fill, spend and empty', () => {
  const r = P.newRun();
  assert.equal(P.spend(r, 2), false);
  P.grantWeapon(r, 2);
  assert.equal(r.ammo[2], 12);
  assert.equal(P.spend(r, 2), true);
  assert.equal(r.ammo[2], 11);
  r.ammo[2] = 0;
  assert.equal(P.spend(r, 2), false);
  assert.equal(P.spend(r, 1), true);
  P.addAmmo(r, 2, 50);
  assert.equal(r.ammo[2], 12);
  P.addAmmo(r, 3, 2);
  assert.equal(r.ammo[3], 0);
  r.ammo[2] = 3;
  P.refill(r, 2);
  assert.equal(r.ammo[2], 12);
});

test('collectibles apply once', () => {
  const r = P.newRun();
  P.collect(r, {id: 'x3', kind: 'expansion', family: 3});
  P.collect(r, {id: 'x3', kind: 'expansion', family: 3});
  assert.equal(r.cap[3], 16);
  assert.equal(r.ammo[3], 0);
  P.grantWeapon(r, 3);
  assert.equal(r.ammo[3], 16);
  r.hearts = 2;
  P.collect(r, {id: 't1', kind: 'tank'});
  assert.equal(r.maxHearts, 6);
  assert.equal(r.hearts, 6);
  P.collect(r, {id: 'boots', kind: 'boots'});
  assert.equal(r.boots, true);
  P.collect(r, {id: 'w2', kind: 'weapon', family: 2});
  assert.equal(r.owned[2], true);
  assert.ok(r.items.has('t1'));
});

test('hurt and heal', () => {
  const r = P.newRun();
  for (let i = 0; i < 4; i++) assert.equal(P.hurt(r), false);
  assert.equal(P.hurt(r), true);
  P.healFull(r);
  assert.equal(r.hearts, 5);
});

test('orbs sleep for 20 active seconds and rotate attempts', () => {
  const r = P.newRun();
  assert.equal(P.ORB_COOLDOWN, 20);
  assert.ok(P.orbReady(r, 'o'));
  assert.equal(P.submitOrb(r, 'o'), 0);
  assert.ok(!P.orbReady(r, 'o'));
  r.active = 19.9;
  assert.ok(!P.orbReady(r, 'o'));
  r.active = 20;
  assert.ok(P.orbReady(r, 'o'));
  assert.equal(P.orbAttempt(r, 'o'), 1);
});

test('map percent', () => {
  const r = P.newRun();
  for (const id of 'ABCDE') P.visit(r, id);
  P.visit(r, 'A');
  assert.equal(P.mapPercent(r, 12), 42);
});


test('clock shield: 3 charges, absorbs hits, recharges on kills, +1 upgrade', () => {
  const r = P.newRun();
  assert.equal(P.absorb(r), false);
  P.shieldKill(r);
  assert.equal(r.shield.charges, 0);
  P.collect(r, {id: 'shield', kind: 'shield'});
  assert.deepEqual(r.shield, {owned: true, charges: 3, max: 3});
  assert.equal(P.absorb(r), true);
  assert.equal(P.absorb(r), true);
  assert.equal(r.shield.charges, 1);
  P.shieldKill(r); P.shieldKill(r); P.shieldKill(r);
  assert.equal(r.shield.charges, 3);
  P.collect(r, {id: 'shieldplus', kind: 'shieldplus'});
  assert.deepEqual(r.shield, {owned: true, charges: 4, max: 4});
  r.shield.charges = 0;
  assert.equal(P.absorb(r), false);
});


test('match streak counts consecutive match kills and resets on a hit', () => {
  const r = P.newRun();
  assert.deepEqual(r.match, {streak: 0, best: 0, clean: 0});
  assert.equal(P.recordMatch(r), 1);
  assert.equal(P.recordMatch(r), 2);
  assert.equal(P.recordMatch(r), 3);
  P.breakStreak(r);
  assert.equal(P.recordMatch(r), 1);
  assert.deepEqual(r.match, {streak: 1, best: 3, clean: 4});
});
