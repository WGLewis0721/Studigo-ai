// Regenerates the three idle loops (Idle, Idle B, Idle C) and the physical eyelids in
// design/living-companion/rive/studigo/scene.rml. Run from the repository root:
//   node scripts/living-companion/build-studigo-idle.mjs
// It is idempotent: it replaces the idle animations by name and migrates the lids once.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

/* ---------- 1. Physical eyelids ---------- */
// A skin lid that slides down from the top of each eye socket. Always opaque.
const lidNode = (id, x, name) => `<Node x="${x}" y="-74" scaleY="0" name="${name}" id="${id}">
                            <Shape name="Lid skin">
                                <Ellipse y="18" width="38" height="36"/>
                                <Fill fillRule="clockwise">
                                    <LinearGradient startX="0" startY="0" endX="0" endY="36">
                                        <GradientStop position="0" colorValue="FFF8AA62"/>
                                        <GradientStop position="1" colorValue="FFEB8A52"/>
                                    </LinearGradient>
                                    <Feather strength="2" spaceValue="local"/>
                                </Fill>
                            </Shape>
                            <Shape y="34" name="Lid edge">
                                <PointsPath>
                                    <CubicDetachedVertex x="-14" y="-2" outRotation="0.44" outDistance="8"/>
                                    <CubicDetachedVertex x="14" y="-2" inRotation="2.70" inDistance="8"/>
                                </PointsPath>
                                <Stroke thickness="2" cap="round"><SolidColor colorValue="FF87421F"/></Stroke>
                            </Shape>
                        </Node>`;
for (const [id, x] of [["0:54", -44], ["0:55", 43]]) {
  const re = new RegExp('<Node x="' + x + '" y="-[0-9]+" [^>]*id="' + id + '">[^]*?</Node>');
  if (!re.test(s)) throw new Error("lid node " + id);
  s = s.replace(re, () => lidNode(id, x, x < 0 ? "Left closed eyelid" : "Right closed eyelid"));
}

/* ---------- 2. Motion library ---------- */
const clamp = (x) => Math.max(0, Math.min(1, x));
const io = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
const out = (t, a, b) => { const x = clamp((t - a) / (b - a)); return 1 - Math.pow(1 - x, 3); };
// 0 before a, rises to 1 by b, holds until c, back to 0 by d
const bump = (t, a, b, c, d, ease = io) => ease(t, a, b) * (1 - ease(t, c, d));

const REST = { torsoSy: 1, chestSx: 1, chestSy: 1, pelvisX: 0, headX: -2, headY: -85, snoutX: 0, snoutY: -26, legLX: -68, legRX: 66 };

