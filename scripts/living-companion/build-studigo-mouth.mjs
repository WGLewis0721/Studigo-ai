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

/* The mouths hang from the upper lip (a Head child at the jaw's rest spot), so their top edge never moves.
   The jaw bone, which carries the chin's skin, drops underneath as they open. A "Talk jaw drop" bone above
   the jaw takes the talk value, so lip sync and the reactions' keyed jaw add up instead of fighting. */
const mouths = `<Node x="0" y="-8" name="Mouths" id="0:809">
                        ${opening("Laugh mouth", IDS.laugh, 60, 24, true)}
                        ${opening("Talk mouth", IDS.talk, 44, 16, true, `
                            <DataBindContext sourcePathIds="0:60-${IDS.talkProp}" propertyKey="17" converterId="${IDS.talkMap}"/>`)}
                        ${oh}
                        </Node>`;
const jaw = `${mouths}
                        <RootBone length="0" name="Talk jaw drop" id="0:808">
                            <DataBindContext sourcePathIds="0:60-${IDS.talkProp}" propertyKey="91" converterId="0:810"/>
                            <RootBone x="0" y="-8" length="0" name="Jaw and Mouth" id="0:20"/>
                        </RootBone>`;

/* 1. the jaw (replaces the original self-closed bone, or this script's earlier output) */
const genRe = /<Node x="0" y="-8" name="Mouths" id="0:809">[^]*?<RootBone length="0" name="Talk jaw drop" id="0:808">[^]*?<\/RootBone>/;
const v1Re = /<RootBone x="0" y="-8" length="0" name="Jaw and Mouth" id="0:20"\s*(\/>|>[^]*?<\/RootBone>)/;
if (genRe.test(s)) s = s.replace(genRe, () => jaw);
else if (v1Re.test(s)) s = s.replace(v1Re, () => jaw);
else throw new Error("jaw bone");
if (!s.includes('id="0:810"')) s = s.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Talk jaw" minInput="0" maxInput="1" minOutput="0" maxOutput="7" clampLower="true" clampUpper="true" id="0:810"/>
    $1`);

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
  "Sit and wag": { laugh: (t) => 0.7 * bump(t, 20, 34, 88, 108) },
  "Tail chase": { oh: (t) => 0.7 * bump(t, 16, 22, 30, 40), laugh: (t) => laughs(t, 74, 2, 13, 0.8) },
  "Double take": { oh: (t) => 0.85 * bump(t, 31, 35, 54, 68, out) },
  "Stretch": { oh: (t) => 1.25 * bump(t, 22, 40, 58, 72) },
  "Sniff": { oh: (t) => 0.3 * bump(t, 44, 50, 54, 62) },
};

function keys(D, fn) {
  const pts = [];
  for (let t = 0; t <= D; t++) pts.push([t, Math.max(0, fn(t))]);
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
  let body = m[3].replace(new RegExp(`\\s*<KeyedObject objectId="(${IDS.laugh}|${IDS.oh}|0:20)">[^]*?</KeyedObject>`, "g"), "");
  const add = [];
  if (plan.laugh) add.push(keyed(IDS.laugh, [[17, keys(D, plan.laugh)]]));
  if (plan.oh) { const k = keys(D, plan.oh); add.push(keyed(IDS.oh, [[16, k], [17, k]])); }
  // the chin drops with the opening: 9 px for a full laugh, barely for an O (it sits on the lip line)
  const drop = (t) => Math.max(9 * (plan.laugh ? clamp(plan.laugh(t)) : 0), 2.5 * (plan.oh ? clamp(plan.oh(t)) : 0));
  add.push(keyed("0:20", [[91, keys(D, drop).map((k) => k.replace(/value="([-\d.e]+)"/, (_, v) => `value="${+(Number(v) - 8).toFixed(3)}"`))]]));
  body = body.replace(/\s*$/, "") + "\n            " + add.join("\n            ") + "\n        ";
  s = s.slice(0, m.index) + m[1] + body + m[4] + s.slice(m.index + m[0].length);
}

writeFileSync(FILE, s);
console.log("ok");

/* 4. Emotes scale from their own centre instead of fading. The app springs the value (0 -> ~1.25 -> 1)
   so they pop; the floor keeps an undershoot from flipping them. */
{
  let t = readFileSync(FILE, "utf8");
  const CENTRES = { spark: [372, 143, "0:438"], heart: [365, 150, "0:439"], thought: [378, 138, "0:440"] };
  for (const [kind, [cx, cy, prop]] of Object.entries(CENTRES)) {
    if (t.includes(`name="${kind} emote art"`)) continue;
    const open = `<Node name="${kind} emote" opacity="0">\n            <DataBindContext sourcePathIds="0:60-${prop}" propertyKey="18"/>`;
    const at = t.indexOf(open);
    if (at < 0) throw new Error("emote " + kind);
    // find this node's closing tag (emote nodes hold only shapes, so the first </Node> after it closes it)
    const close = t.indexOf("</Node>", at);
    const inner = t.slice(at + open.length, close);
    const node = `<Node name="${kind} emote" x="${cx}" y="${cy}" scaleX="0" scaleY="0">
            <DataBindContext sourcePathIds="0:60-${prop}" propertyKey="16" converterId="0:806"/>
            <DataBindContext sourcePathIds="0:60-${prop}" propertyKey="17" converterId="0:806"/>
            <Node name="${kind} emote art" x="${-cx}" y="${-cy}">${inner}</Node>
        `;
    t = t.slice(0, at) + node + t.slice(close);
  }
  if (!t.includes('id="0:806"')) {
    t = t.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Emote floor" minInput="0" maxInput="2" minOutput="0" maxOutput="2" clampLower="true" id="0:807"/>
    <DataConverterGroup name="Emote pop" id="0:806"><DataConverterGroupItem converterId="0:807"/></DataConverterGroup>
    $1`);
  }
  writeFileSync(FILE, t);
  console.log("emotes ok");
}

