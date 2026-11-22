// Stage B: touch reactions for Studigo. Run from the repository root:
//   node scripts/living-companion/build-studigo-touch.mjs
// Run build-studigo-idle.mjs first (it owns the lid nodes). Rebuilds the Petting animation and adds
// Belly poke (intent 26) and Tail tug (intent 27) with their states and transitions in scene.rml.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

/* ---------- motion helpers ---------- */
const clamp = (x) => Math.max(0, Math.min(1, x));
const io = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
const out = (t, a, b) => { const x = clamp((t - a) / (b - a)); return 1 - Math.pow(1 - x, 3); };
const bump = (t, a, b, c, d, ease = io) => ease(t, a, b) * (1 - ease(t, c, d));
// damped oscillation starting at t0: amplitude 1, `cycles` per second, decay rate k per second
const ring = (t, t0, hz, k, phase = 0) => t < t0 ? 0 : Math.sin(2 * Math.PI * (hz * (t - t0) / 60) + phase) * Math.exp(-k * (t - t0) / 60);
const REST = { headX: -2, headY: -85, snoutX: 0, snoutY: -26, legLX: -68, legRX: 66 };

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

function animation(name, id, D, build) {
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
    pts[0][1] = c.rest;
    const amp = Math.max(...pts.map((q) => Math.abs(q[1] - c.rest)));
    if (amp < 1e-4) continue;
    const hold = c.hold;
    const keys = simplify(pts, Math.max(amp * 0.012, 1e-4));
    if (!byObj.has(c.oid)) byObj.set(c.oid, []);
    const list = keys.map(([t, v], i) => i === keys.length - 1
      ? `<KeyFrameDouble frame="${t}" value="${fmt(v)}"/>`
      : `<KeyFrameDouble frame="${t}" value="${fmt(v)}" interpolationType="linear"/>`);
    byObj.get(c.oid).push(`<KeyedProperty propertyKey="${c.prop}">\n                    ${list.join("\n                    ")}\n                </KeyedProperty>`);
  }
  const objs = [...byObj.entries()].map(([oid, props]) => `<KeyedObject objectId="${oid}">\n                ${props.join("\n                ")}\n            </KeyedObject>`);
  return `<LinearAnimation name="${name}" fps="60" duration="${D}" id="${id}">\n            ${objs.join("\n            ")}\n        </LinearAnimation>`;
}
// A step (hold keys): value switches between 0 and 1 at the given ticks. Used for the happy arc, never faded.
const stepObj = (oid, D, on, off) => `<KeyedObject objectId="${oid}">
                <KeyedProperty propertyKey="18">
                    <KeyFrameDouble frame="0" value="0" interpolationType="hold"/>
                    <KeyFrameDouble frame="${on}" value="1" interpolationType="hold"/>
                    <KeyFrameDouble frame="${off}" value="0"/>
                </KeyedProperty>
            </KeyedObject>`;
const edgeObj = (oid, D, on, off) => `<KeyedObject objectId="${oid}">
                <KeyedProperty propertyKey="18">
                    <KeyFrameDouble frame="0" value="1" interpolationType="hold"/>
                    <KeyFrameDouble frame="${on}" value="0" interpolationType="hold"/>
                    <KeyFrameDouble frame="${off}" value="1"/>
                </KeyedProperty>
            </KeyedObject>`;
const withSteps = (xml, extra) => xml.replace(/<\/LinearAnimation>$/, `${extra}\n        </LinearAnimation>`);

