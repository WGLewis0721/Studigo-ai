import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSystemPrompt, STUDIGO_SYSTEM_PROMPT } from "@studigo/ai";
import {
  PRACTICE_PROTOCOLS, STYLES, TRADITIONS, compileCoachPreferences, describeCoaching, directivesForTurn,
  type CoachPreferences
} from "./coach-preferences";
import { selectLearningRoute } from "./coach-route-selection";
import { formatDirectives } from "./directive-format";

// Every combination of the four settings (6 styles x 5 traditions x 3 practice
// recipes x 3 explanation levels = 270), each asked the same sample questions on
// both the Coach and Learn paths. This checks the exact system prompt the model
// receives. It cannot judge the model's prose; scripts/eval-coach-styles.ts does
// that against a real model.
const LEVELS = ["simpler", "standard", "deeper"] as const;
const QUESTIONS = [
  "What is the difference between an instinct and a learned behavior?",
  "Give me 3 questions on inherited traits",
  "i dont get photosynthsis",
  "2"
];
const ALL: CoachPreferences[] = STYLES.flatMap(style => TRADITIONS.flatMap(tradition => PRACTICE_PROTOCOLS.flatMap(practice =>
  LEVELS.map(explainLevel => ({ style: style.id, tradition: tradition.id, practice: practice.id, explainLevel })))));

const prompt = (mode: "coach" | "ask", prefs: CoachPreferences, question: string) => buildSystemPrompt({
  format: mode === "ask" ? "outline" : undefined,
  instructions: formatDirectives(directivesForTurn(mode, prefs, [
    { name: "Current topic", instruction: "The learner is currently studying \"Inherited traits\"." },
    // A stale draft from the browser must never reach the model.
    { name: "Coaching style", instruction: "DRAFT STYLE THAT WAS NEVER APPLIED" }
  ]))
}) + `\n\nQUESTION: ${question}`;

test("the matrix covers all 270 setting combinations", () => {
  assert.equal(ALL.length, 270);
});

test("Coach: every combination sends exactly its own style, tradition, practice and level", () => {
  for (const prefs of ALL) {
    const style = STYLES.find(o => o.id === prefs.style)!;
    const tradition = TRADITIONS.find(o => o.id === prefs.tradition)!;
    const practice = PRACTICE_PROTOCOLS.find(o => o.id === prefs.practice)!;
    for (const question of QUESTIONS) {
      const text = prompt("coach", prefs, question);
      const id = JSON.stringify(prefs);
      assert.ok(text.startsWith(STUDIGO_SYSTEM_PROMPT), `grounding rules first: ${id}`);
      assert.ok(text.includes(style.instruction), `style: ${id}`);
      assert.ok(text.includes(tradition.instruction), `tradition: ${id}`);
      assert.ok(text.includes(practice.instruction), `practice: ${id}`);
      assert.ok(text.includes(style.expect), `style made visible: ${id}`);
      for (const other of STYLES) if (other.id !== style.id) assert.ok(!text.includes(other.instruction), `no second style: ${id}`);
      for (const other of TRADITIONS) if (other.id !== tradition.id) assert.ok(!text.includes(other.instruction), `no second tradition: ${id}`);
      assert.ok(!text.includes("DRAFT STYLE"), `draft ignored: ${id}`);
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1, `one level: ${id}`);
      assert.match(text, /keep the same source facts, concepts, reasoning demand and grading standard/);
      assert.match(text, /only the wording/);
    }
  }
});

test("Learn: every combination sends only the room level and topic, never the Coach style", () => {
  for (const prefs of ALL) {
    for (const question of QUESTIONS) {
      const text = prompt("ask", prefs, question);
      for (const option of [...STYLES, ...TRADITIONS, ...PRACTICE_PROTOCOLS]) assert.ok(!text.includes(option.instruction), `${option.id} leaked into Learn`);
      assert.ok(!text.includes("DRAFT STYLE"));
      assert.match(text, /\[CURRENT TOPIC\]/);
      assert.equal((text.match(/\[EXPLANATION LEVEL\]/g) ?? []).length, 1);
      assert.match(text, /scannable outline/, "Learn keeps the outline layout");
    }
  }
});

test("the explanation level changes only the level line; everything else is identical", () => {
  for (const prefs of ALL.filter(p => p.explainLevel === "standard")) {
    const lines = (level: typeof LEVELS[number]) => compileCoachPreferences({ ...prefs, explainLevel: level }).directives.filter(d => d.name !== "Explanation level");
    assert.deepEqual(lines("simpler"), lines("deeper"));
    const levels = LEVELS.map(level => compileCoachPreferences({ ...prefs, explainLevel: level }).directives.find(d => d.name === "Explanation level")!.instruction);
    assert.equal(new Set(levels).size, 3);
  }
});

test("each style x tradition pair produces a distinct prompt, label and teaching route", () => {
  const prompts = new Set<string>();
  const labels = new Set<string>();
  for (const prefs of ALL.filter(p => p.practice === "adaptive" && p.explainLevel === "standard")) {
    prompts.add(prompt("coach", prefs, QUESTIONS[0]));
    labels.add(describeCoaching(prefs).label);
    assert.equal(compileCoachPreferences(prefs).route, selectLearningRoute(prefs.style, prefs.tradition));
  }
  assert.equal(prompts.size, STYLES.length * TRADITIONS.length);
  assert.equal(labels.size, STYLES.length * TRADITIONS.length);
});

test("the learner's question never enters the system prompt, so settings cannot change retrieval", () => {
  for (const prefs of ALL) {
    const system = buildSystemPrompt({ instructions: formatDirectives(directivesForTurn("coach", prefs)) });
    for (const question of QUESTIONS.filter(q => q.length > 3)) assert.ok(!system.includes(question));
  }
});

test("the live eval's scorer tells styles and levels apart", async () => {
  const { styleChecks, readability } = await import("../scripts/eval-coach-styles");
  const socratic = "What does a spider know at birth? Why might a dog need training?";
  const drill = "1. Name an instinct.\n2. Name a learned behavior.\n3. Which is web building?";
  assert.ok(styleChecks("socratic", socratic).every(([, ok]) => ok));
  assert.ok(!styleChecks("socratic", "Instincts are inborn [1].").every(([, ok]) => ok));
  assert.ok(styleChecks("drill", drill).every(([, ok]) => ok));
  assert.ok(readability("A cat is born to hunt. A dog learns to sit.").longWordShare
    < readability("Instinctive behaviors are genetically predetermined, whereas learned behaviors require environmental reinforcement.").longWordShare);
});
