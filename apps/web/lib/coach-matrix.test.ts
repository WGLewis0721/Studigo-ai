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
import { LEARN_MODE_OPTIONS, type LearnPreferences } from "./learn-preferences";
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

const prompt = (
  mode: "coach" | "ask",
  prefs: CoachPreferences,
  question: string,
  learn: LearnPreferences = { mode: "step_by_step" }
) => buildSystemPrompt({
  format: mode === "ask" ? "outline" : undefined,
  instructions: formatDirectives(directivesForTurn(mode, prefs, [
    { name: "Current topics", instruction: "The learner is currently studying \"Inherited traits\"." },
    { name: "Coach mode", instruction: "DRAFT MODE THAT WAS NEVER APPLIED" }
  ], learn))
}) + `\n\nQUESTION: ${question}`;

test("the Coach matrix covers three Coach modes x three global explanation levels", () => {
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
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1, `one global level: ${id}`);
    }
  }
});

test("Learn gets its own presentation mode plus the same global explanation level, never Coach strategy", () => {
  for (const prefs of ALL) {
    for (const learn of LEARN_MODE_OPTIONS) {
      const text = prompt("ask", prefs, QUESTIONS[0], { mode: learn.id });
      assert.ok(!text.includes("[COACH MODE]"));
      assert.ok(!text.includes("[INTERNAL COACHING STRATEGY]"));
      assert.ok(!text.includes("DRAFT MODE"));
      assert.match(text, /\[CURRENT TOPICS\]/);
      assert.equal((text.match(/\[LEARN MODE\]/g) ?? []).length, 1);
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1);
      assert.ok(text.includes(`mode=${learn.id}`));
      assert.match(text, /never changes source scope, factual truth, reasoning demand, grading, mastery, challenge progression, or the adaptive game director/);
    }
  }
});

test("global explanation level changes wording guidance without changing Coach or Learn mode", () => {
  for (const mode of COACH_MODE_OPTIONS) {
    const compiled = LEVELS.map(explainLevel => compileCoachPreferences({ ...DEFAULT_COACH_PREFERENCES, coach_mode: mode.id, explainLevel }));
    assert.equal(new Set(compiled.map(item => item.directives.find(d => d.name === "Coach mode")!.instruction)).size, 1);
    assert.equal(new Set(compiled.map(item => item.directives.find(d => d.name === "Explanation level")!.instruction)).size, 3);
  }
  for (const learn of LEARN_MODE_OPTIONS) {
    const texts = LEVELS.map(level => prompt("ask", { ...DEFAULT_COACH_PREFERENCES, explainLevel: level }, QUESTIONS[0], { mode: learn.id }));
    assert.equal(new Set(texts.map(text => text.match(/mode=(overview|step_by_step|examples_first)/)?.[0])).size, 1);
    assert.equal(new Set(texts).size, 3);
  }
});

test("the three learner-facing Coach modes remain distinct", () => {
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

test("the learner question never enters the system prompt, so preferences cannot change retrieval", () => {
  for (const prefs of ALL) {
    const system = buildSystemPrompt({ instructions: formatDirectives(directivesForTurn("coach", prefs)) });
    for (const question of QUESTIONS.filter(q => q.length > 3)) assert.ok(!system.includes(question));
  }
});
