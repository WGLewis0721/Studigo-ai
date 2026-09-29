// Moon Keep + Clock Tower room data (POC X). Coordinates are tiles (32 px). `ty` on actors is the surface row they stand on.
export const SCREEN_W = 30, SCREEN_H = 17, ROOM_COUNT = 17;

function room(id, name, zone, gx, gy, w, h) {
  const W = w * SCREEN_W, H = h * SCREEN_H;
  const grid = Array.from({length: H}, (_, y) =>
    Array.from({length: W}, (_, x) => (x === 0 || x === W - 1 || y === 0 || y >= H - 2 ? '#' : '.')));
  return {id, name, zone, gx, gy, w, h, grid, doors: [], entities: []};
}

function fill(r, x, y, w, h, ch = '#') {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) r.grid[j][i] = ch;
}

const plat = (r, x, y, len) => fill(r, x, y, len, 1, '=');

export function doorSpan(r, d) {
  const W = r.w * SCREEN_W, base = d.row * SCREEN_H;
  return {tx: d.side === 'W' ? 0 : W - 1, ty0: base + 11, ty1: base + 14, ledge: base + 15};
}

function door(r, side, row, to, extra = {}) {
  const d = {side, row, to, ...extra}, s = doorSpan(r, d);
  fill(r, s.tx, s.ty0, 1, 4, '.');
  if (row < r.h - 1) fill(r, side === 'W' ? 1 : s.tx - 6, s.ledge, 6, 1);
  r.doors.push(d);
}

const add = (r, ...entities) => r.entities.push(...entities);

const A = room('A', 'Moon Gate', 'atrium', 0, 3, 1, 1);
door(A, 'E', 0, 'B');
plat(A, 16, 12, 5);
add(A, {type: 'shrine', id: 'shrine-A', tx: 8, ty: 15, orbs: []});

const B = room('B', 'Great Atrium', 'atrium', 1, 3, 2, 1);
door(B, 'W', 0, 'A');
door(B, 'E', 0, 'C');
plat(B, 10, 12, 6);
plat(B, 30, 12, 6);
fill(B, 36, 7, 23, 1);
fill(B, 50, 1, 9, 2);
add(B,
  {type: 'skeleton', tx: 18, ty: 15, a: 1, b: 2, range: 3},
  {type: 'skeleton', tx: 26, ty: 15, a: 1, b: 3, range: 3},
  {type: 'skeleton', tx: 46, ty: 15, a: 2, b: 2, range: 4},
  {type: 'item', id: 'tank1', kind: 'tank', tx: 40, ty: 7, needs: ['boots']},
  {type: 'seal', id: 'seal-b', tx: 50, ty: 3, a: 4, b: 4},
  {type: 'item', id: 'tank3', kind: 'tank', tx: 55, ty: 7, needs: ['boots'], via: 'seal-b'});

const C = room('C', 'Central Shaft', 'shaft', 3, 1, 1, 4);
door(C, 'W', 2, 'B');
door(C, 'E', 3, 'D');
door(C, 'E', 0, 'H', {via: 'seal-h', needs: ['boots']});
door(C, 'W', 0, 'M', {via: 'seal-5', needs: ['boots']});
door(C, 'W', 1, 'K', {via: 'block-9', needs: ['boots']});
for (const [x, y] of [[10, 63], [17, 60], [10, 57], [17, 54], [7, 51]]) plat(C, x, y, 6);
for (const [x, y] of [[9, 44], [16, 39], [7, 34], [14, 29], [8, 24], [18, 24], [7, 19], [16, 19]]) plat(C, x, y, 6);
add(C,
  {type: 'skeleton', tx: 21, ty: 66, a: 1, b: 4, range: 3},
  {type: 'orb', id: 'orb-C2', family: 2, tx: 3, ty: 49},
  {type: 'orb', id: 'orb-C3', family: 3, tx: 5, ty: 32},
  {type: 'seal', id: 'seal-h', tx: 28, ty: 11, a: 2, b: 2},
  {type: 'seal', id: 'seal-5', tx: 1, ty: 11, a: 4, b: 5, teaser: 'CLOCK TOWER · 4 · 5'},
  {type: 'block', id: 'block-9', tx: 1, ty: 28, tw: 2, th: 4, product: 9});

