// Bigger whole-body acting for Studigo's reactions. Run last, after idle, touch, expressions and mouth:
//   node scripts/living-companion/build-studigo-boost.mjs
// Scales every head, body, arm, leg, tail and frill move in the reaction animations away from the bone's
// rest value, so the same performances read at V1 energy. Face parts (eyes, lids, brows, mouths) keep
// their authored size. Each animation is marked once, so running it again does not compound.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "design/living-companion/rive/studigo/scene.rml";
let s = readFileSync(FILE, "utf8");

const GAIN = Number(process.env.STUDIGO_BOOST ?? 1.6);
// Rotations and sideways moves carry the acting and scale up cleanly. Scale and the head's lift stretch the
// one drawing (a long neck), so they stay as authored; hops get a little more air.
const gainFor = (oid, key) => key === "15" || key === "90" ? GAIN : key === "91" && (oid === "0:10" || oid === "0:11") ? 1.25 : 1;
const BODY = ["0:10", "0:11", "0:12", "0:13", "0:14", "0:15", "0:16", "0:17", "0:18", "0:70", "0:19", "0:27", "0:28", "0:29", "0:30", "0:31", "0:32", "0:33", "0:34", "0:35", "0:36", "0:37"];
const REACTIONS = ["Listening", "Thinking", "Happy", "Celebrating", "Encouraging", "Correct", "Incorrect · Reassure", "Curious", "Wake",
  "Petting", "Surprised", "Proud", "Playfully annoyed", "Excited", "Belly poke", "Tail tug"];

// rest values: rotation 0, scale 1, x and y from the bone's bind attributes
const rest = {};
for (const id of BODY) {
  const m = new RegExp(`<RootBone([^>]*)id="${id}"`).exec(s);
  if (!m) throw new Error("bone " + id);
  const x = /\bx="([-\d.]+)"/.exec(m[1]), y = /\by="([-\d.]+)"/.exec(m[1]);
  rest[id] = { 15: 0, 16: 1, 17: 1, 90: x ? Number(x[1]) : 0, 91: y ? Number(y[1]) : 0 };
}
// the head's world y moves fastest; keep its hops and dips from reaching the frills' clip
const LIMIT = { "0:18|15": 0.12 };

const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const name of REACTIONS) {
  const re = new RegExp(`(<LinearAnimation name="${esc(name)}"[^>]*>)([^]*?)(</LinearAnimation>)`);
  const m = re.exec(s);
  if (!m) { console.warn("skip " + name); continue; }
  if (m[2].includes("<!-- boosted")) continue;
  const body = m[2].replace(/<KeyedObject objectId="([^"]+)">([^]*?)<\/KeyedObject>/g, (all, oid, inner) => {
    if (!rest[oid]) return all;
    return `<KeyedObject objectId="${oid}">` + inner.replace(/<KeyedProperty propertyKey="(\d+)">([^]*?)<\/KeyedProperty>/g, (kp, key, keys) => {
      const r = rest[oid][key];
      if (r === undefined) return kp;
      const lim = LIMIT[oid + "|" + key];
      const g = gainFor(oid, key);
      if (g === 1) return kp;
      return `<KeyedProperty propertyKey="${key}">` + keys.replace(/value="([-\d.e]+)"/g, (_, v) => {
        let n = r + (Number(v) - r) * g;
        if (lim !== undefined) n = Math.max(-lim, Math.min(lim, n));
        return `value="${+n.toFixed(4)}"`;
      }) + "</KeyedProperty>";
    }) + "</KeyedObject>";
  });
  s = s.slice(0, m.index) + m[1] + `\n            <!-- boosted rot/x x${GAIN} -->` + body + m[3] + s.slice(m.index + m[0].length);
}
writeFileSync(FILE, s);
console.log("ok");
