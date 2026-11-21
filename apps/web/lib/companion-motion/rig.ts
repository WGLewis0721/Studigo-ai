import type { MotionFrame } from "./director";

/* Studigo's 2.5D rig, as geometry.

   The approved front-facing artwork (mascot/companion/center.webp, 400 x 400)
   is laid over a grid. Each grid point knows which parts of him it belongs to
   and how far toward the viewer it sits. Turning his head moves near points
   (snout, eyes) further than far points (frills, the back of the skull) and
   foreshortens the far side, which is what makes the turn read as a solid head
   and not a sliding picture. Frills, tail and flame swing on their own pivots.

   Pure numbers: positions in, positions out. The renderer only draws them. */

export const RIG_SIZE = 400;
export const RIG_GRID = 30;

/** Landmarks measured on center.webp, in its own pixels. */
export const RIG = {
  head: { x: 205, y: 165, rx: 92, ry: 84 },
  snout: { x: 205, y: 192, rx: 46, ry: 27 },
  neck: { x: 205, y: 242 },
  eyeL: { x: 156, y: 156 }, eyeR: { x: 250, y: 156 }, eyeR2: { x: 22, y: 25 },
  mouth: { x: 205, y: 208, rx: 46, ry: 15 },
  cheekL: { x: 136, y: 190 }, cheekR: { x: 274, y: 190 },
  frillL: { x: 140, y: 160 }, frillR: { x: 274, y: 160 },
  tailBase: { x: 108, y: 345 }, flameBase: { x: 52, y: 292 }, flame: { x: 48, y: 258, r: 40 }
} as const;

/** How far he can turn before the single drawing stops holding up, in radians. */
export const MAX_YAW = 0.6, MAX_PITCH = 0.38, MAX_TILT = 0.2;
/** How far squash widens him, breath lifts him and a lean brings his head nearer. Outfits stretch with the same factors. */
export const STRETCH = { squashWide: 0.7, breathTall: 0.55, lean: 0.035 } as const;
const HEAD_DEPTH = 80;

export type RigMesh = {
  count: number;
  /** x, y pairs at rest, and the matching texture coordinates. */
  rest: Float32Array; uv: Float32Array; indices: Uint16Array;
  /** Per point: how much it belongs to each part, 0..1, and its depth toward the viewer. */
  head: Float32Array; depth: Float32Array; frillL: Float32Array; frillR: Float32Array; tail: Float32Array; flame: Float32Array; body: Float32Array;
};

const step = (lo: number, hi: number, v: number) => { const p = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return p * p * (3 - 2 * p); };

/** Depth of a point on his head: a dome, a snout that sticks out, frills that sit behind. -0.35..1.45. */
export function headDepth(x: number, y: number): number {
  const dx = (x - RIG.head.x) / RIG.head.rx, dy = (y - RIG.head.y) / RIG.head.ry, d = dx * dx + dy * dy;
  const dome = d < 1 ? Math.sqrt(1 - d) : -0.35 * Math.min(1, (d - 1) * 1.6);
  const sx = (x - RIG.snout.x) / RIG.snout.rx, sy = (y - RIG.snout.y) / RIG.snout.ry;
  return dome + 0.45 * Math.exp(-(sx * sx + sy * sy) * 1.4);
}

export function buildRig(grid: number = RIG_GRID): RigMesh {
  const side = grid + 1, count = side * side;
  const mesh: RigMesh = {
    count, rest: new Float32Array(count * 2), uv: new Float32Array(count * 2), indices: new Uint16Array(grid * grid * 6),
    head: new Float32Array(count), depth: new Float32Array(count), frillL: new Float32Array(count), frillR: new Float32Array(count),
    tail: new Float32Array(count), flame: new Float32Array(count), body: new Float32Array(count)
  };
  for (let j = 0; j < side; j += 1) for (let i = 0; i < side; i += 1) {
    const n = j * side + i, x = (i / grid) * RIG_SIZE, y = (j / grid) * RIG_SIZE;
    mesh.rest[n * 2] = x; mesh.rest[n * 2 + 1] = y;
    mesh.uv[n * 2] = i / grid; mesh.uv[n * 2 + 1] = j / grid;
    // The tail and its flame sit to the left of the neck, at head height. They are not head.
    const tailSide = step(212, 228, y) * (1 - step(96, 122, x));
    const head = (1 - step(214, 262, y)) * (1 - tailSide);
    mesh.head[n] = head;
    mesh.depth[n] = headDepth(x, y);
    const upper = 1 - step(204, 226, y);
    mesh.frillL[n] = (1 - step(116, 142, x)) * upper;
    mesh.frillR[n] = step(272, 298, x) * upper;
    const tail = step(208, 226, y) * (1 - step(92, 120, x)) * (1 - step(372, 398, y));
    mesh.tail[n] = tail * Math.min(1, Math.hypot(x - RIG.tailBase.x, y - RIG.tailBase.y) / 110);
    const fx = x - RIG.flame.x, fy = y - RIG.flame.y;
    mesh.flame[n] = Math.exp(-(fx * fx + fy * fy) / (RIG.flame.r * RIG.flame.r)) * step(200, 216, y);
    mesh.body[n] = step(226, 268, y) * (1 - tail);
  }
  let k = 0;
  for (let j = 0; j < grid; j += 1) for (let i = 0; i < grid; i += 1) {
    const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
    mesh.indices[k++] = a; mesh.indices[k++] = b; mesh.indices[k++] = c;
    mesh.indices[k++] = b; mesh.indices[k++] = d; mesh.indices[k++] = c;
  }
  return mesh;
}

