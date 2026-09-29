export const CAPACITY = 12, EXPANSION = 4, WEAPONS = [1, 2, 3, 4, 5];

export function targetHp(t) {
  return t.kind === 'block' ? t.product : t.a * t.b;
}

export function canDamage(t, w) {
  switch (t.kind) {
    case 'skeleton':
    case 'bat':
    case 'trial': return w === 1 || w === t.a || w === t.b;
    case 'plate': return w === 1 ? t.a === 1 || t.b === 1 : w === t.a || w === t.b;
    case 'seal': return w > 1 && (w === t.a || w === t.b);
    case 'block': return w > 1 && t.product % w === 0;
    default: return false;
  }
}

// The trial glows while a 5 is showing: a x5 hit then counts double.
export function damageFor(t, w) {
  if (!canDamage(t, w)) return 0;
  return t.kind === 'trial' && w === 5 && (t.a === 5 || t.b === 5) ? w * 2 : w;
}

export function hitText(t, w, hpAfter) {
  if (t.kind !== 'block') return '−' + w;
  return hpAfter === 0 ? `${w} × ${t.product / w} = ${t.product}` : String(t.product - hpAfter);
}

export function reflectText(t, w) {
  if (t.kind === 'block') return `×${w} skips ${t.product}`;
  if (t.kind === 'seal' && w === 1) return "×1 can't open seals";
  return 'REFLECTED';
}

const SEQUENCE = [4, 7, 2, 9, 5, 10, 3, 8, 6, 1];

export function fact(family, attempt) {
  return SEQUENCE[(attempt + family * 3) % SEQUENCE.length];
}

export function choices(family, k, rand = Math.random) {
  const correct = family * k;
  const values = [correct, correct + family, k > 1 ? correct - family : correct + 2 * family];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
