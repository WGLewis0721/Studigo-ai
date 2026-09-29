import test from 'node:test';
import assert from 'node:assert/strict';
import {canDamage, targetHp, hitText, reflectText, fact, choices, CAPACITY, EXPANSION} from '../../dist/poc-x/rules.js';

const sk = (a, b) => ({kind: 'skeleton', a, b});
const seal = (a, b) => ({kind: 'seal', a, b});
const plate = (a, b) => ({kind: 'plate', a, b});
const block = product => ({kind: 'block', product});

test('constants', () => {
  assert.equal(CAPACITY, 12);
  assert.equal(EXPANSION, 4);
});

test('skeleton takes x1 and its operands only', () => {
  assert.equal(targetHp(sk(2, 3)), 6);
  for (const w of [1, 2, 3]) assert.ok(canDamage(sk(2, 3), w));
  assert.ok(!canDamage(sk(2, 3), 4));
});

test('x1 never opens seals', () => {
  assert.ok(!canDamage(seal(1, 2), 1));
  assert.ok(canDamage(seal(1, 2), 2));
  assert.ok(canDamage(seal(3, 4), 4));
  assert.ok(!canDamage(seal(3, 4), 2));
  assert.ok(!canDamage(seal(5, 5), 4));
});

test('plates accept x1 only when an operand is 1', () => {
  assert.ok(canDamage(plate(1, 3), 1));
  assert.ok(!canDamage(plate(2, 2), 1));
  assert.ok(canDamage(plate(2, 2), 2));
  assert.ok(!canDamage(plate(2, 3), 4));
});

test('blocks break with any power shot whose count lands on the product', () => {
  assert.equal(targetHp(block(6)), 6);
  assert.ok(canDamage(block(6), 2) && canDamage(block(6), 3));
  assert.ok(!canDamage(block(6), 1) && !canDamage(block(6), 4));
  assert.ok(canDamage(block(9), 3) && !canDamage(block(9), 2) && !canDamage(block(9), 4));
  assert.ok(canDamage(block(4), 2) && canDamage(block(4), 4));
});

test('block hits skip-count, then show the multiplication', () => {
  const b = block(6);
  assert.equal(hitText(b, 2, 4), '2');
  assert.equal(hitText(b, 2, 2), '4');
  assert.equal(hitText(b, 2, 0), '2 × 3 = 6');
  assert.equal(hitText(sk(2, 3), 3, 3), '−3');
});

test('reflect copy stays in multiplication language', () => {
  assert.equal(reflectText(block(6), 4), '×4 skips 6');
  assert.equal(reflectText(seal(1, 2), 1), "×1 can't open seals");
  assert.equal(reflectText(sk(2, 2), 3), 'REFLECTED');
  for (const s of [reflectText(block(9), 2), hitText(block(9), 3, 0)]) assert.ok(!/divid|factor|÷/i.test(s));
});

test('fact rotates through 1..10 and never repeats back to back', () => {
  for (const f of [2, 3, 4]) {
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      const k = fact(f, i);
      assert.ok(k >= 1 && k <= 10);
      assert.notEqual(k, fact(f, i + 1));
      seen.add(k);
    }
    assert.equal(seen.size, 10);
  }
});

test('choices: three distinct positives including the product', () => {
  for (const f of [2, 3, 4]) for (let k = 1; k <= 10; k++) {
    const c = choices(f, k, () => 0.5);
    assert.equal(c.length, 3);
    assert.equal(new Set(c).size, 3);
    assert.ok(c.includes(f * k));
    assert.ok(c.every(v => v > 0));
  }
});


import {damageFor} from '../../dist/poc-x/rules.js';

test('x5 exists and bats follow skeleton rules', () => {
  assert.ok(canDamage({kind: 'bat', a: 5, b: 3}, 1));
  assert.ok(canDamage({kind: 'bat', a: 5, b: 3}, 5));
  assert.ok(!canDamage({kind: 'bat', a: 5, b: 3}, 4));
  assert.ok(canDamage({kind: 'seal', a: 5, b: 5}, 5) && !canDamage({kind: 'seal', a: 5, b: 5}, 4));
  assert.ok(canDamage({kind: 'seal', a: 4, b: 5}, 4));
});

test('trial: skeleton weakness, reflections, double x5 while a 5 shows', () => {
  const t = (a, b) => ({kind: 'trial', a, b});
  assert.equal(damageFor(t(1, 2), 1), 1);
  assert.equal(damageFor(t(3, 2), 3), 3);
  assert.equal(damageFor(t(3, 2), 4), 0);
  assert.equal(damageFor(t(1, 6), 1), 1);
  assert.equal(damageFor(t(5, 2), 5), 10);
  assert.equal(damageFor(t(5, 2), 2), 2);
  assert.equal(damageFor(t(5, 2), 1), 1);
});