/** Where one rest point ends up for a frame. */
export function posePoint(x: number, y: number, w: { head: number; depth: number; frillL: number; frillR: number; tail: number; flame: number; body: number }, f: MotionFrame, out: { x: number; y: number }) {
  let px = x, py = y;

  /* frills swing on their own pivots, before the head carries them */
  if (w.frillL > 0) {
    const a = f.frillL * 0.26 * w.frillL, c = Math.cos(a), s = Math.sin(a), rx = px - RIG.frillL.x, ry = py - RIG.frillL.y;
    px = RIG.frillL.x + rx * c - ry * s; py = RIG.frillL.y + rx * s + ry * c;
  }
  if (w.frillR > 0) {
    const a = -f.frillR * 0.26 * w.frillR, c = Math.cos(a), s = Math.sin(a), rx = px - RIG.frillR.x, ry = py - RIG.frillR.y;
    px = RIG.frillR.x + rx * c - ry * s; py = RIG.frillR.y + rx * s + ry * c;
  }

  /* the head: a turn in depth, then a roll about the neck */
  if (w.head > 0) {
    const yaw = Math.max(-1, Math.min(1, f.headYaw)) * MAX_YAW, pitch = Math.max(-1, Math.min(1, f.headPitch)) * MAX_PITCH;
    const near = 1 + f.lean * STRETCH.lean;
    let hx = (px - RIG.head.x) * near, hy = (py - RIG.head.y) * near;
    // Near points travel with the turn; the whole face foreshortens around its center.
    hx = hx * Math.cos(yaw) + Math.sin(yaw) * w.depth * HEAD_DEPTH;
    hy = hy * Math.cos(pitch) + Math.sin(pitch) * w.depth * HEAD_DEPTH * 0.85;
    let tx = RIG.head.x + hx, ty = RIG.head.y + hy + f.lean * 4 - f.lift * 5;
    const roll = f.headTilt * MAX_TILT, c = Math.cos(roll), s = Math.sin(roll), rx = tx - RIG.neck.x, ry = ty - RIG.neck.y;
    tx = RIG.neck.x + rx * c - ry * s; ty = RIG.neck.y + rx * s + ry * c;
    px += (tx - px) * w.head; py += (ty - py) * w.head;
  }

  /* the tail swings from its base and its tip swings further; the flame stretches */
  if (w.tail > 0) {
    const a = (f.tail * 0.16 + f.tailTip * 0.14 * w.tail) * w.tail, c = Math.cos(a), s = Math.sin(a), rx = px - RIG.tailBase.x, ry = py - RIG.tailBase.y;
    px = RIG.tailBase.x + rx * c - ry * s; py = RIG.tailBase.y + rx * s + ry * c;
  }
  if (w.flame > 0) {
    const grow = (f.flame - 1) * w.flame;
    px += (px - RIG.flameBase.x) * grow * 0.7 - f.tailTip * 5 * w.flame; py += (py - RIG.flameBase.y) * grow;
  }

  /* the body follows the head a little, breathes, and puffs up when proud */
  if (w.body > 0) {
    const rise = 1 - (py - 240) / 160;
    px += (f.bodyYaw * 9 * rise + (px - RIG.head.x) * (f.breath * 0.7 + f.lift * 0.02)) * w.body;
  }
  py -= (RIG_SIZE - py) * f.breath * STRETCH.breathTall;

  /* whole-body moves: squash from his feet, a spin, a hop, a dash */
  const feet = RIG_SIZE, cx = RIG.head.x;
  px = cx + (px - cx) * (1 + f.squash * STRETCH.squashWide) * Math.cos(f.spin);
  py = feet + (py - feet) * (1 - f.squash);
  px += (f.dash + f.shiver) * RIG_SIZE;
  py += f.hop * RIG_SIZE;
  out.x = px; out.y = py;
}

const weights = { head: 0, depth: 0, frillL: 0, frillR: 0, tail: 0, flame: 0, body: 0 };
const point = { x: 0, y: 0 };

/** Writes every grid point's position for this frame into `out` (x, y pairs). */
export function poseMesh(mesh: RigMesh, frame: MotionFrame, out: Float32Array): Float32Array {
  for (let n = 0; n < mesh.count; n += 1) {
    weights.head = mesh.head[n]; weights.depth = mesh.depth[n]; weights.frillL = mesh.frillL[n]; weights.frillR = mesh.frillR[n];
    weights.tail = mesh.tail[n]; weights.flame = mesh.flame[n]; weights.body = mesh.body[n];
    posePoint(mesh.rest[n * 2], mesh.rest[n * 2 + 1], weights, frame, point);
    out[n * 2] = point.x; out[n * 2 + 1] = point.y;
  }
  return out;
}
