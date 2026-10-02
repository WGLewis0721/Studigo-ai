import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSystemPrompt, STUDIGO_SYSTEM_PROMPT } from "@studigo/ai";
import {
  COACH_MODE_OPTIONS,
  DEFAULT_COACH_PREFERENCES,
  compileCoachPreferences,
  describeCoaching,
  directivesForTurn,
  type CoachPreferences
} from "./coach-preferences";
import { formatDirectives } from "./directive-format";

const LEVELS = ["simpler", "standard", "deeper"] as const;
const QUESTIONS = [
  "What is the difference between an instinct and a learned behavior?",
  "Give me 3 questions on inherited traits",
  "i dont get photosynthsis",
  "2"
];
const ALL: CoachPreferences[] = COACH_MODE_OPTIONS.flatMap(mode =>
  LEVELS.map(explainLevel => ({ ...DEFAULT_COACH_PREFERENCES, coach_mode: mode.id, explainLevel }))
);

const prompt = (mode: "coach" | "ask", prefs: CoachPreferences, question: string) => buildSystemPrompt({
  format: mode === "ask" ? "outline" : undefined,
  instructions: formatDirectives(directivesForTurn(mode, prefs, [
    { name: "Current topic", instruction: "The learner is currently studying \"Inherited traits\"." },
    { name: "Coach mode", instruction: "DRAFT MODE THAT WAS NEVER APPLIED" }
  ]))
}) + `\n\nQUESTION: ${question}`;

test("the V3 matrix covers three Coach modes x three explanation levels", () => {
  assert.equal(ALL.length, 9);
});

test("Coach: every mode sends one saved mode, one global level, and no browser draft", () => {
  for (const prefs of ALL) {
    for (const question of QUESTIONS) {
      const text = prompt("coach", prefs, question);
      const id = JSON.stringify({ mode: prefs.coach_mode, level: prefs.explainLevel });
      assert.ok(text.startsWith(STUDIGO_SYSTEM_PROMPT), `grounding rules first: ${id}`);
      assert.ok(text.includes(`mode=${prefs.coach_mode}`), `mode present: ${id}`);
      assert.ok(!text.includes("DRAFT MODE"), `draft ignored: ${id}`);
      assert.equal((text.match(/\[COACH MODE\]/g) ?? []).length, 1, `one mode: ${id}`);
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1, `one level: ${id}`);
      assert.match(text, /keep the same source facts, concepts, reasoning demand and grading standard/);
    }
  }
});

test("Learn gets only room explanation level and topic, never Coach mode or internal strategy", () => {
  for (const prefs of ALL) {
    for (const question of QUESTIONS) {
      const text = prompt("ask", prefs, question);
      assert.ok(!text.includes("[COACH MODE]"));
      assert.ok(!text.includes("[INTERNAL COACHING STRATEGY]"));
      assert.ok(!text.includes("DRAFT MODE"));
      assert.match(text, /\[CURRENT TOPIC\]/);
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1);
      assert.match(text, /scannable outline/, "Learn keeps the outline layout");
    }
  }
});

test("the explanation level changes wording guidance without changing the mode contract", () => {
  for (const mode of COACH_MODE_OPTIONS) {
    const compiled = LEVELS.map(explainLevel => compileCoachPreferences({ ...DEFAULT_COACH_PREFERENCES, coach_mode: mode.id, explainLevel }));
    assert.equal(new Set(compiled.map(item => item.directives.find(d => d.name === "Coach mode")!.instruction)).size, 1);
    assert.equal(new Set(compiled.map(item => item.directives.find(d => d.name === "Explanation level")!.instruction)).size, 3);
  }
});

test("the three learner-facing modes have distinct labels, copy, prompts and intended support bias", () => {
  const labels = new Set<string>();
  const expects = new Set<string>();
  const prompts = new Set<string>();
  for (const option of COACH_MODE_OPTIONS) {
    const prefs = { ...DEFAULT_COACH_PREFERENCES, coach_mode: option.id };
    labels.add(describeCoaching(prefs).label);
    expects.add(describeCoaching(prefs).expect);
    prompts.add(prompt("coach", prefs, QUESTIONS[0]));
  }
  assert.equal(labels.size, 3);
  assert.equal(expects.size, 3);
  assert.equal(prompts.size, 3);
});

test("the learner question never enters the system prompt, so mode settings cannot change retrieval", () => {
  for (const prefs of ALL) {
    const system = buildSystemPrompt({ instructions: formatDirectives(directivesForTurn("coach", prefs)) });
    for (const question of QUESTIONS.filter(q => q.length > 3)) assert.ok(!system.includes(question));
  }
});
