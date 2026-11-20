import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMPANION_EVENTS, DEFAULT_PREFS, OUTFITS, parsePrefs } from "./companion-logic";
import { createDirector } from "./companion-motion/director";
import { OUTFIT_LAYERS, outfitTransform } from "./companion-motion/outfits";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const outfitDir = join(publicDir, "mascot", "companion", "outfits");
const companionDir = join(here, "..", "components", "companion");
const outfitsFile = join(here, "companion-motion", "outfits.ts");
const rendererFile = join(companionDir, "rig-renderer.ts");
const engineFile = join(companionDir, "engine.ts");
const pickerFile = join(companionDir, "companion.tsx");

/** Words that would mean an outfit reads or writes learning state. */
const LEARNING_WORDS = new Set(["mastery", "grade", "grades", "progress", "star", "stars", "xp", "coin", "coins", "supabase", "fetch"]);
/** The picker's own copy says the outfit never changes his progress. That sentence is set aside; the code around it is checked. */
const PICKER_COPY = "Cosmetic only. It never changes his progress.";

/** Comments are not code, so they are set aside before the word check. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** Identifiers with a learning word inside them, so masteryLevel and xp_total count as well as mastery and xp. */
function learningIdentifiersIn(code: string): string[] {
  return [...code.matchAll(/[A-Za-z_$][\w$]*/g)]
    .map((match) => match[0])
    .filter((name) => name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => LEARNING_WORDS.has(word)));
}

/** A seeded generator, so every run drives the same frames. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("each outfit is one layer with its own drawing, and the outfit folder holds nothing else", () => {
  const sources = OUTFITS.map((id) => OUTFIT_LAYERS[id].src);
  assert.equal(new Set(sources).size, OUTFITS.length, "two outfits point at one layer file");
  const digests = sources.map((src) => createHash("sha256").update(readFileSync(join(publicDir, src))).digest("hex"));
  assert.equal(new Set(digests).size, OUTFITS.length, "two outfits carry the same drawing");
  assert.deepEqual(
    readdirSync(outfitDir).filter((name) => name.endsWith(".svg")).sort(),
    OUTFITS.map((id) => `${id}.svg`).sort()
  );
});

test("outfit drawings are under 20 KB, link only to ids inside themselves, and carry no event handlers", () => {
  for (const id of OUTFITS) {
    const file = join(publicDir, OUTFIT_LAYERS[id].src);
    const source = readFileSync(file, "utf8");
    const bytes = statSync(file).size;
    assert.ok(bytes < 20 * 1024, `${id} is ${bytes} bytes`);
    assert.doesNotMatch(source, /\son[a-z]+\s*=/i, `${id} has an event handler attribute`);
    const ids = new Set([...source.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const [, , target] of source.matchAll(/\s(?:xlink:)?href\s*=\s*(["'])(.*?)\1/g)) {
      assert.ok(target.startsWith("#") && ids.has(target.slice(1)), `${id} links to ${target}`);
    }
  }
});

test("outfit art and renderer code are cosmetic only: no mastery, grade, progress, stars, xp, coins, supabase or fetch", () => {
  for (const file of [outfitsFile, rendererFile]) {
    assert.deepEqual(learningIdentifiersIn(codeOnly(readFileSync(file, "utf8"))), [], file);
  }
});

test("the word check catches compound names such as masteryLevel and xp_total, and passes gradient", () => {
  assert.deepEqual(learningIdentifiersIn("masteryLevel xp_total gradient restart startAt starCount"), ["masteryLevel", "xp_total", "starCount"]);
});

test("the outfit picker in engine.ts and companion.tsx sets only the cosmetic outfit", () => {
  for (const file of [engineFile, pickerFile]) {
    const lines = readFileSync(file, "utf8").split("\n").filter((line) => /outfit/i.test(line));
    assert.ok(lines.length >= 3, `${file} has ${lines.length} outfit lines`);
    for (const line of lines) {
      assert.deepEqual(learningIdentifiersIn(line.replace(PICKER_COPY, "")), [], `${file}: ${line.trim()}`);
    }
  }
  assert.match(readFileSync(engineFile, "utf8"), /changePrefs\(\{ outfit: parseOutfit\(/);
  assert.match(readFileSync(pickerFile, "utf8"), /update\(\{ outfit: parseOutfit\(/);
});

test("outfits stay finite and close to him through 2,000 random frames of a real director", () => {
  const random = seeded(0x1c18);
  const director = createDirector({ random });
  const modes = ["snap", "look", "drift"] as const;
  const beats = new Set<string>();
  let maxSpin = 0, maxSquash = 0, maxLean = 0;
  let now = 0;
  for (let n = 0; n < 2000; n += 1) {
    now += 1000 / 60;
    if (random() < 0.04) director.onEvent(COMPANION_EVENTS[Math.floor(random() * COMPANION_EVENTS.length)], { level: random() < 0.5 ? 1 : 2 });
    if (random() < 0.02) director.lookAt(random() * 3 - 1.5, random() * 3 - 1.5, 200 + random() * 2800, modes[Math.floor(random() * modes.length)]);
    if (random() < 0.01) director.setHeld(random() < 0.5);
    if (random() < 0.01) director.setThinking(random() < 0.5);
    const frame = director.advance(now);
    if (frame.beat) beats.add(frame.beat);
    maxSpin = Math.max(maxSpin, Math.abs(frame.spin));
    maxSquash = Math.max(maxSquash, Math.abs(frame.squash));
    maxLean = Math.max(maxLean, Math.abs(frame.lean));
    for (const id of OUTFITS) {
      const pose = outfitTransform(id, frame);
      const where = `${id} at frame ${n}: ${JSON.stringify(pose)}`;
      assert.ok([pose.x, pose.y, pose.rotate, pose.scaleX, pose.scaleY].every(Number.isFinite), where);
      assert.ok(pose.x >= -200 && pose.x <= 600 && pose.y >= -200 && pose.y <= 600, where);
      assert.ok(Math.abs(pose.scaleX) <= 2 && Math.abs(pose.scaleY) <= 2, where);
      assert.ok(Math.abs(pose.rotate) <= 1, where);
    }
  }
  assert.ok(beats.size >= 5, `the drive ran only ${beats.size} beats`);
  assert.ok(maxSpin > 0.5 && maxSquash > 0.05 && maxLean > 0.05, `the drive did not turn, squash and lean him enough (${maxSpin}, ${maxSquash}, ${maxLean})`);
});

test("a saved outfit that is not in the list reads as none, and every real outfit reads back as itself", () => {
  for (const outfit of ['"crown"', '"Visor"', '"constructor"', '""', "7", "null", '["visor"]']) {
    assert.equal(parsePrefs(`{"v":2,"outfit":${outfit}}`).outfit, null, `outfit ${outfit}`);
  }
  for (const id of OUTFITS) assert.equal(parsePrefs(JSON.stringify({ ...DEFAULT_PREFS, outfit: id })).outfit, id);
});
