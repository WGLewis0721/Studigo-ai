import {CAPACITY, EXPANSION} from './rules.js';

export const ORB_COOLDOWN = 20;

export function newRun() {
  return {
    owned: {1: true, 2: false, 3: false, 4: false},
    ammo: {2: 0, 3: 0, 4: 0},
    cap: {2: CAPACITY, 3: CAPACITY, 4: CAPACITY},
    maxHearts: 5, hearts: 5, boots: false,
    items: new Set(), visited: new Set(),
    shrine: {room: 'A', x: 272},
    active: 0, orbs: {},
  };
}

export function grantWeapon(r, n) {
  r.owned[n] = true;
  if (n > 1) r.ammo[n] = r.cap[n];
}

export function refill(r, n) {
  if (r.owned[n] && n > 1) r.ammo[n] = r.cap[n];
}

export function addAmmo(r, n, amount) {
  if (r.owned[n] && n > 1) r.ammo[n] = Math.min(r.cap[n], r.ammo[n] + amount);
}

export function spend(r, n) {
  if (n === 1) return true;
  if (!r.owned[n] || r.ammo[n] <= 0) return false;
  r.ammo[n]--;
  return true;
}

export function collect(r, item) {
  if (r.items.has(item.id)) return false;
  r.items.add(item.id);
  if (item.kind === 'tank') { r.maxHearts++; r.hearts = r.maxHearts; }
  else if (item.kind === 'expansion') { r.cap[item.family] += EXPANSION; addAmmo(r, item.family, EXPANSION); }
  else if (item.kind === 'boots') r.boots = true;
  else if (item.kind === 'weapon') grantWeapon(r, item.family);
  return true;
}

export function visit(r, id) { r.visited.add(id); }

export function mapPercent(r, total) { return Math.round(r.visited.size / total * 100); }

export function hurt(r) {
  r.hearts = Math.max(0, r.hearts - 1);
  return r.hearts === 0;
}

export function healFull(r) { r.hearts = r.maxHearts; }

function orb(r, id) { return r.orbs[id] ||= {readyAt: 0, attempt: 0}; }

export function orbReady(r, id) { return r.active >= orb(r, id).readyAt; }

export function orbAttempt(r, id) { return orb(r, id).attempt; }

export function submitOrb(r, id) {
  const o = orb(r, id), used = o.attempt;
  o.readyAt = r.active + ORB_COOLDOWN;
  o.attempt++;
  return used;
}