/* 5. Speech moves the whole head: a "Talk stretch" pivot at the neck stretches the head tall and a touch
   narrow on each loud syllable (squash and stretch), with a slight tilt, so he talks with his whole face. */
{
  let t = readFileSync(FILE, "utf8");
  if (!t.includes('name="Talk stretch"')) {
    const open = '<RootBone y="85" length="0" name="Neck bind offset" id="0:71">';
    const at = t.indexOf(open);
    if (at < 0) throw new Error("neck bind offset");
    const headOpen = '<RootBone x="-2" y="-85" length="0" name="Head" id="0:18">';
    const h = t.indexOf(headOpen, at);
    // the Head bone's subtree ends at the matching </RootBone>
    let depth = 0, i = h;
    for (;;) {
      const o = t.indexOf("<RootBone", i + 1), c = t.indexOf("</RootBone>", i + 1);
      if (o !== -1 && o < c) { const selfClose = t.slice(o, t.indexOf(">", o) + 1).endsWith("/>"); if (!selfClose) depth++; i = o; }
      else { if (depth === 0) { i = c + "</RootBone>".length; break; } depth--; i = c; }
    }
    const head = t.slice(h, i);
    const wrapped = `<RootBone y="-55" length="0" name="Talk stretch" id="0:811">
                        <DataBindContext sourcePathIds="0:60-0:800" propertyKey="17" converterId="0:812"/>
                        <DataBindContext sourcePathIds="0:60-0:800" propertyKey="16" converterId="0:813"/>
                        <DataBindContext sourcePathIds="0:60-0:800" propertyKey="15" converterId="0:814"/>
                        <RootBone y="55" length="0" name="Talk stretch return" id="0:815">
                        ${head}
                        </RootBone>
                        </RootBone>`;
    t = t.slice(0, h) + wrapped + t.slice(i);
    t = t.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Talk stretch tall" minInput="0" maxInput="1" minOutput="1" maxOutput="1.055" clampLower="true" clampUpper="true" id="0:812"/>
    <DataConverterRangeMapper name="Talk stretch narrow" minInput="0" maxInput="1" minOutput="1" maxOutput="0.975" clampLower="true" clampUpper="true" id="0:813"/>
    <DataConverterRangeMapper name="Talk tilt" minInput="0" maxInput="1" minOutput="0" maxOutput="0.03" clampLower="true" clampUpper="true" id="0:814"/>
    $1`);
  }
  writeFileSync(FILE, t);
  console.log("talk stretch ok");
}