function scene(D, p) {
  const ch = new Map();
  const add = (id, prop, rest, fn) => {
    const k = id + "|" + prop;
    if (!ch.has(k)) ch.set(k, { id, prop, rest, fns: [] });
    ch.get(k).fns.push(fn);
  };
  const P = D / p.breaths;
  const sinc = (t, cycles, phase = 0) => Math.sin(2 * Math.PI * (cycles * t / D + phase));
  const br = (t, lag = 0) => 0.5 - 0.5 * Math.cos(2 * Math.PI * ((t - lag) / P));
  add("0:12", 17, REST.torsoSy, (t) => 0.034 * (br(t) - br(0)));
  add("0:13", 16, REST.chestSx, (t) => 0.06 * (br(t, 6) - br(0, 6)));
  add("0:13", 17, REST.chestSy, (t) => 0.03 * (br(t, 6) - br(0, 6)));
  add("0:14", 15, 0, (t) => 0.075 * (br(t, 10) - br(0, 10)));
  add("0:16", 15, 0, (t) => -0.075 * (br(t, 10) - br(0, 10)));
  add("0:15", 15, 0, (t) => 0.11 * (br(t, 22) - br(0, 22)));
  add("0:17", 15, 0, (t) => -0.11 * (br(t, 22) - br(0, 22)));
  add("0:18", 91, REST.headY, (t) => -2.2 * (br(t, 14) - br(0, 14)));
  // Continuous micro-drift between the set beats (integer cycles from phase 0, so the loop closes): he never freezes.
  const dr = (t, k, ph = 0) => Math.sin(2 * Math.PI * (k * t / D + ph));
  add("0:18", 15, 0, (t) => p.drift * (0.03 * dr(t, 3) + 0.018 * dr(t, 5)));
  add("0:18", 90, REST.headX, (t) => p.drift * (2.6 * dr(t, 2) + 1.2 * dr(t, 5)));
  add("0:22", 90, 0, (t) => p.drift * (1.5 * dr(t, 4) + 0.8 * dr(t, 7)));
  add("0:24", 90, 0, (t) => p.drift * (1.5 * dr(t, 4) + 0.8 * dr(t, 7)));
  add("0:22", 91, 0, (t) => p.drift * 0.9 * dr(t, 3));
  add("0:24", 91, 0, (t) => p.drift * 0.9 * dr(t, 3));
  add("0:19", 90, REST.snoutX, (t) => p.drift * 1.2 * dr(t, 2));
  add("0:12", 15, 0, (t) => p.drift * 0.016 * dr(t, 2));
  add("0:25", 91, -80, (t) => p.drift * 1.0 * dr(t, 3));
  add("0:26", 91, -80, (t) => p.drift * 1.0 * dr(t, 4));
  add("0:27", 15, 0, (t) => p.drift * 0.045 * dr(t, 3, 0));
  add("0:28", 15, 0, (t) => p.drift * 0.045 * dr(t, 4, 0));
  add("0:14", 15, 0, (t) => p.drift * 0.03 * dr(t, 3));
  add("0:16", 15, 0, (t) => p.drift * -0.03 * dr(t, 4));
  add("0:15", 15, 0, (t) => p.drift * 0.05 * dr(t, 5));
  add("0:17", 15, 0, (t) => p.drift * -0.05 * dr(t, 4));
  add("0:34", 15, 0, (t) => p.tailSway * sinc(t, 2));
  add("0:35", 15, 0, (t) => p.tailSway * 1.5 * sinc(t, 2, -0.07));
  add("0:36", 15, 0, (t) => p.tailSway * 2.2 * sinc(t, 2, -0.14));
  const fc1 = Math.round(D / 41), fc2 = Math.round(D / 23);
  add("0:37", 17, 1, (t) => 0.09 * sinc(t, fc1) + 0.05 * sinc(t, fc2, 0.3));
  add("0:37", 15, 0, (t) => 0.08 * sinc(t, fc1, 0.2) + 0.04 * sinc(t, fc2, 0.7));

  for (const w of p.weight) {
    const W = (t) => bump(t, w.t, w.t + 40, w.t + w.hold, w.t + w.hold + 46);
    const dx = (t) => w.d * 8 * W(t), rot = (t) => w.d * 0.02 * W(t);
    add("0:11", 90, REST.pelvisX, dx);
    add("0:11", 15, 0, rot);
    add("0:30", 90, REST.legLX, (t) => -dx(t));
    add("0:32", 90, REST.legRX, (t) => -dx(t));
    add("0:30", 15, 0, (t) => -rot(t));
    add("0:32", 15, 0, (t) => -rot(t));
    add("0:12", 15, 0, (t) => -w.d * 0.034 * bump(t, w.t + 6, w.t + 48, w.t + w.hold + 4, w.t + w.hold + 52));
    add("0:18", 15, 0, (t) => w.d * 0.02 * bump(t, w.t + 14, w.t + 58, w.t + w.hold + 8, w.t + w.hold + 56));
    add("0:14", 15, 0, (t) => -w.d * 0.035 * W(t));
    add("0:16", 15, 0, (t) => -w.d * 0.035 * W(t));
    add("0:12", 90, 0, (t) => -w.d * 1.2 * W(t));
  }

  for (const g of p.glances) {
    const { t, d = 0, up = 0, hold = 70, amp = 1 } = g;
    const A = (u) => bump(u, t - 18, t - 7, t - 6, t + 5, io);
    const E = (u) => bump(u, t, t + 6, t + hold, t + hold + 12, out);
    const S = (u) => bump(u, t + 3, t + 22, t + hold + 4, t + hold + 30);
    const H = (u) => bump(u, t + 5, t + 28, t + hold + 8, t + hold + 40);
    const F = (u) => bump(u, t + 11, t + 36, t + hold + 12, t + hold + 46);
    const B = (u) => bump(u, t + 2, t + 12, t + hold + 2, t + hold + 22, out);
    add("0:22", 90, 0, (u) => d * 4.6 * amp * E(u) - d * 1.4 * A(u));
    add("0:24", 90, 0, (u) => d * 4.6 * amp * E(u) - d * 1.4 * A(u));
    add("0:22", 91, 0, (u) => -up * 3.4 * amp * E(u));
    add("0:24", 91, 0, (u) => -up * 3.4 * amp * E(u));
    add("0:19", 90, REST.snoutX, (u) => d * 6 * amp * S(u));
    add("0:19", 91, REST.snoutY, (u) => -up * 3.2 * amp * S(u));
    add("0:18", 90, REST.headX, (u) => d * 8 * amp * H(u) - d * 1.2 * A(u));
    add("0:18", 91, REST.headY, (u) => -up * 4.2 * amp * H(u) + 1.6 * A(u));
    add("0:18", 15, 0, (u) => d * 0.105 * amp * H(u) - d * 0.034 * A(u) + (g.tilt ?? 0) * H(u));
    add("0:27", 15, 0, (u) => d * 0.15 * amp * F(u));
    add("0:28", 15, 0, (u) => d * 0.15 * amp * F(u));
    add("0:29", 15, 0, (u) => d * 0.07 * amp * F(u));
    add("0:25", 91, -80, (u) => -3.2 * B(u) + 1.2 * A(u));
    add("0:26", 91, -80, (u) => -3.2 * B(u) + 1.2 * A(u));
    add("0:12", 15, 0, (u) => d * 0.016 * amp * bump(u, t + 14, t + 40, t + hold + 12, t + hold + 50));
  }

  const beat = p.beat;
  if (beat.kind === "flick") {
    const u = (t) => clamp((t - beat.t) / 52);
    const sw = (t, lag) => { const x = clamp(u(t) - lag); return Math.sin(2 * Math.PI * 1.3 * x) * Math.exp(-3.4 * x) * (1 - io(t, beat.t + 44, beat.t + 56)); };
    add("0:34", 15, 0, (t) => 0.3 * sw(t, 0));
    add("0:35", 15, 0, (t) => 0.42 * sw(t, 0.1));
    add("0:36", 15, 0, (t) => 0.55 * sw(t, 0.2));
    add("0:37", 17, 1, (t) => 0.42 * Math.max(0, sw(t, 0.28)) + 0.12 * Math.min(0, sw(t, 0.28)));
    add("0:37", 15, 0, (t) => 0.3 * sw(t, 0.3));
    add("0:12", 15, 0, (t) => -0.02 * bump(t, beat.t - 6, beat.t + 8, beat.t + 18, beat.t + 44));
    add("0:18", 15, 0, (t) => 0.05 * bump(t, beat.t, beat.t + 14, beat.t + 30, beat.t + 56));
    add("0:18", 90, REST.headX, (t) => -3 * bump(t, beat.t, beat.t + 14, beat.t + 30, beat.t + 56));
  } else if (beat.kind === "squint") {
    const b = beat.t;
    const L = (t) => bump(t, b, b + 14, b + 78, b + 104);
    add("0:21", 17, 1, (t) => -0.1 * L(t));
    add("0:23", 17, 1, (t) => -0.1 * L(t));
    add("0:54", 17, 0, (t) => 0.5 * L(t));
    add("0:55", 17, 0, (t) => 0.5 * L(t));
    add("0:25", 91, -80, (t) => 2.5 * L(t));
    add("0:26", 91, -80, (t) => 2.5 * L(t));
    add("0:18", 15, 0, (t) => -0.075 * bump(t, b + 2, b + 22, b + 74, b + 104));
    add("0:18", 91, REST.headY, (t) => 2.2 * bump(t, b + 2, b + 20, b + 76, b + 104));
    add("0:12", 17, 1, (t) => 0.03 * bump(t, b, b + 12, b + 14, b + 30) + 0.025 * Math.sin(Math.PI * clamp((t - b - 30) / 40) * 3) * bump(t, b + 30, b + 36, b + 66, b + 80));
    add("0:34", 15, 0, (t) => 0.16 * Math.sin(2 * Math.PI * 3 * clamp((t - b - 10) / 70)) * bump(t, b + 8, b + 24, b + 66, b + 80));
    add("0:35", 15, 0, (t) => 0.24 * Math.sin(2 * Math.PI * 3 * clamp((t - b - 16) / 70)) * bump(t, b + 8, b + 24, b + 66, b + 80));
  } else if (beat.kind === "fidget") {
    const b = beat.t;
    const Sh = (t) => bump(t, b, b + 16, b + 26, b + 48);
    add("0:14", 15, 0, (t) => -0.12 * Sh(t));
    add("0:16", 15, 0, (t) => 0.12 * Sh(t));
    add("0:12", 17, 1, (t) => 0.02 * Sh(t));
    add("0:18", 91, REST.headY, (t) => 3.2 * Sh(t));
    add("0:18", 15, 0, (t) => 0.06 * bump(t, b + 20, b + 40, b + 70, b + 98));
    add("0:25", 91, -80, (t) => -2.4 * bump(t, b + 20, b + 34, b + 70, b + 98));
    add("0:15", 15, 0, (t) => 0.22 * Math.sin(2 * Math.PI * 2.5 * clamp((t - b - 24) / 50)) * bump(t, b + 20, b + 30, b + 64, b + 76));
    add("0:14", 15, 0, (t) => 0.25 * bump(t, b + 20, b + 36, b + 68, b + 86));
  }

  // Blinks: the lid slides down in 3 ticks, holds 3, opens in 8 with ease-out. The eye squashes a little underneath.
  const openOut = (t, a, b) => out(t, a, b);
  for (const b of p.blinks) {
    for (const [lidId, eyeId, o] of [["0:54", "0:21", 0], ["0:55", "0:23", 1]]) {
      const t0 = b + o;
      add(lidId, 17, 0, (t) => io(t, t0, t0 + 3) * (1 - openOut(t, t0 + 6, t0 + 14)));
      add(eyeId, 17, 1, (t) => -0.14 * io(t, t0 + 1, t0 + 4) * (1 - openOut(t, t0 + 7, t0 + 16)));
    }
  }
  return ch;
}

