import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const coachPanel = readFileSync(join(here, "../components/room/coach-panel.tsx"), "utf8");
const routeSelection = readFileSync(join(here, "coach-route-selection.ts"), "utf8");
const coachPreferences = readFileSync(join(here, "coach-preferences.ts"), "utf8");
const learnPreferences = readFileSync(join(here, "learn-preferences.ts"), "utf8");
const roomSettings = readFileSync(join(here, "../components/room/room-settings.tsx"), "utf8");

test("V3 Coach setup exposes only the three simple modes", () => {
  assert.match(coachPanel, /COACH_MODE_OPTIONS\.map/);
  assert.ok(!coachPanel.includes(">Learning tradition<"));
  assert.ok(!coachPanel.includes(">Practice recipe<"));
  assert.ok(!coachPanel.includes("STYLES.map"));
  assert.ok(!coachPanel.includes("TRADITIONS.map"));
  assert.ok(!coachPanel.includes("PRACTICE_PROTOCOLS.map"));
});

test("Learn exposes three presentation preferences that do not own adaptation", () => {
  assert.match(coachPanel, /LEARN_MODE_OPTIONS\.map/);
  assert.match(learnPreferences, /Big picture/);
  assert.match(learnPreferences, /Step by step/);
  assert.match(learnPreferences, /Examples first/);
  assert.match(learnPreferences, /never changes source scope, factual truth, reasoning demand, grading, mastery, challenge progression, or the adaptive game director/);
});

test("explanation level appears only in Study Room settings, not Coach or Learn setup", () => {
  assert.match(roomSettings, /Explanation level/);
  assert.match(roomSettings, /Coach and Learn, whole Study Room/);
  assert.ok(!coachPanel.includes("COACH EXPLANATION LEVEL"));
  assert.ok(!coachPanel.includes("LEARN EXPLANATION LEVEL"));
  assert.ok(!coachPanel.includes("Apply this explanation level to both Coach and Learn"));
  assert.ok(!coachPanel.includes("EXPLAIN_OPTIONS"));
});

test("Coach Learn stays the persistent primary switch", () => {
  const switcher = '<div className="chatModes" role="group" aria-label="How Studigo helps">';
  assert.equal(coachPanel.split(switcher).length - 1, 1, "one primary Coach/Learn switcher");
  assert.match(coachPanel, /aria-pressed=\{chatMode === "coach"\}/);
  assert.match(coachPanel, /aria-pressed=\{chatMode === "learn"\}/);
});

test("Topics is the integrated scope control, with no standalone green topic switcher", () => {
  assert.match(coachPanel, /aria-label="Coach sections and topic scope"/);
  assert.match(coachPanel, /aria-haspopup="dialog"/);
  assert.match(coachPanel, /activeTopicIds\.length\}\/\{topics\.length/);
  assert.ok(!coachPanel.includes('className="chatTopic"'), "standalone topic pill is removed");
  assert.ok(!coachPanel.includes('className="chatTopic chatTopicStatic"'), "standalone static topic pill is removed");
});

test("topic picker supports independent multi-select scopes for Coach and Learn", () => {
  assert.match(coachPanel, /type="checkbox"/);
  assert.match(coachPanel, />Select all</);
  assert.match(coachPanel, />Clear</);
  assert.match(coachPanel, /"Apply to Coach"/);
  assert.match(coachPanel, /"Apply to Learn"/);
  assert.match(coachPanel, /const \[coachTopicIds, setCoachTopicIds\]/);
  assert.match(coachPanel, /const \[learnTopicIds, setLearnTopicIds\]/);
  assert.match(coachPanel, /replying === "coach" \? coachTopicIds : learnTopicIds/);
  assert.ok(!coachPanel.includes("setCoachTopicIds(ordered);\n      setLearnTopicIds(ordered)"));
  assert.ok(!coachPanel.includes("setLearnTopicIds(ordered);\n      setCoachTopicIds(ordered)"));
});

test("Coach and Learn have independent Apply paths", () => {
  assert.match(coachPanel, /"Apply Coach"/);
  assert.match(coachPanel, /"Apply Learn"/);
  assert.match(coachPanel, /coaching\.apply\(draft\)/);
  assert.match(coachPanel, /coaching\.applyLearn\(learnDraft\)/);
  assert.ok(!coachPanel.includes("applyToBoth"));
});

test("Apply resets only the selected response surface", () => {
  assert.match(coachPanel, /if \(ok\) conversationId\.current = null/);
  assert.match(coachPanel, /if \(ok\) askConversationId\.current = null/);
});

test("persistent Challenge me and one-shot harder question use different learner copy", () => {
  assert.match(coachPreferences, /name: COACH_MODE_LABELS\.challenge/);
  assert.match(routeSelection, /Try a harder question/);
  assert.ok(!routeSelection.includes('{ label: "Challenge me", text: "Challenge me" }'));
});
