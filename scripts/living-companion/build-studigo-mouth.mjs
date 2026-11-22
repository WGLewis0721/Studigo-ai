// Mouth shapes for Studigo. Run from the repository root after the idle, touch and expressions scripts:
//   node scripts/living-companion/build-studigo-mouth.mjs
// The painted smile stays as the closed mouth. Three openings sit under it on the Jaw and Mouth bone:
// a laugh (reactions), an O (surprise) and a talk mouth bound to the view-model number `talk` (0..1)
// for lip sync. Each grows from the painted lip line, so nothing fades or swaps.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

const IDS = { laugh: "0:801", oh: "0:802", talk: "0:803", talkProp: "0:800", talkMap: "0:804" };

/* Jaw bone origin is the centre of the painted smile's lowest point (world 268, 238).
   The painted line runs (-30,-1.5) -> (2,3.5) -> (34,-1.5) across the part that opens. */
const opening = (name, id, w, depth, tongue, binding = "") => {
  const l = -w / 2 + 2, r = w / 2 + 2;
  return `<Node x="2" y="0" scaleY="0" name="${name}" id="${id}">${binding}
                            <Shape x="-2" name="${name} cavity">
                                <PointsPath isClosed="true">
                                    <CubicDetachedVertex x="${l}" y="-1.5" inRotation="1.0" inDistance="${(w * 0.22).toFixed(1)}" outRotation="0.28" outDistance="${(w * 0.3).toFixed(1)}"/>
                                    <CubicDetachedVertex x="2" y="3.5" inRotation="3.1416" inDistance="${(w * 0.22).toFixed(1)}" outRotation="0" outDistance="${(w * 0.22).toFixed(1)}"/>
                                    <CubicDetachedVertex x="${r}" y="-1.5" inRotation="2.86" inDistance="${(w * 0.3).toFixed(1)}" outRotation="2.14" outDistance="${(w * 0.22).toFixed(1)}"/>
                                    <CubicDetachedVertex x="2" y="${depth}" inRotation="0" inDistance="${(w * 0.36).toFixed(1)}" outRotation="3.1416" outDistance="${(w * 0.36).toFixed(1)}"/>
                                </PointsPath>
                                <Fill fillRule="clockwise">
                                    <LinearGradient startX="0" startY="0" endX="0" endY="${depth}">
                                        <GradientStop position="0" colorValue="FF3E0E0B"/>
                                        <GradientStop position="1" colorValue="FF7A2A22"/>
                                    </LinearGradient>
                                </Fill>
                                <Stroke thickness="1.6" join="round"><SolidColor colorValue="FF5A2414"/></Stroke>
                            </Shape>${tongue ? `
                            <Shape x="1" y="${(depth * 0.66).toFixed(1)}" name="${name} tongue">
                                <Ellipse width="${(w * 0.42).toFixed(1)}" height="${(depth * 0.42).toFixed(1)}"/>
                                <Fill fillRule="clockwise">
                                    <RadialGradient startX="0" startY="-2" endX="${(w * 0.24).toFixed(1)}" endY="-2">
                                        <GradientStop position="0" colorValue="FFF0868A"/>
                                        <GradientStop position="1" colorValue="FFC2484E"/>
                                    </RadialGradient>
                                    <Feather strength="1.5" spaceValue="local"/>
                                </Fill>
                            </Shape>` : ""}
                        </Node>`;
};

const oh = `<Node x="2" y="8" scaleX="0" scaleY="0" name="O mouth" id="${IDS.oh}">
                            <Shape name="O mouth cavity">
                                <Ellipse width="21" height="25"/>
                                <Fill fillRule="clockwise">
                                    <LinearGradient startX="0" startY="-12" endX="0" endY="12">
                                        <GradientStop position="0" colorValue="FF3E0E0B"/>
                                        <GradientStop position="1" colorValue="FF5C1A15"/>
                                    </LinearGradient>
                                </Fill>
                                <Stroke thickness="1.8"><SolidColor colorValue="FF5A2414"/></Stroke>
                            </Shape>
                        </Node>`;

const jaw = `<RootBone x="0" y="-8" length="0" name="Jaw and Mouth" id="0:20">
                        ${opening("Laugh mouth", IDS.laugh, 60, 24, true)}
                        ${opening("Talk mouth", IDS.talk, 44, 16, true, `
                            <DataBindContext sourcePathIds="0:60-${IDS.talkProp}" propertyKey="17" converterId="${IDS.talkMap}"/>`)}
                        ${oh}
                        </RootBone>`;

/* 1. the jaw bone with its mouths (replaces a self-closed or an earlier generated bone) */
const jawRe = /<RootBone x="0" y="-8" length="0" name="Jaw and Mouth" id="0:20"\s*(\/>|>[^]*?<\/RootBone>)/;
if (!jawRe.test(s)) throw new Error("jaw bone");
s = s.replace(jawRe, () => jaw);