/* ---------- head pat: happy-arc eyes, lean into the hand, nuzzle, wag ---------- */
function pat(add) {
  const D = 88;
  const close = (t) => io(t, 0, 4);                 // eyes close to arcs in ~65 ms
  const open = (t) => out(t, 78, 87);
  const eyes = (t) => close(t) * (1 - open(t));
  add("0:54", 17, 0, (t) => eyes(t));
  add("0:55", 17, 0, (t) => eyes(t));
  add("0:21", 17, 1, (t) => -0.1 * eyes(t));
  add("0:23", 17, 1, (t) => -0.1 * eyes(t));
  const lean = (t) => bump(t, 0, 12, 74, 88);       // lean into the hand
  add("0:18", 91, REST.headY, (t) => 5 * lean(t));
  add("0:18", 15, 0, (t) => 0.07 * lean(t) + 0.045 * ring(t, 8, 1.7, 0.4) * lean(t));
  add("0:18", 90, REST.headX, (t) => -2.5 * lean(t) + 2.2 * ring(t, 8, 1.7, 0.4, 0.8) * lean(t));
  add("0:19", 90, REST.snoutX, (t) => 1.6 * ring(t, 6, 1.7, 0.4, 0.8) * lean(t));
  add("0:25", 91, -80, (t) => -2.4 * bump(t, 2, 9, 70, 86));
  add("0:26", 91, -80, (t) => -2.4 * bump(t, 2, 9, 70, 86));
  add("0:12", 17, 1, (t) => -0.02 * lean(t));
  add("0:12", 15, 0, (t) => 0.025 * lean(t));
  add("0:14", 15, 0, (t) => -0.05 * bump(t, 4, 18, 70, 86));
  add("0:16", 15, 0, (t) => 0.05 * bump(t, 4, 18, 70, 86));
  add("0:27", 15, 0, (t) => -0.12 * bump(t, 6, 20, 60, 86) + 0.05 * ring(t, 10, 2.2, 0.8));
  add("0:28", 15, 0, (t) => 0.12 * bump(t, 6, 20, 60, 86) - 0.05 * ring(t, 14, 2.2, 0.8));
  const wag = (t) => bump(t, 4, 14, 66, 88);
  add("0:34", 15, 0, (t) => 0.22 * ring(t, 6, 2.6, 0.5) * wag(t));
  add("0:35", 15, 0, (t) => 0.32 * ring(t, 9, 2.6, 0.5) * wag(t));
  add("0:36", 15, 0, (t) => 0.42 * ring(t, 12, 2.6, 0.5) * wag(t));
  add("0:37", 17, 1, (t) => 0.22 * wag(t) + 0.08 * ring(t, 8, 3, 0.6));
}

/* ---------- belly poke: quick squash, recoil, surprised brows, giggle shake, settle ---------- */
function bellyPoke(add) {
  // acknowledgement is immediate: the belly squashes within 3 ticks (50 ms)
  const hit = (t) => out(t, 0, 3);
  const settle = (t) => 1 - out(t, 3, 16);
  add("0:13", 17, 1, (t) => -0.14 * hit(t) * settle(t) + 0.07 * ring(t, 8, 3.4, 3.2));
  add("0:13", 16, 1, (t) => 0.16 * hit(t) * settle(t) - 0.07 * ring(t, 8, 3.4, 3.2));
  add("0:12", 17, 1, (t) => -0.08 * hit(t) * settle(t) + 0.045 * ring(t, 8, 3.4, 3.4));
  add("0:12", 15, 0, (t) => -0.045 * hit(t) * settle(t));
  add("0:11", 90, 0, (t) => -3.2 * hit(t) * settle(t));
  add("0:18", 91, REST.headY, (t) => 5 * hit(t) * settle(t) - 4.6 * bump(t, 6, 14, 28, 44));
  add("0:18", 15, 0, (t) => 0.055 * ring(t, 14, 2.1, 1.6));
  add("0:25", 91, -80, (t) => -4.2 * bump(t, 1, 7, 26, 52));
  add("0:26", 91, -80, (t) => -4.2 * bump(t, 1, 7, 26, 52));
  add("0:27", 15, 0, (t) => -0.16 * bump(t, 2, 9, 20, 40) + 0.06 * ring(t, 14, 2.4, 1.4));
  add("0:28", 15, 0, (t) => 0.16 * bump(t, 2, 9, 20, 40) - 0.06 * ring(t, 14, 2.4, 1.4));
  // giggle: squint-smile eyes and a shoulder shake
  const sq = (t) => bump(t, 12, 20, 58, 76);
  add("0:54", 17, 0, (t) => 0.5 * sq(t));
  add("0:55", 17, 0, (t) => 0.5 * sq(t));
  add("0:21", 17, 1, (t) => -0.1 * sq(t));
  add("0:23", 17, 1, (t) => -0.1 * sq(t));
  const shake = (t) => bump(t, 8, 14, 50, 82);
  add("0:14", 15, 0, (t) => 0.07 * ring(t, 8, 4.2, 0.9) * shake(t));
  add("0:16", 15, 0, (t) => -0.07 * ring(t, 8, 4.2, 0.9) * shake(t));
  add("0:12", 17, 1, (t) => 0.018 * Math.sin(2 * Math.PI * 4.2 * t / 60) * shake(t));
  add("0:34", 15, 0, (t) => 0.2 * ring(t, 6, 2.8, 0.55));
  add("0:35", 15, 0, (t) => 0.3 * ring(t, 9, 2.8, 0.55));
  add("0:36", 15, 0, (t) => 0.4 * ring(t, 12, 2.8, 0.55));
  add("0:37", 17, 1, (t) => 0.28 * Math.max(0, ring(t, 10, 2.8, 0.7)));
  return 96;
}

