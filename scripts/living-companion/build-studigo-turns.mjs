// Real head turns for Studigo, Live2D style: the painted head itself turns. Run from the repository root after
// the other rig scripts (build-studigo-all.mjs runs everything):
//   node scripts/living-companion/build-studigo-turns.mjs
//
// design/living-companion/rive/studigo/turns/turn-deltas.json holds, for every vertex of the skin mesh, how far it
// moves (artboard px) when his head turns right, left, up or down. It was measured on a 3D model of Studigo
// (Meshy image-to-3D of the approved neutral, aligned on the eyes and mouth): each head vertex was traced onto the
// 3D head, rotated 30 degrees in yaw or 14 in pitch about his neck (scaled by its head weight), and projected back.
// Near features slide further than far ones and the far side compresses, which is what reads as a turn.
//
// Four one-frame animations key those vertex positions; a "Turn" layer blends them directly from gazeX / gazeY,
// eased by the same soft follow the neck uses. At gaze 0 every weight is 0 and the mesh is untouched.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
const DELTAS = JSON.parse(readFileSync("design/living-companion/rive/studigo/turns/turn-deltas.json", "utf8"));
let s = readFileSync(FILE, "utf8");

/* 1. give the skin mesh's vertices ids, so they can be keyed */
const imgRe = /(<Image x="270" y="270" assetId="0:8" name="Canonical skin" id="0:9">)([^]*?)(<\/Image>)/;
const img = imgRe.exec(s);
if (!img) throw new Error("skin image");
let n = 0;
const rest = [];
const body = img[2].replace(/<(ContourMeshVertex|MeshVertex)\b([^>]*)>/g, (all, type, attrs) => {
  const x = Number(/\bx="([-\d.]+)"/.exec(attrs)[1]), y = Number(/\by="([-\d.]+)"/.exec(attrs)[1]);
  rest.push([x, y]);
  const id = `0:${2000 + n++}`;
  const clean = attrs.replace(/\s+id="[^"]*"/, "");
  return `<${type}${clean} id="${id}">`;
});
if (n !== DELTAS.length) throw new Error(`vertex count ${n} != deltas ${DELTAS.length}`);
s = s.slice(0, img.index) + img[1] + body + img[3] + s.slice(img.index + img[0].length);

/* 2. one pose per direction */
const POSES = [["Turn right", "right", "0:2400"], ["Turn left", "left", "0:2401"], ["Turn up", "up", "0:2402"], ["Turn down", "down", "0:2403"]];
const fmt = (v) => String(+v.toFixed(3));
for (const [name, key, id] of POSES) {
  const objs = [];
  DELTAS.forEach((d, i) => {
    if (!d[key]) return;
    const [dx, dy] = d[key];
    if (Math.abs(dx) + Math.abs(dy) < 0.05) return;
    objs.push(`<KeyedObject objectId="0:${2000 + i}"><KeyedProperty propertyKey="24"><KeyFrameDouble value="${fmt(rest[i][0] + dx)}"/></KeyedProperty><KeyedProperty propertyKey="25"><KeyFrameDouble value="${fmt(rest[i][1] + dy)}"/></KeyedProperty></KeyedObject>`);
  });
  const xml = `<LinearAnimation name="${name}" duration="1" id="${id}">\n            ${objs.join("\n            ")}\n        </LinearAnimation>`;
  const re = new RegExp(`<LinearAnimation name="${name}"[^>]*>[^]*?</LinearAnimation>`);
  if (re.test(s)) s = s.replace(re, () => xml);
  else s = s.replace(/(<LinearAnimation name="Still")/, `${xml}\n        $1`);
}

/* 3. converters: gaze -> 0..100 weight per direction, eased by the neck's soft follow (0:227) */
if (!s.includes('id="0:2410"')) {
  s = s.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Turn right weight" minInput="0" maxInput="1" minOutput="0" maxOutput="80" clampLower="true" clampUpper="true" id="0:2410"/>
    <DataConverterRangeMapper name="Turn left weight" minInput="-1" maxInput="0" minOutput="80" maxOutput="0" clampLower="true" clampUpper="true" id="0:2411"/>
    <DataConverterRangeMapper name="Turn down weight" minInput="0" maxInput="1" minOutput="0" maxOutput="100" clampLower="true" clampUpper="true" id="0:2412"/>
    <DataConverterRangeMapper name="Turn up weight" minInput="-1" maxInput="0" minOutput="100" maxOutput="0" clampLower="true" clampUpper="true" id="0:2413"/>
    $1`);
  s = s.replace(/(<DataConverterGroup name="Live neck X")/, `<DataConverterGroup name="Turn right" id="0:2414"><DataConverterGroupItem converterId="0:227"/><DataConverterGroupItem converterId="0:2410"/></DataConverterGroup>
    <DataConverterGroup name="Turn left" id="0:2415"><DataConverterGroupItem converterId="0:227"/><DataConverterGroupItem converterId="0:2411"/></DataConverterGroup>
    <DataConverterGroup name="Turn down" id="0:2416"><DataConverterGroupItem converterId="0:227"/><DataConverterGroupItem converterId="0:2412"/></DataConverterGroup>
    <DataConverterGroup name="Turn up" id="0:2417"><DataConverterGroupItem converterId="0:227"/><DataConverterGroupItem converterId="0:2413"/></DataConverterGroup>
    $1`);
}

/* 4. the Turn layer, last, so the turn applies on top of whatever the body is doing */
const blend = (anim, prop, conv) => `<BlendAnimationDirect animationId="${anim}" blendSource="2">
                        <BindablePropertyNumber><DataBindContext sourcePathIds="0:60-${prop}" propertyKey="636" converterId="${conv}"/></BindablePropertyNumber>
                    </BlendAnimationDirect>`;
const layer = `<StateMachineLayer name="Turn" id="0:2420">
                <EntryState x="20" y="20"><StateTransition stateToId="0:2421"/></EntryState>
                <AnyState x="20" y="-80"/>
                <ExitState x="400" y="20"/>
                <BlendStateDirect x="200" y="20" id="0:2421">
                    ${blend("0:2400", "0:64", "0:2414")}
                    ${blend("0:2401", "0:64", "0:2415")}
                    ${blend("0:2403", "0:65", "0:2416")}
                    ${blend("0:2402", "0:65", "0:2417")}
                </BlendStateDirect>
            </StateMachineLayer>`;
s = s.replace(/\s*<StateMachineLayer name="Turn" id="0:2420">[^]*?<\/StateMachineLayer>/, "");
const intentEnd = s.indexOf("</StateMachineLayer>", s.indexOf('<StateMachineLayer name="Intent"'));
if (intentEnd < 0) throw new Error("intent layer");
const at = intentEnd + "</StateMachineLayer>".length;
s = s.slice(0, at) + "\n            " + layer + s.slice(at);

writeFileSync(FILE, s);
console.log("turns ok " + POSES.length);
