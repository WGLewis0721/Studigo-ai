// Stage C: expressions and reactions for Studigo. Run from the repository root after the idle and touch scripts:
//   node scripts/living-companion/build-studigo-expressions.mjs
// Replaces the intent animations (listening, thinking, happy, celebrating, encouraging, correct,
// incorrect, curious, wake, surprised, proud, annoyed, excited) with face-and-body performances.
// Values are absolute: bones that carry a position use their bind position as the rest value.
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
const def = (name, id, D, build, extra = "") => REPLACE.push({ name, id, D, build, extra });

// LISTENING: attentive, a little forward, head tilted, eyes wide and steady on the learner
def("Listening", "0:95", 30, (add) => {
  const p = (t) => hold(t, 0, 20);
  head(add, { rot: (t) => 0.07 * p(t), y: (t) => 2.5 * p(t), snout: (t) => 0 });
  wide(add, p, 0.07); brows(add, (t) => -2.8 * p(t), (t) => -2.2 * p(t)); frills(add, p, 0.07);
  chest(add, () => 0, () => 0, (t) => 0.012 * p(t));
});
// THINKING: concentration, chin up, eyes up and aside, asymmetric brows, lids narrowed
def("Thinking", "0:96", 30, (add) => {
  const p = (t) => hold(t, 0, 22);
  head(add, { rot: (t) => -0.075 * p(t), y: (t) => -2.5 * p(t), x: (t) => 1.5 * p(t), snout: (t) => 2 * p(t) });
  gaze(add, (t) => 3.8 * p(t), (t) => -3.2 * p(t));
  brows(add, (t) => 1.5 * p(t), (t) => -3.6 * p(t)); browTilt(add, (t) => 0.08 * p(t), (t) => -0.1 * p(t));
  lids(add, p, 0.16);
});
// HAPPY: squint-smile, brows up, a bounce, tail wag
def("Happy", "0:98", 54, (add) => {
  const sq = (t) => bump(t, 2, 9, 40, 54);
  lids(add, sq, 0.42); brows(add, (t) => -3.2 * sq(t), (t) => -3.2 * sq(t));
  head(add, { y: (t) => -3.5 * bump(t, 2, 12, 16, 30) + 1.5 * ring(t, 26, 2.2, 1.4), rot: (t) => 0.05 * ring(t, 6, 2.2, 1.0) });
  chest(add, () => 0, () => 0, (t) => 0.035 * bump(t, 0, 10, 12, 28));
  tail(add, (t) => 0.2 * ring(t, 4, 2.7, 0.7), (t) => 0.3 * ring(t, 7, 2.7, 0.7), (t) => 0.4 * ring(t, 10, 2.7, 0.7), (t) => 0.2 * bump(t, 2, 12, 30, 54));
  frills(add, (t) => bump(t, 3, 12, 30, 54), 0.1);
});
// CELEBRATING: a real jump with anticipation, stretch and landing squash; arc eyes; arms up; frills and tail follow through
def("Celebrating", "0:99", 72, (add) => {
  hop(add, 2, 34, 28);
  lids(add, (t) => bump(t, 4, 9, 54, 68), 1);
  brows(add, (t) => -3.5 * bump(t, 4, 12, 54, 70), (t) => -3.5 * bump(t, 4, 12, 54, 70));
  head(add, { y: (t) => 3 * bump(t, 2, 8, 9, 12) - 3 * bump(t, 12, 22, 40, 56), rot: (t) => -0.04 * bump(t, 10, 24, 40, 60) });
  arms(add, (t) => bump(t, 6, 20, 40, 66), 0.36);
  frills(add, (t) => bump(t, 8, 20, 36, 60) - 0.5 * bump(t, 36, 42, 46, 60), 0.18);
  tail(add, (t) => 0.3 * ring(t, 8, 2.4, 0.6), (t) => 0.4 * ring(t, 11, 2.4, 0.6), (t) => 0.5 * ring(t, 14, 2.4, 0.6), (t) => 0.4 * bump(t, 6, 16, 40, 66));
}, arcs(9, 58));
// ENCOURAGING: warm smile, two slow nods, a soft brow lift, tail wags slowly
def("Encouraging", "0:111", 68, (add) => {
  const sm = (t) => bump(t, 2, 14, 52, 66);
  lids(add, sm, 0.26); brows(add, (t) => -2.6 * sm(t), (t) => -2.6 * sm(t)); browTilt(add, (t) => -0.05 * sm(t), (t) => 0.05 * sm(t));
  head(add, { rot: (t) => 0.05 * sm(t), y: (t) => 3.2 * Math.max(0, Math.sin(2 * Math.PI * 1.4 * (t - 6) / 60)) * bump(t, 6, 10, 46, 56) });
  arms(add, (t) => bump(t, 4, 18, 46, 64), 0.08);
  tail(add, (t) => 0.14 * ring(t, 6, 1.6, 0.5), (t) => 0.2 * ring(t, 10, 1.6, 0.5), (t) => 0.26 * ring(t, 14, 1.6, 0.5), (t) => 0.1 * bump(t, 4, 16, 40, 66));
});
// CORRECT: quick pride pop: eyes wide, brows up, chin up, small hop, flame flare
def("Correct", "0:112", 48, (add) => {
  wide(add, (t) => bump(t, 0, 5, 12, 24), 0.12);
  lids(add, (t) => bump(t, 12, 20, 34, 46), 0.34);
  brows(add, (t) => -4 * bump(t, 0, 6, 28, 44), (t) => -4 * bump(t, 0, 6, 28, 44));
  head(add, { y: (t) => -4.5 * bump(t, 0, 8, 14, 30), rot: (t) => -0.04 * bump(t, 2, 12, 24, 44) });
  chest(add, (t) => 0.04 * bump(t, 0, 8, 14, 30), () => 0, (t) => 0.03 * bump(t, 0, 7, 12, 26));
  hop(add, 0, 12, 18);
  tail(add, (t) => 0.16 * ring(t, 4, 3, 0.8), (t) => 0.24 * ring(t, 7, 3, 0.8), (t) => 0.32 * ring(t, 10, 3, 0.8), (t) => 0.45 * bump(t, 2, 8, 20, 46));
});
// INCORRECT: gentle reassurance, never a scold: soft brows, a kind nod, head tilt, a small smile
def("Incorrect · Reassure", "0:113", 72, (add) => {
  const so = (t) => bump(t, 3, 16, 52, 70);
  brows(add, (t) => -2.2 * so(t), (t) => -2.2 * so(t)); browTilt(add, (t) => -0.12 * so(t), (t) => 0.12 * so(t));
  lids(add, (t) => bump(t, 10, 20, 50, 68), 0.2);
  head(add, { rot: (t) => 0.06 * so(t), y: (t) => 2.8 * Math.max(0, Math.sin(2 * Math.PI * 1.1 * (t - 10) / 60)) * bump(t, 10, 14, 40, 52) });
  frills(add, so, -0.05); arms(add, so, 0.07);
  tail(add, (t) => 0.06 * so(t), (t) => 0.1 * so(t), (t) => 0.14 * so(t));
});
// CURIOUS: head tilt, one brow up, eyes lead to the side, snout leans in
def("Curious", "0:114", 60, (add) => {
  const c = (t) => bump(t, 2, 16, 44, 58);
  head(add, { rot: (t) => 0.11 * c(t), x: (t) => 3 * c(t), snout: (t) => 2.4 * c(t), y: (t) => -1.5 * c(t) });
  gaze(add, (t) => 3.6 * bump(t, 0, 6, 46, 58), (t) => -1.5 * bump(t, 0, 6, 46, 58));
  brows(add, (t) => -4.6 * c(t), (t) => -0.5 * c(t)); browTilt(add, (t) => -0.1 * c(t), () => 0);
  frills(add, c, 0.09); wide(add, c, 0.06);
  chest(add, () => 0, () => 0, (t) => 0.012 * c(t));
});
// WAKE: pops awake: lids snap open, brows up, a shiver and a stretch of the frills
def("Wake", "0:116", 54, (add) => {
  lids(add, (t) => 1 - out(t, 0, 10), 1);
  wide(add, (t) => bump(t, 6, 12, 18, 34), 0.12);
  brows(add, (t) => -3.4 * bump(t, 6, 12, 22, 44), (t) => -3.4 * bump(t, 6, 12, 22, 44));
  head(add, { y: (t) => -4 * bump(t, 4, 12, 18, 40) + 2 * ring(t, 22, 3, 1.5), rot: (t) => 0.05 * ring(t, 8, 3.2, 1.0) });
  chest(add, (t) => 0.05 * bump(t, 4, 12, 16, 34), () => 0, (t) => 0.03 * bump(t, 4, 12, 16, 34));
  frills(add, (t) => bump(t, 6, 16, 26, 46) + 0.3 * ring(t, 28, 3, 1.4), 0.16);
  arms(add, (t) => ring(t, 6, 3.4, 1.1), 0.1);
  tail(add, (t) => 0.12 * ring(t, 8, 3, 1), (t) => 0.18 * ring(t, 11, 3, 1), (t) => 0.24 * ring(t, 14, 3, 1));
});
// SURPRISED: fast: eyes wide, brows high, head and body recoil, frills flare, flame flares, tail stiffens
def("Surprised", "0:118", 40, (add) => {
  const hit = (t) => out(t, 0, 4), settle = (t) => 1 - io(t, 8, 36);
  wide(add, (t) => hit(t) * settle(t), 0.2);
  brows(add, (t) => -6 * hit(t) * settle(t), (t) => -6 * hit(t) * settle(t));
  head(add, { y: (t) => -3.5 * hit(t) * settle(t) + 1.5 * ring(t, 14, 3, 2), rot: () => 0, x: (t) => 3.5 * hit(t) * settle(t) });
  chest(add, (t) => 0.06 * hit(t) * settle(t), () => 0, (t) => 0.035 * hit(t) * settle(t));
  frills(add, (t) => hit(t) * settle(t), 0.2);
  arms(add, (t) => hit(t) * settle(t), 0.14);
  add("0:11", 90, 0, (t) => 2.5 * hit(t) * settle(t));
  add("0:30", 90, R.legLX, (t) => -2.5 * hit(t) * settle(t)); add("0:32", 90, R.legRX, (t) => -2.5 * hit(t) * settle(t));
  tail(add, (t) => -0.12 * hit(t) * settle(t), (t) => -0.16 * hit(t) * settle(t), (t) => -0.2 * hit(t) * settle(t), (t) => 0.5 * hit(t) * settle(t));
});
// PROUD: chin up, chest out, content half-lids, shoulders back, flame bright
def("Proud", "0:401", 67, (add) => {
  const p = (t) => bump(t, 2, 20, 52, 66);
  head(add, { rot: (t) => -0.055 * p(t), y: (t) => -3.6 * p(t) });
  lids(add, (t) => bump(t, 8, 22, 50, 64), 0.3);
  brows(add, (t) => -2.4 * p(t), (t) => -2.4 * p(t));
  chest(add, (t) => 0.075 * p(t), (t) => 0.02 * p(t), (t) => 0.04 * p(t));
  arms(add, p, -0.1);
  frills(add, p, 0.12);
  tail(add, (t) => -0.1 * p(t) + 0.06 * ring(t, 22, 1.6, 1), (t) => -0.16 * p(t) + 0.1 * ring(t, 25, 1.6, 1), (t) => -0.22 * p(t) + 0.12 * ring(t, 28, 1.6, 1), (t) => 0.38 * p(t));
});
// PLAYFULLY ANNOYED: brows down, flat lids, eyes slide aside, a little huff with a tail flick
def("Playfully annoyed", "0:402", 42, (add) => {
  const a = (t) => bump(t, 1, 8, 28, 40);
  brows(add, (t) => 3.8 * a(t), (t) => 3.8 * a(t)); browTilt(add, (t) => 0.1 * a(t), (t) => -0.1 * a(t));
  lids(add, a, 0.34);
  gaze(add, (t) => 4.4 * bump(t, 2, 8, 30, 40), () => 0);
  head(add, { rot: (t) => -0.06 * a(t), y: (t) => 1.8 * a(t), x: (t) => -2 * a(t) });
  chest(add, (t) => 0.05 * bump(t, 2, 10, 14, 26), () => 0, (t) => 0.02 * bump(t, 2, 10, 14, 26));
  arms(add, (t) => bump(t, 2, 8, 14, 28), 0.08);
  tail(add, (t) => -0.28 * ring(t, 6, 2.4, 1.4), (t) => -0.36 * ring(t, 9, 2.4, 1.4), (t) => -0.44 * ring(t, 12, 2.4, 1.4), (t) => 0.2 * bump(t, 4, 10, 22, 40));
});
// EXCITED: wide eyes into arc eyes, two quick hops, arms up, frills and tail whipping
def("Excited", "0:403", 74, (add) => {
  hop(add, 0, 22, 16); hop(add, 34, 28, 20);
  wide(add, (t) => bump(t, 0, 5, 14, 20), 0.14);
  lids(add, (t) => bump(t, 18, 24, 60, 72), 1);
  brows(add, (t) => -4.6 * bump(t, 0, 7, 56, 72), (t) => -4.6 * bump(t, 0, 7, 56, 72));
  head(add, { y: (t) => -3 * bump(t, 6, 14, 52, 70), rot: (t) => 0.06 * ring(t, 10, 3.2, 0.8) });
  arms(add, (t) => bump(t, 4, 14, 56, 72), 0.34);
  frills(add, (t) => bump(t, 4, 14, 56, 72) + 0.25 * ring(t, 14, 4, 0.9), 0.2);
  tail(add, (t) => 0.36 * ring(t, 4, 3.4, 0.5), (t) => 0.48 * ring(t, 7, 3.4, 0.5), (t) => 0.6 * ring(t, 10, 3.4, 0.5), (t) => 0.5 * bump(t, 4, 12, 56, 72));
}, arcs(24, 60));

for (const { name, id, D, build, extra } of REPLACE) {
  const xml = animation(name, id, D, build, extra);
  const re = new RegExp('<LinearAnimation name="[^"]*"[^>]*id="' + id + '">[^]*?</LinearAnimation>');
  if (!re.test(s)) throw new Error("missing animation " + id);
  s = s.replace(re, () => xml);
}
writeFileSync(FILE, s);
console.log("ok " + REPLACE.length);
