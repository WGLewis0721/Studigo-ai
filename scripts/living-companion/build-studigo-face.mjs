// Studigo's face: painted expression layers, speech, emotes and the talking head. Run from the repository root
// after the idle, touch, expressions and gestures scripts (build-studigo-all.mjs runs everything):
//   node scripts/living-companion/build-studigo-face.mjs
// The face layers in design/living-companion/rive/studigo/parts/ were cut from on-model Higgsfield edits of the
// approved full-body neutral (same framing, pixel-aligned within about 1 px; see ASSET_MANIFEST.md). Each is the
// changed region only, feathered and clipped to his silhouette, so it sits on the painted skin without a seam.
// They ride on the Head bone, under the eyelids. Speech switches between "ah" and a wide open mouth from the
// `talk` value; reactions switch the laugh, oh, joy, worried and closed-eye faces with hold keys, the way a drawn
// mouth chart works, while the whole head and body keep moving.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

/* 1. retire the earlier vector mouths and the procedural jaw drop */
{
  const genRe = /<Node x="0" y="-8" name="Mouths" id="0:809">[^]*?<RootBone length="0" name="Talk jaw drop" id="0:808">[^]*?<\/RootBone>/;
  if (genRe.test(s)) s = s.replace(genRe, '<RootBone x="0" y="-8" length="0" name="Jaw and Mouth" id="0:20"/>');
  s = s.replace(/\s*<KeyedObject objectId="(0:801|0:802|0:803)">[^]*?<\/KeyedObject>/g, "");
}

/* 2. the `talk` view-model number */
if (!s.includes('id="0:800"')) {
  s = s.replace('<ViewModelPropertyNumber name="sash" id="0:306"/>', (m) => `${m}\n        <ViewModelPropertyNumber name="talk" id="0:800"/>`);
  s = s.replace('<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:306"/>', (m) => `${m}\n            <ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:800"/>`);
}

/* 3. the face layers */
const HEAD = { x: 268, y: 246 };
const PARTS = {
  "eyes-closed": { asset: "0:830", cx: 270, cy: 182 },
  "mouth-laugh": { asset: "0:831", cx: 269.5, cy: 248 },
  "mouth-oh": { asset: "0:832", cx: 269.5, cy: 239.5 },
  "face-joy": { asset: "0:833", cx: 270, cy: 215 },
  "mouth-neutral": { asset: "0:834", cx: 269.5, cy: 239.5 },
  "face-worried": { asset: "0:835", cx: 270, cy: 206 },
  "mouth-ah": { asset: "0:836", cx: 270, cy: 248 },
};
// reaction layers (keyed) draw above the speech layers (bound to talk), so a reaction face wins while he talks
const LAYERS = [
  ["React joy", "face-joy", "0:840"], ["React worried", "face-worried", "0:841"], ["React laugh", "mouth-laugh", "0:842"],
  ["React oh", "mouth-oh", "0:843"], ["React ah", "mouth-ah", "0:844"], ["React eyes closed", "eyes-closed", "0:845"],
  ["React neutral", "mouth-neutral", "0:846"],
  ["Talk wide", "mouth-laugh", "0:850", "0:852"], ["Talk ah", "mouth-ah", "0:851", "0:853"],
];
const layerXml = LAYERS.map(([name, part, id, conv]) => {
  const p = PARTS[part];
  const bind = conv ? `\n                            <DataBindContext sourcePathIds="0:60-0:800" propertyKey="18" converterId="${conv}"/>` : "";
  return `<Image name="${name}" assetId="${p.asset}" x="${+(p.cx - HEAD.x).toFixed(2)}" y="${+(p.cy - HEAD.y).toFixed(2)}" opacity="0" id="${id}">${bind}
                        </Image>`;
}).join("\n                        ");
const faceNode = `<Node name="Face layers" id="0:839">
                        ${layerXml}
                        </Node>`;
s = s.replace(/<Node name="Face layers" id="0:839">[^]*?<\/Node>\s*/, "");
const snout = '<RootBone x="0" y="-26" length="0" name="Snout" id="0:19"/>';
if (!s.includes(snout)) throw new Error("snout bone");
s = s.replace(snout, `${faceNode}\n                        ${snout}`);

s = s.replace(/\s*<ImageAsset file="parts\/[^"]+" name="[^"]*" id="0:83\d"\/>/g, "");
const assets = Object.entries(PARTS).map(([k, p]) => `<ImageAsset file="parts/${k}.webp" name="Face ${k}" id="${p.asset}"/>`).join("\n    ");
s = s.replace('<ImageAsset file="outfits/sash.webp" name="Sash layer" id="0:316"/>', (m) => `${m}\n    ${assets}`);

