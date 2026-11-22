// Growth on the rig: the view-model number `growth` (0 = Hatchling .. 1 = Legend, the app sends stage / 6)
// grows Studigo from 86% to full size from his feet, lengthens his frills and raises his head spike.
// Growth 1 is the approved design exactly; earlier stages are a smaller, younger version of it.
// Default 1, so a host that never sends growth shows him as before. Run from the repository root:
//   node scripts/living-companion/build-studigo-growth.mjs
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");
const P = { prop: "0:820", size: "0:821", frill: "0:822", spike: "0:823", frillW: "0:824" };

/* 1. a pivot at his feet around the whole skeleton */
if (!s.includes('name="Growth pivot"')) {
  const open = '<RootBone x="270" y="520" length="0" name="Root" id="0:10">';
  const at = s.indexOf(open);
  if (at < 0) throw new Error("root bone");
  let depth = 0, i = at;
  for (;;) {
    const o = s.indexOf("<RootBone", i + 1), c = s.indexOf("</RootBone>", i + 1);
    if (o !== -1 && o < c) { if (!s.slice(o, s.indexOf(">", o) + 1).endsWith("/>")) depth++; i = o; }
    else { if (depth === 0) { i = c + "</RootBone>".length; break; } depth--; i = c; }
  }
  const root = s.slice(at, i);
  s = s.slice(0, at) + `<Node x="270" y="520" name="Growth pivot" id="0:825">
            <DataBindContext sourcePathIds="0:60-${P.prop}" propertyKey="16" converterId="${P.size}"/>
            <DataBindContext sourcePathIds="0:60-${P.prop}" propertyKey="17" converterId="${P.size}"/>
            <Node x="-270" y="-520" name="Growth pivot return" id="0:826">
        ${root}
            </Node>
        </Node>` + s.slice(i);
}

/* 2. frills grow longer and a little wider, the spike taller */
const bindBone = (id, binds) => {
  const re = new RegExp(`(<RootBone [^>]*id="${id}")(\\s*/>|>)`);
  const m = re.exec(s);
  if (!m) throw new Error("bone " + id);
  if (s.slice(m.index, m.index + 400).includes(`sourcePathIds="0:60-${P.prop}"`)) return;
  const inner = binds.map(([key, conv]) => `<DataBindContext sourcePathIds="0:60-${P.prop}" propertyKey="${key}" converterId="${conv}"/>`).join("");
  s = s.slice(0, m.index) + m[1] + ">" + inner + (m[2].trim() === "/>" ? "</RootBone>" : "") + s.slice(m.index + m[0].length);
};
bindBone("0:27", [[17, P.frill], [16, P.frillW]]);
bindBone("0:28", [[17, P.frill], [16, P.frillW]]);
bindBone("0:29", [[17, P.spike]]);

/* 3. the property (default 1) and its converters */
if (!s.includes(`id="${P.prop}"`)) {
  s = s.replace('<ViewModelPropertyNumber name="talk" id="0:800"/>', (m) => `${m}\n        <ViewModelPropertyNumber name="growth" id="${P.prop}"/>`);
  s = s.replace('<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="0:800"/>', (m) => `${m}\n            <ViewModelInstanceNumber propertyValue="1" viewModelPropertyId="${P.prop}"/>`);
  s = s.replace(/(<DataConverterRangeMapper name="Neck horizontal reach")/, `<DataConverterRangeMapper name="Growth size" minInput="0" maxInput="1" minOutput="0.86" maxOutput="1" clampLower="true" clampUpper="true" id="${P.size}"/>
    <DataConverterRangeMapper name="Growth frill length" minInput="0" maxInput="1" minOutput="0.84" maxOutput="1" clampLower="true" clampUpper="true" id="${P.frill}"/>
    <DataConverterRangeMapper name="Growth frill width" minInput="0" maxInput="1" minOutput="0.92" maxOutput="1" clampLower="true" clampUpper="true" id="${P.frillW}"/>
    <DataConverterRangeMapper name="Growth spike" minInput="0" maxInput="1" minOutput="0.7" maxOutput="1" clampLower="true" clampUpper="true" id="${P.spike}"/>
    $1`);
}
writeFileSync(FILE, s);
console.log("ok");