const D = room('D', 'Crypt Hall', 'crypt', 4, 4, 2, 1);
door(D, 'W', 0, 'C');
door(D, 'E', 0, 'E');
plat(D, 7, 12, 6);
plat(D, 14, 12, 6);
plat(D, 20, 9, 5);
plat(D, 32, 12, 6);
add(D,
  {type: 'skeleton', tx: 12, ty: 15, a: 1, b: 2, range: 3},
  {type: 'skeleton', tx: 26, ty: 15, a: 2, b: 1, range: 3},
  {type: 'skeleton', tx: 38, ty: 15, a: 1, b: 4, range: 4},
  {type: 'skeleton', tx: 50, ty: 15, a: 2, b: 2, range: 3},
  {type: 'block', id: 'block-6', tx: 21, ty: 7, tw: 3, th: 2, product: 6},
  {type: 'item', id: 'x3exp', kind: 'expansion', family: 3, tx: 22, ty: 9, via: 'block-6'});

const E = room('E', 'Crypt Shrine', 'crypt', 6, 4, 1, 1);
door(E, 'W', 0, 'D');
door(E, 'E', 0, 'F');
add(E, {type: 'shrine', id: 'shrine-E', tx: 14, ty: 15, orbs: [2]});

const F = room('F', 'Twin Warden', 'crypt', 7, 4, 1, 1);
door(F, 'W', 0, 'E');
door(F, 'E', 0, 'G', {via: 'seal-g'});
plat(F, 5, 11, 5);
plat(F, 20, 11, 5);
add(F,
  {type: 'boss', id: 'twin', kind: 'twin', name: 'TWIN WARDEN',
    plates: [{a: 1, b: 3, owner: 0}, {a: 1, b: 2, owner: 1}, {a: 1, b: 4, owner: 0}, {a: 1, b: 3, owner: 1}],
    rewards: [{id: 'w2', kind: 'weapon', family: 2}]},
  {type: 'seal', id: 'seal-g', tx: 28, ty: 11, a: 1, b: 2});

const G = room('G', 'Boots Chamber', 'crypt', 8, 4, 1, 1);
door(G, 'W', 0, 'F');
fill(G, 13, 14, 5, 1);
add(G, {type: 'item', id: 'boots', kind: 'boots', tx: 15, ty: 14});

const H = room('H', 'Star Walk', 'stars', 4, 1, 2, 1);
door(H, 'W', 0, 'C');
door(H, 'E', 0, 'I');
plat(H, 10, 12, 5);
plat(H, 30, 12, 6);
plat(H, 36, 9, 5);
add(H,
  {type: 'skeleton', tx: 16, ty: 15, a: 2, b: 3, range: 3},
  {type: 'skeleton', tx: 26, ty: 15, a: 3, b: 1, range: 3},
  {type: 'skeleton', tx: 44, ty: 15, a: 2, b: 2, range: 3},
  {type: 'skeleton', tx: 52, ty: 15, a: 3, b: 2, range: 3},
  {type: 'block', id: 'block-4', tx: 37, ty: 7, tw: 3, th: 2, product: 4},
  {type: 'item', id: 'x2exp', kind: 'expansion', family: 2, tx: 38, ty: 9, via: 'block-4'});

const I = room('I', 'Star Shrine', 'stars', 6, 1, 1, 1);
door(I, 'W', 0, 'H');
door(I, 'E', 0, 'J');
add(I, {type: 'shrine', id: 'shrine-I', tx: 14, ty: 15, orbs: [2, 3]});

const J = room('J', 'Trine Guardian', 'stars', 7, 1, 1, 1);
door(J, 'W', 0, 'I');
door(J, 'E', 0, 'L');
plat(J, 4, 11, 5);
plat(J, 21, 11, 5);
add(J, {type: 'boss', id: 'trine', kind: 'trine', name: 'TRINE GUARDIAN',
  plates: [{a: 2, b: 3}, {a: 1, b: 4}, {a: 2, b: 2}, {a: 1, b: 3}, {a: 2, b: 4}],
  rewards: [{id: 'w3', kind: 'weapon', family: 3}]});

