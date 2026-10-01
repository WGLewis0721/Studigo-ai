import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  PRACTICE_PROTOCOLS, REFERENCE_WORD_BUDGET, STYLES, TRADITIONS, compileCoachPreferences, countWords,
  directivesForTurn, levelReference, teachingReference, type CoachPreferences
} from "./coach-preferences";
import { projectTeachingReferences, type TeachingReferences } from "./teaching-reference-projection";
import { readKnowledgeFiles } from "../scripts/generate-teaching-references";

const LEVELS = ["simpler", "standard", "deeper"] as const;
const ALL: CoachPreferences[] = STYLES.flatMap(s => TRADITIONS.flatMap(t => PRACTICE_PROTOCOLS.flatMap(p => LEVELS.map(l => ({ style: s.id, tradition: t.id, practice: p.id, explainLevel: l })))));
const committed = JSON.parse(readFileSync(join(__dirname, "generated", "teaching-references.json"), "utf8")) as TeachingReferences;

test("the knowledge base has tripled: 14 option records plus 29 reference and level records", () => {
  const files = readKnowledgeFiles();
  assert.equal(files.length, 43);
  assert.equal(Object.keys(committed.exemplars).length, 26);
  assert.equal(Object.keys(committed.levels).length, 3);
  for (const s of STYLES) for (const l of LEVELS) assert.ok(committed.exemplars[`style:${s.id}:${l}`], `${s.id}:${l}`);
  for (const t of TRADITIONS) assert.ok(committed.exemplars[`tradition:${t.id}`], t.id);
  for (const p of PRACTICE_PROTOCOLS) assert.ok(committed.exemplars[`practice:${p.id}`], p.id);
});

test("the bundled projection matches the knowledge base (run pnpm generate:references)", () => {
  assert.deepEqual(projectTeachingReferences(readKnowledgeFiles()), committed);
});

test("no reference text uses an em dash", () => {
  assert.ok(!JSON.stringify(committed).includes("—"));
});

test("every combination gets both the style and tradition records and the matching reference reply", () => {
  for (const prefs of ALL) {
    const ref = teachingReference(prefs);
    assert.ok(ref.includes(committed.styles[prefs.style].rules[0]), `style rules: ${prefs.style}`);
    assert.ok(ref.includes(committed.traditions[prefs.tradition].rules[0]), `tradition rules: ${prefs.tradition}`);
    assert.ok(ref.includes(committed.practice[prefs.practice].rules[0]), `practice: ${prefs.practice}`);
    assert.ok(ref.includes(committed.exemplars[`style:${prefs.style}:${prefs.explainLevel}`].reply), "matching model reply");
    for (const other of LEVELS) if (other !== prefs.explainLevel) {
      assert.ok(!ref.includes(committed.exemplars[`style:${prefs.style}:${other}`].reply), "no other level's reply");
    }
    assert.match(ref, /never their facts/);
  }
});

test("speed: the added teaching text stays under a fixed budget for every combination", () => {
  let worst = 0;
  for (const prefs of ALL) worst = Math.max(worst, countWords(teachingReference(prefs)));
  assert.ok(worst <= REFERENCE_WORD_BUDGET.coach, `largest Coach reference is ${worst} words`);
  for (const level of LEVELS) assert.ok(countWords(levelReference(level)) <= REFERENCE_WORD_BUDGET.level, level);
});

test("Learn gets the level rules and sample, but no Coach reference or model reply", () => {
  for (const prefs of ALL) {
    const learn = directivesForTurn("ask", prefs).map(d => d.instruction).join("\n");
    assert.ok(learn.includes(committed.levels[prefs.explainLevel].sample));
    assert.ok(!learn.includes("Model reply"));
    assert.ok(!directivesForTurn("ask", prefs).some(d => d.name === "Teaching reference"));
    assert.ok(compileCoachPreferences(prefs).directives.some(d => d.name === "Teaching reference"));
  }
});
