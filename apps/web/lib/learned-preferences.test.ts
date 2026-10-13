import assert from "node:assert/strict";
import { test } from "node:test";
import { COACH_MODES, EXPLAIN_LEVELS } from "@studigo/learning";
import { DEFAULT_COACH_PREFERENCES } from "./coach-preferences";
import { DEFAULT_LEARN_PREFERENCES, LEARN_MODES } from "./learn-preferences";
import { describeStoredPreferences } from "./learned-preferences";

const none = { coach: undefined, learn: undefined, explainLevel: undefined };
const legacyDefaultRow = { style: "default", tradition: "tradition-default", practice: "adaptive" };

test("each stored non-default value maps to its sentence, where it applies and who chose it", () => {
  assert.deepEqual(describeStoredPreferences({ ...none, explainLevel: "simpler" }), [{
    id: "explanation-level", title: "Explanation level",
    sentence: "Explanations use plain words, short sentences and everyday examples.",
    applies: "Used by Coach and Learn in this room.", origin: "You chose this."
  }]);
  assert.equal(describeStoredPreferences({ ...none, explainLevel: "deeper" })[0].sentence,
    "Explanations use the subject's own terms and go further into how ideas connect.");
  assert.equal(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, coach_mode: "show" } })[0].sentence,
    "Coach explains it first, shows an example, then lets you try.");
  assert.equal(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, coach_mode: "challenge" } })[0].sentence,
    "Coach starts with less help and asks you to use what you know.");
  assert.equal(describeStoredPreferences({ ...none, learn: { mode: "overview" } })[0].sentence,
    "Learn starts with the main idea, then the key facts.");
  assert.deepEqual(describeStoredPreferences({ ...none, learn: { mode: "examples_first" } }).map((item) => [item.id, item.applies]),
    [["learn-mode", "Used by Learn in this room."]]);
});

test("every non-default value the product offers has a sentence", () => {
  const coachDefault = DEFAULT_COACH_PREFERENCES.coach_mode;
  for (const mode of COACH_MODES.filter((item) => item !== coachDefault)) {
    assert.equal(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, coach_mode: mode } }).length, 1, mode);
  }
  for (const mode of LEARN_MODES.filter((item) => item !== DEFAULT_LEARN_PREFERENCES.mode)) {
    assert.equal(describeStoredPreferences({ ...none, learn: { mode } }).length, 1, mode);
  }
  for (const level of EXPLAIN_LEVELS.filter((item) => item !== "standard")) {
    assert.equal(describeStoredPreferences({ ...none, explainLevel: level }).length, 1, level);
  }
});

test("a default is never described as learned", () => {
  assert.deepEqual(describeStoredPreferences({ coach: legacyDefaultRow, learn: DEFAULT_LEARN_PREFERENCES, explainLevel: "standard" }), []);
  assert.deepEqual(describeStoredPreferences({
    coach: { ...legacyDefaultRow, coach_mode: DEFAULT_COACH_PREFERENCES.coach_mode },
    learn: { mode: DEFAULT_LEARN_PREFERENCES.mode },
    explainLevel: "standard"
  }), []);
  assert.deepEqual(describeStoredPreferences(none), []);
});

test("an unknown or malformed stored value yields nothing", () => {
  for (const bad of [null, "show", 7, [], ["show"], {}, { coach_mode: "turbo" }, { coach_mode: null }, { coach_mode: "SHOW" },
    { style: "direct", coach_mode: "turbo" }, { style: "unheard-of" }]) {
    assert.deepEqual(describeStoredPreferences({ ...none, coach: bad }), [], JSON.stringify(bad));
  }
  for (const bad of [null, "overview", 7, [], {}, { mode: "fastest" }, { mode: null }, { mode: 5 }, { mode: "Overview" }, { mode: ["overview"] }]) {
    assert.deepEqual(describeStoredPreferences({ ...none, learn: bad }), [], JSON.stringify(bad));
  }
  for (const bad of [null, "expert", 5, "SIMPLER", " simpler", ["simpler"], {}]) {
    assert.deepEqual(describeStoredPreferences({ ...none, explainLevel: bad }), [], JSON.stringify(bad));
  }
});

test("a coach setting saved before Coach modes is described only by the mode it maps to", () => {
  assert.equal(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, style: "direct" } })[0].sentence,
    "Coach explains it first, shows an example, then lets you try.");
  assert.equal(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, style: "drill" } })[0].sentence,
    "Coach starts with less help and asks you to use what you know.");
  assert.deepEqual(describeStoredPreferences({ ...none, coach: { ...legacyDefaultRow, style: "socratic", tradition: "tradition-japanese" } }), []);
});

test("the copy describes the setting and carries no pressure, reward or label about the learner", () => {
  const all = describeStoredPreferences({
    coach: { ...legacyDefaultRow, coach_mode: "challenge" }, learn: { mode: "examples_first" }, explainLevel: "deeper"
  });
  assert.equal(all.length, 3);
  const banned = /streak|reward|points?\b|\blose\b|\blost\b|behind|grade|ability|learning style|struggl|weak|slow|miss(ed|ing)?\b|away/i;
  for (const item of all) {
    for (const text of [item.title, item.sentence, item.applies, item.origin]) assert.doesNotMatch(text, banned, text);
  }
});