const K = room('K', 'Hidden Vault', 'vault', 2, 2, 1, 1);
door(K, 'E', 0, 'C');
fill(K, 8, 14, 5, 1);
add(K,
  {type: 'orb', id: 'orb-4', family: 4, unlock: true, tx: 10, ty: 14},
  {type: 'item', id: 'tank2', kind: 'tank', tx: 20, ty: 15});

const L = room('L', 'Moon Vault', 'vault', 8, 1, 1, 1);
door(L, 'W', 0, 'J');
add(L, {type: 'finale', tx: 18, ty: 15});

// ---------- Clock Tower (x5 zone), row 0 ----------
const M = room('M', 'Clock Gate', 'clock', 2, 0, 1, 2);
door(M, 'E', 1, 'C');
door(M, 'E', 0, 'N');
for (const [x, y] of [[16, 28], [7, 24], [15, 20]]) plat(M, x, y, 6);
add(M,
  {type: 'skeleton', tx: 9, ty: 32, a: 5, b: 1, range: 3},
  {type: 'bat', tx: 12, ty: 22, a: 1, b: 5, range: 4});

const N = room('N', 'Gear Gallery', 'clock', 3, 0, 3, 1);
door(N, 'W', 0, 'M');
door(N, 'E', 0, 'O');
plat(N, 12, 12, 6);
plat(N, 38, 12, 6);
plat(N, 44, 9, 5);
plat(N, 64, 12, 6);
add(N,
  {type: 'skeleton', tx: 20, ty: 15, a: 2, b: 5, range: 3},
  {type: 'bat', tx: 32, ty: 8, a: 5, b: 3, range: 4},
  {type: 'skeleton', tx: 52, ty: 15, a: 5, b: 4, range: 3},
  {type: 'bat', tx: 62, ty: 7, a: 1, b: 5, range: 4},
  {type: 'skeleton', tx: 78, ty: 15, a: 3, b: 5, range: 3},
  {type: 'block', id: 'block-15', tx: 45, ty: 7, tw: 3, th: 2, product: 15},
  {type: 'item', id: 'tank4', kind: 'tank', tx: 46, ty: 9, via: 'block-15'});

const O = room('O', 'Bell Shrine', 'clock', 6, 0, 1, 1);
door(O, 'W', 0, 'N');
door(O, 'E', 0, 'P');
add(O, {type: 'shrine', id: 'shrine-O', tx: 14, ty: 15, orbs: [2, 3, 4, 5]});

const P = room('P', 'Clockwork Warden', 'clock', 7, 0, 1, 1);
door(P, 'W', 0, 'O');
door(P, 'E', 0, 'Q', {via: 'seal-q'});
plat(P, 4, 11, 5);
plat(P, 21, 11, 5);
add(P,
  {type: 'boss', id: 'clock', kind: 'clock', name: 'CLOCKWORK WARDEN',
    plates: [{a: 2, b: 5}, {a: 1, b: 5}, {a: 4, b: 5}, {a: 3, b: 5}, {a: 2, b: 5}, {a: 4, b: 5}],
    rewards: [{id: 'w5', kind: 'weapon', family: 5}, {id: 'shield', kind: 'shield'}]},
  {type: 'seal', id: 'seal-q', tx: 28, ty: 11, a: 5, b: 5});

// Trial mini-boss: skeleton rules, one health pool (25% of the Clockwork Warden), problem reshuffles.
const Q = room('Q', 'Pendulum Trial', 'clock', 8, 0, 1, 1);
door(Q, 'W', 0, 'P');
add(Q, {type: 'boss', id: 'trial', kind: 'trial', name: 'PENDULUM TRIAL', hp: 20,
  rewards: [{id: 'shieldplus', kind: 'shieldplus'}]});

export const ROOMS = Object.fromEntries([A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q].map(r => {
  const {grid, ...rest} = r;
  return [r.id, {...rest, rows: grid.map(row => row.join(''))}];
}));

export const START = {room: 'A', x: 272};
export const COLLECTIBLES = ['tank1', 'tank2', 'tank3', 'tank4', 'x2exp', 'x3exp', 'boots', 'orb-4', 'shieldplus'];
