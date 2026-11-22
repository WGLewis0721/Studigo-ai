// Personality gestures for Studigo (intents 21-25: tail chase, sit and wag, sniff, double take, stretch),
// plus reading (7) and sleepy (14). Run after build-studigo-expressions.mjs; build-studigo-all.mjs runs everything.
// The motion helpers below are the same as the expressions script's.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

const clamp = (x) => Math.max(0, Math.min(1, x));
const io = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
const out = (t, a, b) => { const x = clamp((t - a) / (b - a)); return 1 - Math.pow(1 - x, 3); };
const bump = (t, a, b, c, d, ease = io) => ease(t, a, b) * (1 - ease(t, c, d));
// rise to 1 by b and stay (no return): used for poses held to the end of the animation
const hold = (t, a, b, ease = io) => ease(t, a, b);
const ring = (t, t0, hz, k, phase = 0) => t < t0 ? 0 : Math.sin(2 * Math.PI * (hz * (t - t0) / 60) + phase) * Math.exp(-k * (t - t0) / 60);

const R = { headX: -2, headY: -85, snoutX: 0, snoutY: -26, rootX: 270, rootY: 520, legLX: -68, legRX: 66 };

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

function animation(name, id, D, build, extra = "") {
  const ch = new Map();
  const add = (oid, prop, rest, fn) => {
    const k = oid + "|" + prop;
    if (!ch.has(k)) ch.set(k, { oid, prop, rest, fns: [] });
    ch.get(k).fns.push(fn);
  };
  build(add);
  const byObj = new Map();
  for (const c of ch.values()) {
    const pts = [];
    for (let t = 0; t <= D; t++) {
      let v = c.rest;
      for (const f of c.fns) v += f(t);
      pts.push([t, v]);
    }
    pts[0][1] = D <= 1 ? pts[0][1] : pts[0][1];
    const amp = Math.max(...pts.map((q) => Math.abs(q[1] - c.rest)));
    if (amp < 1e-4) continue;
    const keys = D <= 1 ? [pts[0]] : simplify(pts, Math.max(amp * 0.012, 1e-4));
    if (!byObj.has(c.oid)) byObj.set(c.oid, []);
    const list = keys.map(([t, v], i) => i === keys.length - 1
      ? `<KeyFrameDouble frame="${t}" value="${fmt(v)}"/>`
      : `<KeyFrameDouble frame="${t}" value="${fmt(v)}" interpolationType="linear"/>`);
    byObj.get(c.oid).push(`<KeyedProperty propertyKey="${c.prop}">\n                    ${list.join("\n                    ")}\n                </KeyedProperty>`);
  }
  const objs = [...byObj.entries()].map(([oid, props]) => `<KeyedObject objectId="${oid}">\n                ${props.join("\n                ")}\n            </KeyedObject>`);
  return `<LinearAnimation name="${name}" fps="60" duration="${D}" id="${id}">\n            ${objs.join("\n            ")}${extra}\n        </LinearAnimation>`;
}
const step = (oid, on, off, base) => `\n            <KeyedObject objectId="${oid}">
                <KeyedProperty propertyKey="18">
                    <KeyFrameDouble frame="0" value="${base}" interpolationType="hold"/>
                    <KeyFrameDouble frame="${on}" value="${1 - base}" interpolationType="hold"/>
                    <KeyFrameDouble frame="${off}" value="${base}"/>
                </KeyedProperty>
            </KeyedObject>`;
// happy arcs (^ ^) swap in for the lid's lower edge between ticks `on` and `off`
const arcs = (on, off) => step("0:722", on, off, 0) + step("0:723", on, off, 0) + step("0:720", on, off, 1) + step("0:721", on, off, 1);

