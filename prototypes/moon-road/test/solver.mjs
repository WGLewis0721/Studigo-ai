import {ROOMS} from '../dist/poc-ix/world.js';
import {canDamage} from '../dist/poc-ix/rules.js';

// Item-order reachability for the world graph. `without` removes rewards to prove gates.
export function solve({without = []} = {}) {
  const owned = new Set([1]), have = new Set(), rooms = new Set(['A']), bosses = new Set();
  const gain = item => {
    if (without.includes(item.id) || have.has(item.id)) return false;
    have.add(item.id);
    if (item.kind === 'weapon' || item.unlock) owned.add(item.family);
    return true;
  };
  const open = (r, id) => {
    const e = r.entities.find(e => e.id === id);
    if (!e) throw new Error(`${r.id}: missing barrier ${id}`);
    const t = e.type === 'block' ? {kind: 'block', product: e.product} : {kind: 'seal', a: e.a, b: e.b};
    return [...owned].some(w => canDamage(t, w));
  };
  const met = needs => (needs || []).every(n => have.has(n));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...rooms]) {
      const r = ROOMS[id];
      const boss = r.entities.find(e => e.type === 'boss');
      if (boss && !bosses.has(boss.id) && boss.plates.every(p => [...owned].some(w => canDamage({kind: 'plate', ...p}, w)))) {
        bosses.add(boss.id);
        gain(boss.reward);
        changed = true;
      }
      if (boss && !bosses.has(boss.id)) continue;
      for (const e of r.entities) {
        if ((e.type === 'item' || e.type === 'orb') && met(e.needs) && (!e.via || open(r, e.via))) changed = gain(e) || changed;
      }
      for (const d of r.doors) {
        if (d.to && !rooms.has(d.to) && met(d.needs) && (!d.via || open(r, d.via))) { rooms.add(d.to); changed = true; }
      }
    }
  }
  return {owned, have, rooms, bosses};
}