/* 2. the `talk` view-model number and its clamp */
if (!s.includes(`id="${IDS.talkProp}"`)) {
  s = s.replace('<ViewModelPropertyNumber name="sash" id="0:306"/>', (m) => `${m}\n        <ViewModelPropertyNumber name="talk" id="${IDS.talkProp}"/>`);
  s = s.replace('<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:306"/>', (m) => `${m}\n            <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="${IDS.talkProp}"/>`);
  s = s.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Talk open" minInput="0" maxInput="1" minOutput="0" maxOutput="1" clampLower="true" clampUpper="true" id="${IDS.talkMap}"/>\n    $1`);
}

/* 3. mouth keys inside the reactions */
const clamp = (x) => Math.max(0, Math.min(1, x));
const io = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * x * (x * (x * 6 - 15) + 10); };
const out = (t, a, b) => { const x = clamp((t - a) / (b - a)); return 1 - Math.pow(1 - x, 3); };
const bump = (t, a, b, c, d, ease = io) => ease(t, a, b) * (1 - ease(t, c, d));
// a chattering laugh: open, with small re-closures, like "ha-ha"
const laughs = (t, a, n, gap, amp = 1) => {
  let v = 0;
  for (let i = 0; i < n; i++) v = Math.max(v, (i === 0 ? 1 : 0.78) * bump(t, a + i * gap, a + i * gap + 4, a + i * gap + gap - 5, a + i * gap + gap, out));
  return amp * v;
};

const PLAN = {
  "Happy": { laugh: (t) => 0.75 * bump(t, 4, 12, 36, 50, out) },
  "Celebrating": { laugh: (t) => laughs(t, 6, 3, 18) },
  "Correct": { laugh: (t) => 0.85 * bump(t, 6, 13, 30, 44, out) },
  "Encouraging": { laugh: (t) => 0.5 * bump(t, 10, 20, 46, 62) },
  "Excited": { laugh: (t) => laughs(t, 4, 4, 16) },
  "Proud": { laugh: (t) => 0.45 * bump(t, 12, 24, 50, 64) },
  "Wake": { oh: (t) => bump(t, 6, 16, 26, 40) },
  "Surprised": { oh: (t) => bump(t, 1, 5, 22, 36, out) },
  "Curious": { oh: (t) => 0.55 * bump(t, 14, 24, 38, 54) },
  "Petting": { laugh: (t) => 0.35 * bump(t, 10, 22, 64, 82) },
  "Belly poke": { oh: (t) => bump(t, 1, 5, 12, 20, out), laugh: (t) => laughs(t, 18, 4, 15, 0.9) },
  "Tail tug": { oh: (t) => bump(t, 2, 6, 20, 32, out) },
  "Sit and wag": { laugh: (t) => 0.6 * bump(t, 20, 34, 90, 110) },
};

function keys(D, fn) {
  const pts = [];
  for (let t = 0; t <= D; t++) pts.push([t, clamp(fn(t))]);
  pts[0][1] = 0; pts[D][1] = 0;
  // keep every turning point and every 4th frame: dense enough for the ease, light enough for the file
  return pts.filter(([t], i) => i === 0 || i === D || t % 4 === 0 || Math.sign(pts[i][1] - pts[i - 1][1]) !== Math.sign(pts[i + 1][1] - pts[i][1]))
    .map(([t, v], i, a) => `<KeyFrameDouble frame="${t}" value="${+v.toFixed(4)}"${i < a.length - 1 ? ' interpolationType="linear"' : ""}/>`);
}
const keyed = (id, props) => `<KeyedObject objectId="${id}">\n                ${props.map(([k, ks]) => `<KeyedProperty propertyKey="${k}">\n                    ${ks.join("\n                    ")}\n                </KeyedProperty>`).join("\n                ")}\n            </KeyedObject>`;

for (const [name, plan] of Object.entries(PLAN)) {
  const re = new RegExp('(<LinearAnimation name="' + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*duration="(\\d+)"[^>]*>)([^]*?)(</LinearAnimation>)');
  const m = re.exec(s);
  if (!m) throw new Error("missing animation " + name);
  const D = Number(m[2]);
  let body = m[3].replace(new RegExp(`\\s*<KeyedObject objectId="(${IDS.laugh}|${IDS.oh})">[^]*?</KeyedObject>`, "g"), "");
  const add = [];
  if (plan.laugh) add.push(keyed(IDS.laugh, [[17, keys(D, plan.laugh)]]));
  if (plan.oh) { const k = keys(D, plan.oh); add.push(keyed(IDS.oh, [[16, k], [17, k]])); }
  body = body.replace(/\s*$/, "") + "\n            " + add.join("\n            ") + "\n        ";
  s = s.slice(0, m.index) + m[1] + body + m[4] + s.slice(m.index + m[0].length);
}

writeFileSync(FILE, s);
console.log("ok");