/* ---------- building blocks for faces and bodies ---------- */
const lids = (add, fn, amt = 1) => {
  add("0:54", 17, 0, (t) => amt * fn(t)); add("0:55", 17, 0, (t) => amt * fn(t));
  add("0:21", 17, 1, (t) => -0.1 * amt * fn(t)); add("0:23", 17, 1, (t) => -0.1 * amt * fn(t));
};
const wide = (add, fn, amt = 0.14) => {
  add("0:21", 17, 1, (t) => amt * fn(t)); add("0:23", 17, 1, (t) => amt * fn(t));
  add("0:21", 16, 1, (t) => amt * 0.5 * fn(t)); add("0:23", 16, 1, (t) => amt * 0.5 * fn(t));
};
const brows = (add, l, r) => { add("0:25", 91, -80, l); add("0:26", 91, -80, r); };
const browTilt = (add, l, r) => { add("0:25", 15, 0, l); add("0:26", 15, 0, r); };
const gaze = (add, x, y) => {
  add("0:22", 90, 0, x); add("0:24", 90, 0, x); add("0:22", 91, 0, y); add("0:24", 91, 0, y);
};
const head = (add, { rot = () => 0, x = () => 0, y = () => 0, snout = () => 0 }) => {
  add("0:18", 15, 0, rot); add("0:18", 90, R.headX, x); add("0:18", 91, R.headY, y); add("0:19", 90, R.snoutX, snout);
};
const frills = (add, fn, amt = 0.1) => { add("0:27", 15, 0, (t) => amt * fn(t)); add("0:28", 15, 0, (t) => -amt * fn(t)); };
const tail = (add, root, mid, tip, flame) => {
  add("0:34", 15, 0, root); add("0:35", 15, 0, mid); add("0:36", 15, 0, tip);
  if (flame) { add("0:37", 17, 1, flame); }
};
const arms = (add, fn, amt = 0.06) => { add("0:14", 15, 0, (t) => amt * fn(t)); add("0:16", 15, 0, (t) => -amt * fn(t)); };
const chest = (add, sx, sy, torso) => {
  add("0:13", 16, 1, sx); add("0:13", 17, 1, sy); if (torso) add("0:12", 17, 1, torso);
};
// hop from the floor with squash before takeoff, stretch in the air and squash on landing. Root origin is the floor.
const hop = (add, t0, height, flight = 28) => {
  const land = t0 + 8 + flight;
  const air = (t) => t < t0 + 8 || t > land ? 0 : Math.sin(Math.PI * (t - t0 - 8) / flight);
  const crouch = (t) => bump(t, t0, t0 + 7, t0 + 8, t0 + 9);
  const settle = (t) => t < land ? 0 : Math.exp(-5 * (t - land) / 60) * Math.sin(2 * Math.PI * 2.6 * (t - land) / 60 + 0.4) * 0.5;
  add("0:10", 91, R.rootY, (t) => -height * air(t));
  add("0:10", 17, 1, (t) => -0.1 * crouch(t) + 0.12 * air(t) - 0.1 * Math.max(0, settle(t) * 1) + 0.05 * Math.min(0, settle(t)));
  add("0:10", 16, 1, (t) => 0.07 * crouch(t) - 0.06 * air(t) + 0.07 * Math.max(0, settle(t)));
};


const REPLACE = [];
const def = (name, id, D, build, extra = "", loop = false) => REPLACE.push({ name, id, D, build, extra, loop });
const wave = (t, D, cycles, phase = 0) => Math.sin(2 * Math.PI * (cycles * t / D + phase));
// sit: the pelvis drops and the legs lift by the same amount, so the feet stay on the floor
const sit = (add, fn, depth = 12) => {
  add("0:11", 91, -85, (t) => depth * fn(t));
  add("0:30", 91, 5, (t) => -depth * fn(t)); add("0:32", 91, 5, (t) => -depth * fn(t));
  add("0:30", 15, 0, (t) => 0.06 * fn(t)); add("0:32", 15, 0, (t) => -0.06 * fn(t));
};
const shift = (add, fn, px = 8) => {
  add("0:11", 90, 0, (t) => px * fn(t)); add("0:30", 90, -68, (t) => -px * fn(t)); add("0:32", 90, 66, (t) => -px * fn(t));
};

// TAIL CHASE: notices his tail, looks back at it, it flicks away, he scuffles after it twice, then grins.
def("Tail chase", "0:451", 102, (add) => {
  const look = (t) => bump(t, 8, 18, 70, 88);
  const a = (t) => bump(t, 0, 7, 7, 12);
  head(add, { rot: (t) => 0.035 * a(t) - 0.11 * look(t), x: (t) => 3 * a(t) - 12 * look(t), y: (t) => 4 * look(t) });
  gaze(add, (t) => 2 * a(t) - 6 * look(t), (t) => 3.5 * look(t));
  add("0:12", 15, 0, (t) => -0.07 * look(t));
  shift(add, (t) => -1.2 * bump(t, 14, 24, 64, 84) + 0.7 * wave(t, 102, 4) * bump(t, 26, 34, 60, 70), 9);
  hop(add, 30, 9, 14); hop(add, 52, 9, 14);
  arms(add, (t) => bump(t, 24, 32, 64, 80), 0.2);
  tail(add, (t) => 0.42 * wave(t, 102, 5) * bump(t, 14, 22, 70, 90), (t) => 0.55 * wave(t, 102, 5, -0.08) * bump(t, 14, 24, 72, 92), (t) => 0.7 * wave(t, 102, 5, -0.16) * bump(t, 14, 26, 74, 94), (t) => 0.3 * bump(t, 14, 26, 70, 96));
  const grin = (t) => bump(t, 74, 84, 92, 102);
  lids(add, grin, 0.45); brows(add, (t) => -3.5 * look(t), (t) => -2.5 * look(t));
  frills(add, (t) => ring(t, 30, 3.2, 1.4) + ring(t, 52, 3.2, 1.4), 0.12);
}, arcs(76, 98));

