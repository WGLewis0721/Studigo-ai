export const TILE = 32;

export function makeGrid(rows) {
  const h = rows.length, w = rows[0].length;
  return {
    w, h, rows,
    at(tx, ty) {
      if (ty < 0 || ty >= h) return '#';
      if (tx < 0 || tx >= w) return '.';
      return rows[ty][tx];
    },
  };
}

const overlaps = (a, r) => a.l < r.x + r.w && a.r > r.x && a.t < r.y + r.h && a.b > r.y;
const box = b => ({l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.y - b.h, b: b.y});

// Solid tile rects overlapping a box. One-way tiles count only when `oneWayTop` allows it.
function solids(a, grid, rects, oneWayFrom) {
  const out = [];
  for (let ty = Math.floor(a.t / TILE); ty <= Math.floor((a.b - 0.001) / TILE); ty++)
    for (let tx = Math.floor(a.l / TILE); tx <= Math.floor((a.r - 0.001) / TILE); tx++) {
      const c = grid.at(tx, ty);
      if (c === '#' || (c === '=' && oneWayFrom !== undefined && oneWayFrom <= ty * TILE + 0.001))
        out.push({x: tx * TILE, y: ty * TILE, w: TILE, h: TILE});
    }
  for (const r of rects) if (overlaps(a, r)) out.push(r);
  return out;
}

const STEP = 8;

export function moveBody(b, dx, dy, grid, rects = []) {
  const res = {ground: false, wall: false, ceiling: false};
  for (let n = Math.ceil(Math.abs(dx) / STEP), i = 0; i < n && !res.wall; i++) {
    const step = dx / n;
    b.x += step;
    for (const s of solids(box(b), grid, rects)) {
      b.x = step > 0 ? Math.min(b.x, s.x - b.w / 2) : Math.max(b.x, s.x + s.w + b.w / 2);
      res.wall = true;
    }
  }
  for (let n = Math.ceil(Math.abs(dy) / STEP), i = 0; i < n && !res.ground && !res.ceiling; i++) {
    const step = dy / n, prevFeet = b.y;
    b.y += step;
    for (const s of solids(box(b), grid, rects, step > 0 ? prevFeet : undefined)) {
      if (step > 0) { b.y = Math.min(b.y, s.y); res.ground = true; }
      else { b.y = Math.max(b.y, s.y + s.h + b.h); res.ceiling = true; }
    }
  }
  return res;
}
