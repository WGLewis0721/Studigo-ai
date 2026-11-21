import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_PREFS, OUTFITS, parsePrefs } from "./companion-logic";

const here = dirname(fileURLToPath(import.meta.url));
const companionDir = join(here, "..", "components", "companion");
const outfitDir = join(here, "..", "public", "mascot", "companion", "outfits");
const outfitsFile = join(here, "companion-motion", "outfits.ts");
const rendererFile = join(companionDir, "rig-renderer.ts");
const engineFile = join(companionDir, "engine.ts");
const pickerFile = join(companionDir, "companion.tsx");
const styleFile = join(companionDir, "companion.css");

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

test("the placeholder overlays are gone: no SVG in the outfit folder, no overlay style, no overlay code", () => {
  if (existsSync(outfitDir)) assert.deepEqual(readdirSync(outfitDir).filter((name) => name.endsWith(".svg")), []);
  assert.doesNotMatch(readFileSync(styleFile, "utf8"), /\.cmpOutfit(?![\w-])/, "companion.css still styles the overlay");
  assert.doesNotMatch(readFileSync(rendererFile, "utf8"), /cmpOutfit|outfitTransform|OUTFIT_LAYERS|\.svg/, "the rig still builds an overlay");
});

test("the rig, the menu and Room Settings all read the same outfit table", () => {
  for (const file of [rendererFile, engineFile, pickerFile]) assert.match(readFileSync(file, "utf8"), /OUTFIT_TEXTURES\[/, file);
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

test("a saved outfit that is not in the list reads as none, and every real outfit reads back as itself", () => {
  for (const outfit of ['"crown"', '"Visor"', '"constructor"', '""', "7", "null", '["visor"]']) {
    assert.equal(parsePrefs(`{"v":2,"outfit":${outfit}}`).outfit, null, `outfit ${outfit}`);
  }
  for (const id of OUTFITS) assert.equal(parsePrefs(JSON.stringify({ ...DEFAULT_PREFS, outfit: id })).outfit, id);
});