// SIT AND WAG: plops down, tail wags fast with a bright flame, head tilts side to side, happy squint.
def("Sit and wag", "0:452", 116, (add) => {
  const down = (t) => bump(t, 2, 16, 92, 112);
  sit(add, down, 26);
  add("0:12", 17, 1, (t) => -0.03 * down(t));
  add("0:10", 17, 1, (t) => -0.05 * bump(t, 12, 16, 16, 24));
  const env = (t) => bump(t, 14, 22, 90, 108);
  tail(add, (t) => 0.32 * wave(t, 116, 9) * env(t), (t) => 0.42 * wave(t, 116, 9, -0.06) * env(t), (t) => 0.55 * wave(t, 116, 9, -0.12) * env(t), (t) => 0.35 * bump(t, 16, 28, 90, 112));
  add("0:11", 15, 0, (t) => 0.03 * wave(t, 116, 9) * env(t));
  const tilt = (t) => wave(t, 116, 2) * bump(t, 18, 30, 86, 104);
  head(add, { rot: (t) => 0.1 * tilt(t), x: (t) => 5 * tilt(t), y: (t) => 2 * down(t) });
  arms(add, (t) => bump(t, 8, 20, 90, 110), -0.08);
  lids(add, (t) => bump(t, 16, 26, 88, 104), 0.5);
  frills(add, (t) => wave(t, 116, 4) * bump(t, 18, 30, 86, 104), 0.07);
}, arcs(26, 90));

// SNIFF: leans in nose first, three quick sniffs with the snout, then pulls back with a curious brow.
def("Sniff", "0:453", 65, (add) => {
  const lean = (t) => bump(t, 4, 16, 40, 56);
  const sn = (t) => Math.max(0, wave(t, 65, 9)) * bump(t, 14, 18, 36, 40);
  const back = (t) => bump(t, 40, 48, 54, 64);
  head(add, { y: (t) => 10 * lean(t) - 2 * sn(t), x: (t) => 7 * lean(t), rot: (t) => 0.08 * lean(t) - 0.06 * back(t), snout: (t) => 2.5 * lean(t) });
  add("0:19", 91, -26, (t) => -2.2 * sn(t) + 1.5 * lean(t));
  add("0:12", 15, 0, (t) => 0.09 * lean(t));
  lids(add, (t) => 0.5 * bump(t, 14, 18, 36, 42), 1);
  gaze(add, (t) => 2 * lean(t), (t) => 4 * lean(t));
  brows(add, (t) => 2 * lean(t) - 4 * back(t), (t) => 2 * lean(t) - 1.5 * back(t));
  frills(add, (t) => -lean(t) + back(t), 0.08);
  tail(add, (t) => 0.12 * ring(t, 40, 2.2, 1.2), (t) => 0.16 * ring(t, 43, 2.2, 1.2), (t) => 0.2 * ring(t, 46, 2.2, 1.2));
});

// DOUBLE TAKE: casual glance right, back to centre, then a snap back with wide eyes, frills up and a jolt.
def("Double take", "0:454", 77, (add) => {
  const g1 = (t) => bump(t, 2, 10, 16, 24);
  const snap = (t) => bump(t, 30, 34, 58, 72, out);
  const jolt = (t) => bump(t, 31, 35, 56, 70);
  head(add, { x: (t) => 5 * g1(t) + 11 * snap(t), rot: (t) => 0.04 * g1(t) + 0.09 * snap(t) - 0.03 * ring(t, 34, 3, 2.5), y: (t) => -4 * bump(t, 30, 34, 38, 50) });
  gaze(add, (t) => 4 * g1(t) + 6 * snap(t), () => 0);
  wide(add, jolt, 0.18);
  brows(add, (t) => -5 * jolt(t), (t) => -5 * jolt(t));
  frills(add, (t) => bump(t, 31, 36, 52, 70) + 0.4 * ring(t, 36, 4, 1.5), 0.22);
  add("0:10", 91, 520, (t) => -5 * bump(t, 30, 33, 34, 42));
  add("0:12", 15, 0, (t) => 0.05 * snap(t));
  arms(add, (t) => bump(t, 31, 36, 52, 70), 0.16);
  tail(add, (t) => 0.3 * ring(t, 32, 3, 1.2), (t) => 0.4 * ring(t, 35, 3, 1.2), (t) => 0.5 * ring(t, 38, 3, 1.2), (t) => 0.3 * bump(t, 31, 36, 50, 70));
});