/* ---------- tail tug: yank, head whips round, grumpy beat, big decaying swing ---------- */
function tailTug(add) {
  const yank = (t) => out(t, 0, 8);
  add("0:34", 15, 0, (t) => -0.3 * yank(t) * Math.exp(-2.1 * Math.max(0, t - 6) / 60) * Math.cos(2 * Math.PI * 0.62 * Math.max(0, t - 6) / 60));
  add("0:35", 15, 0, (t) => -0.4 * yank(t) * Math.exp(-2.0 * Math.max(0, t - 9) / 60) * Math.cos(2 * Math.PI * 0.62 * Math.max(0, t - 9) / 60 + 0.25));
  add("0:36", 15, 0, (t) => -0.5 * yank(t) * Math.exp(-1.9 * Math.max(0, t - 12) / 60) * Math.cos(2 * Math.PI * 0.62 * Math.max(0, t - 12) / 60 + 0.5));
  add("0:37", 17, 1, (t) => 0.55 * bump(t, 3, 10, 22, 70) + 0.1 * ring(t, 20, 2.2, 1.2));
  add("0:37", 15, 0, (t) => 0.4 * ring(t, 6, 1.9, 1.5));
  // body is pulled the other way; legs counter so the feet stay planted
  const pull = (t) => bump(t, 0, 8, 30, 70);
  add("0:11", 90, 0, (t) => 5.5 * pull(t));
  add("0:30", 90, REST.legLX, (t) => -5.5 * pull(t));
  add("0:32", 90, REST.legRX, (t) => -5.5 * pull(t));
  add("0:11", 15, 0, (t) => 0.018 * pull(t));
  add("0:30", 15, 0, (t) => -0.018 * pull(t));
  add("0:32", 15, 0, (t) => -0.018 * pull(t));
  add("0:12", 15, 0, (t) => -0.05 * bump(t, 2, 12, 34, 78));
  // the eyes lead, the head whips round to look at his tail, then he glares
  const look = (t) => bump(t, 2, 9, 56, 86);
  add("0:22", 90, 0, (t) => -4.6 * look(t));
  add("0:24", 90, 0, (t) => -4.6 * look(t));
  add("0:22", 91, 0, (t) => 1.6 * look(t));
  add("0:24", 91, 0, (t) => 1.6 * look(t));
  const turn = (t) => bump(t, 4, 18, 54, 90);
  add("0:19", 90, REST.snoutX, (t) => -6 * turn(t));
  add("0:18", 90, REST.headX, (t) => -10 * turn(t));
  add("0:18", 15, 0, (t) => -0.115 * turn(t) + 0.03 * ring(t, 30, 1.8, 1.4));
  add("0:18", 91, REST.headY, (t) => 2 * bump(t, 0, 6, 12, 28) + 1.5 * turn(t));
  add("0:27", 15, 0, (t) => -0.14 * bump(t, 6, 22, 40, 80) + 0.07 * ring(t, 24, 2.0, 1.2));
  add("0:28", 15, 0, (t) => -0.14 * bump(t, 6, 22, 40, 80) - 0.07 * ring(t, 24, 2.0, 1.2));
  // grumpy brows: down and in, with a puffed chest
  add("0:25", 91, -80, (t) => 3.2 * bump(t, 8, 18, 56, 88));
  add("0:26", 91, -80, (t) => 3.2 * bump(t, 8, 18, 56, 88));
  add("0:13", 16, 1, (t) => 0.05 * bump(t, 10, 22, 50, 84));
  add("0:21", 17, 1, (t) => -0.12 * bump(t, 8, 16, 54, 84));
  add("0:23", 17, 1, (t) => -0.12 * bump(t, 8, 16, 54, 84));
  add("0:54", 17, 0, (t) => 0.22 * bump(t, 8, 16, 54, 84));
  add("0:55", 17, 0, (t) => 0.22 * bump(t, 8, 16, 54, 84));
  return 132;
}