/* ---------- 3. Emit keyframes ---------- */
function simplify(points, tol) {
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const v = points[a][1] + (points[b][1] - points[a][1]) * (points[i][0] - points[a][0]) / (points[b][0] - points[a][0]);
      const e = Math.abs(points[i][1] - v);
      if (e > worst) { worst = e; wi = i; }
    }
    if (worst > tol && wi > 0) { keep.add(wi); stack.push([a, wi], [wi, b]); }
  }
  return [...keep].sort((x, y) => x - y).map((i) => points[i]);
}
const fmt = (v) => String(+v.toFixed(4));
function emit(name, id, D, p) {
  const ch = scene(D, p);
  const byObj = new Map();
  for (const c of ch.values()) {
    const pts = [];
    for (let t = 0; t <= D; t++) {
      let v = c.rest;
      for (const f of c.fns) v += f(t);
      pts.push([t, v]);
    }
    pts[0][1] = c.rest; pts[D][1] = c.rest;
    const amp = Math.max(...pts.map((q) => Math.abs(q[1] - c.rest)));
    if (amp < 1e-4) continue;
    const keys = simplify(pts, Math.max(amp * 0.012, 1e-4));
    if (!byObj.has(c.id)) byObj.set(c.id, []);
    const list = keys.map(([t, v], i) => i === keys.length - 1
      ? `<KeyFrameDouble frame="${t}" value="${fmt(v)}"/>`
      : `<KeyFrameDouble frame="${t}" value="${fmt(v)}" interpolationType="linear"/>`);
    byObj.get(c.id).push(`<KeyedProperty propertyKey="${c.prop}">\n                    ${list.join("\n                    ")}\n                </KeyedProperty>`);
  }
  const objs = [...byObj.entries()].map(([oid, props]) => `<KeyedObject objectId="${oid}">\n                ${props.join("\n                ")}\n            </KeyedObject>`);
  return `<LinearAnimation name="${name}" fps="60" duration="${D}" loopValue="loop" id="${id}">\n            ${objs.join("\n            ")}\n        </LinearAnimation>`;
}