// speech: "ah" from a little sound, the wide mouth on loud syllables (near-instant steps, like a mouth chart)
if (!s.includes('id="0:852"')) {
  s = s.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Talk wide step" minInput="0.58" maxInput="0.62" minOutput="0" maxOutput="1" clampLower="true" clampUpper="true" id="0:852"/>
    <DataConverterRangeMapper name="Talk ah step" minInput="0.14" maxInput="0.18" minOutput="0" maxOutput="1" clampLower="true" clampUpper="true" id="0:853"/>
    $1`);
}

/* 4. which face each reaction wears, and when (ticks at 60 fps) */
const FACES = {
  "Happy": [["0:840", 4, 46]],
  "Celebrating": [["0:840", 6, 62]],
  "Correct": [["0:840", 6, 40]],
  "Excited": [["0:840", 4, 66]],
  "Encouraging": [["0:844", 12, 56]],
  "Proud": [["0:844", 14, 58]],
  "Petting": [["0:844", 14, 74]],
  "Incorrect · Reassure": [["0:841", 6, 62]],
  "Wake": [["0:843", 8, 32]],
  "Surprised": [["0:843", 2, 30]],
  "Curious": [["0:843", 18, 44]],
  "Belly poke": [["0:843", 2, 16], ["0:840", 18, 80]],
  "Tail tug": [["0:843", 3, 26]],
  "Sit and wag": [["0:840", 24, 96]],
  "Tail chase": [["0:843", 17, 34], ["0:840", 76, 98]],
  "Double take": [["0:843", 32, 60]],
  "Stretch": [["0:842", 26, 64], ["0:845", 24, 70]],
  "Sniff": [["0:846", 6, 40]],
  "Sleepy": [["0:845", 104, 152]],
  "Listening": [["0:846", 1, 30]],
};
const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const [name, spans] of Object.entries(FACES)) {
  const re = new RegExp(`(<LinearAnimation name="${esc(name)}"[^>]*duration="(\\d+)"[^>]*>)([^]*?)(</LinearAnimation>)`);
  const m = re.exec(s);
  if (!m) throw new Error("missing animation " + name);
  const D = Number(m[2]);
  let body = m[3].replace(/\s*<KeyedObject objectId="0:84[0-6]">[^]*?<\/KeyedObject>/g, "");
  body = body.replace(/\s*<KeyedObject objectId="0:20">[^]*?<\/KeyedObject>/g, "");
  // a painted eye set replaces the vector lids and happy arcs in that reaction (sleepy keeps its heavy lids)
  if (name !== "Sleepy" && spans.some(([id]) => ["0:840", "0:841", "0:845"].includes(id)))
    body = body.replace(/\s*<KeyedObject objectId="0:(54|55|72[0-3])">[^]*?<\/KeyedObject>/g, "");
  const byId = new Map();
  for (const [id, on, off] of spans) { if (!byId.has(id)) byId.set(id, []); byId.get(id).push([on, Math.min(off, D)]); }
  const objs = [...byId.entries()].map(([id, list]) => {
    const keys = [`<KeyFrameDouble frame="0" value="0" interpolationType="hold"/>`];
    for (const [on, off] of list) {
      keys.push(`<KeyFrameDouble frame="${on}" value="1" interpolationType="hold"/>`);
      keys.push(`<KeyFrameDouble frame="${off}" value="0" interpolationType="hold"/>`);
    }
    return `<KeyedObject objectId="${id}">\n                <KeyedProperty propertyKey="18">\n                    ${keys.join("\n                    ")}\n                </KeyedProperty>\n            </KeyedObject>`;
  });
  body = body.replace(/\s*$/, "") + "\n            " + objs.join("\n            ") + "\n        ";
  s = s.slice(0, m.index) + m[1] + body + m[4] + s.slice(m.index + m[0].length);
}

/* 5. every intent animation that does not wear a face clears all of them at its first frame; Rive keeps an
   unkeyed value, so without this a face would stay on after an interrupted reaction */
const FACE_IDS = ["0:840", "0:841", "0:842", "0:843", "0:844", "0:845", "0:846"];
const NOT_INTENT = new Set(["Idle", "Idle B", "Idle C", "Still", "Rig Inspection"]);
s = s.replace(/(<LinearAnimation name="([^"]+)"[^>]*>)([^]*?)(<\/LinearAnimation>)/g, (all, open, name, body, close) => {
  if (NOT_INTENT.has(name)) return all;
  const missing = FACE_IDS.filter((id) => !body.includes(`<KeyedObject objectId="${id}">`));
  if (!missing.length) return all;
  const zeros = missing.map((id) => `<KeyedObject objectId="${id}"><KeyedProperty propertyKey="18"><KeyFrameDouble frame="0" value="0" interpolationType="hold"/></KeyedProperty></KeyedObject>`);
  return open + body.replace(/\s*$/, "") + "\n            " + zeros.join("\n            ") + "\n        " + close;
});

writeFileSync(FILE, s);
console.log("face ok");

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