const replaceAnim = (id, xml) => {
  const re = new RegExp('<LinearAnimation name="[^"]*"[^>]*id="' + id + '">[^]*?</LinearAnimation>');
  if (re.test(s)) s = s.replace(re, () => xml);
  else s = s.replace(/(<LinearAnimation name="Stretch"[^>]*id="0:455">[^]*?<\/LinearAnimation>)/, (m) => m + "\n        " + xml);
};
replaceAnim("0:117", withSteps(animation("Petting", "0:117", 88, pat), stepObj("0:722", 88, 3, 80) + "\n            " + stepObj("0:723", 88, 4, 80) + "\n            " + edgeObj("0:720", 88, 3, 80) + "\n            " + edgeObj("0:721", 88, 4, 80)));
let Dp = 0;
const bp = animation("Belly poke", "0:730", 96, (add) => { Dp = bellyPoke(add); });
replaceAnim("0:730", bp);
const tt = animation("Tail tug", "0:731", 132, (add) => { tailTug(add); });
replaceAnim("0:731", tt);

/* ---------- state machine: states and transitions for intents 26 and 27 ---------- */
const transition = (target, value) => `<StateTransition stateToId="${target}" duration="90" enableEarlyExit="true">
                        <TransitionViewModelCondition>
                            <TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="0:60-0:61" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator>
                            <TransitionValueNumberComparator value="0"/>
                        </TransitionViewModelCondition>
                        <TransitionViewModelCondition>
                            <TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="0:60-0:63" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator>
                            <TransitionValueNumberComparator value="${value}"/>
                        </TransitionViewModelCondition>
                    </StateTransition>`;
if (!s.includes('id="0:740"')) {
  const anchor = '<AnimationState x="1040" y="540" animationId="0:455" id="0:465"/>';
  if (!s.includes(anchor)) throw new Error("state anchor");
  s = s.replace(anchor, anchor + '\n                <AnimationState x="1245" y="540" animationId="0:730" id="0:740" reset="true"/>\n                <AnimationState x="1450" y="540" animationId="0:731" id="0:741" reset="true"/>');
  const anyAnchor = '</AnimationState>';
  // add the two transitions at the end of the Intent layer's AnyState
  const idx = s.indexOf('<StateMachineLayer name="Intent"');
  const anyEnd = s.indexOf("</AnyState>", idx);
  s = s.slice(0, anyEnd) + "    " + transition("0:740", 26) + "\n                    " + transition("0:741", 27) + "\n                " + s.slice(anyEnd);
}
writeFileSync(FILE, s);
console.log("ok");