// STRETCH: arms out and up, rises tall on the toes, big yawn with eyes shut, then a shake-off.
def("Stretch", "0:455", 115, (add) => {
  const up = (t) => bump(t, 8, 34, 60, 80);
  const shake = (t) => wave(t, 115, 7) * bump(t, 84, 88, 98, 106);
  arms(add, up, 0.55);
  add("0:15", 15, 0, (t) => 0.3 * up(t)); add("0:17", 15, 0, (t) => -0.3 * up(t));
  add("0:12", 17, 1, (t) => 0.035 * up(t));
  add("0:10", 91, 520, (t) => -6 * up(t) + 3 * bump(t, 0, 6, 6, 10));
  head(add, { y: (t) => -3 * up(t), rot: (t) => -0.05 * up(t) + 0.08 * shake(t) });
  lids(add, (t) => bump(t, 20, 28, 66, 76), 1);
  brows(add, (t) => 3 * bump(t, 20, 28, 66, 76), (t) => 3 * bump(t, 20, 28, 66, 76));
  shift(add, shake, 4);
  frills(add, (t) => wave(t, 115, 9) * bump(t, 84, 88, 100, 110), 0.18);
  tail(add, (t) => 0.2 * up(t) + 0.25 * shake(t), (t) => 0.28 * up(t), (t) => 0.36 * up(t), (t) => 0.25 * up(t));
});

// READING (loop, 4 s): eyes sweep along a line, flick back at the line break, small page nods.
def("Reading", "0:97", 240, (add) => {
  const line = (t) => { const p = (t % 60) / 60; return p < 0.85 ? -1 + 2 * (p / 0.85) : 1 - 2 * ((p - 0.85) / 0.15); };
  gaze(add, (t) => 4.5 * line(t), () => 4);
  head(add, { y: () => 4, rot: (t) => 0.025 * line(t), x: (t) => 1.5 * line(t) });
  lids(add, () => 0.32, 1);
  brows(add, () => 1, () => 1);
  add("0:12", 15, 0, (t) => 0.012 * wave(t, 240, 2));
  tail(add, (t) => 0.06 * wave(t, 240, 2), (t) => 0.08 * wave(t, 240, 2, -0.05), (t) => 0.1 * wave(t, 240, 2, -0.1));
}, "", true);

// SLEEPY (loop, 6 s): slow heavy breaths, head droops and catches itself, eyes almost shut.
def("Sleepy", "0:115", 360, (add) => {
  const br = (t) => 0.5 - 0.5 * Math.cos(2 * Math.PI * 3 * t / 360);
  const droop = (t) => bump(t, 60, 150, 150, 170);
  const catchUp = (t) => bump(t, 150, 156, 160, 190);
  add("0:12", 17, 1, (t) => 0.03 * br(t));
  add("0:13", 16, 1, (t) => 0.035 * br(t));
  head(add, { y: (t) => 3 + 6 * droop(t) - 2 * catchUp(t), rot: (t) => 0.08 * droop(t) - 0.03 * catchUp(t) });
  lids(add, (t) => 0.62 + 0.38 * droop(t) - 0.3 * bump(t, 150, 154, 160, 200), 1);
  brows(add, (t) => 2 + 2 * droop(t), (t) => 2 + 2 * droop(t));
  arms(add, (t) => -br(t), 0.03);
  tail(add, (t) => 0.05 * wave(t, 360, 1), (t) => 0.07 * wave(t, 360, 1, -0.05), (t) => 0.09 * wave(t, 360, 1, -0.1), () => -0.15);
}, "", true);

for (const { name, id, D, build, extra, loop } of REPLACE) {
  let xml = animation(name, id, D, build, extra);
  if (loop) xml = xml.replace(`duration="${D}" id="${id}"`, `duration="${D}" loopValue="loop" id="${id}"`);
  const re = new RegExp('<LinearAnimation name="[^"]*"[^>]*id="' + id + '">[^]*?</LinearAnimation>');
  if (!re.test(s)) throw new Error("missing animation " + id);
  s = s.replace(re, () => xml);
}
writeFileSync(FILE, s);
console.log("ok " + REPLACE.length);