/* ---------- 4. The three loops ---------- */
const loops = {
  "Idle": { id: "0:58", D: 540, p: {
    drift: 1, breaths: 3, tailSway: 0.05, blinks: [58, 360],
    weight: [{ t: 150, d: -1, hold: 90 }, { t: 400, d: 1, hold: 40 }],
    glances: [{ t: 84, d: 1, hold: 64 }, { t: 232, d: -1, hold: 50, amp: 0.8 }, { t: 440, d: 0, up: 1, hold: 40, tilt: 0.06 }],
    beat: { kind: "flick", t: 300 } } },
  "Idle B": { id: "0:700", D: 600, p: {
    drift: 1, breaths: 3, tailSway: 0.045, blinks: [30, 262, 288],
    weight: [{ t: 90, d: 1, hold: 110 }, { t: 400, d: -1, hold: 70 }],
    glances: [{ t: 60, d: -1, hold: 50 }, { t: 196, d: 1, hold: 40, amp: 0.9 }, { t: 330, d: -1, up: 1, hold: 44, amp: 0.7, tilt: -0.05 }, { t: 470, d: 1, hold: 50 }],
    beat: { kind: "fidget", t: 120 } } },
  "Idle C": { id: "0:701", D: 480, p: {
    drift: 1, breaths: 3, tailSway: 0.055, blinks: [190, 330],
    weight: [{ t: 40, d: -1, hold: 80 }, { t: 280, d: 1, hold: 80 }],
    glances: [{ t: 24, d: 1, hold: 40 }, { t: 160, d: -1, hold: 20, amp: 0.7 }, { t: 400, d: -1, hold: 40, amp: 0.8 }],
    beat: { kind: "squint", t: 200 } } },
};
for (const [name, def] of Object.entries(loops)) {
  const block = emit(name, def.id, def.D, def.p);
  const re = new RegExp('<LinearAnimation name="' + name + '"[^>]*>[^]*?</LinearAnimation>');
  if (!re.test(s)) throw new Error("missing animation " + name);
  s = s.replace(re, () => block);
}
writeFileSync(FILE, s);
console.log("ok");
