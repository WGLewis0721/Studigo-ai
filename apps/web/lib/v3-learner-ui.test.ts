import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const coachPanel = readFileSync(join(here, "../components/room/coach-panel.tsx"), "utf8");
const routeSelection = readFileSync(join(here, "coach-route-selection.ts"), "utf8");
const preferences = readFileSync(join(here, "coach-preferences.ts"), "utf8");
const roomSettings = readFileSync(join(here, "../components/room/room-settings.tsx"), "utf8");

test("V3 Coach setup exposes only the three simple modes", () => {
  assert.match(coachPanel, /COACH_MODE_OPTIONS\.map/);
  assert.ok(!coachPanel.includes(">Learning tradition<"));
  assert.ok(!coachPanel.includes(">Practice recipe<"));
  assert.ok(!coachPanel.includes("STYLES.map"));
  assert.ok(!coachPanel.includes("TRADITIONS.map"));
  assert.ok(!coachPanel.includes("PRACTICE_PROTOCOLS.map"));
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
  assert.match(coachPanel, /selectedTopicIds\.length\}\/\{topics\.length/);
  assert.ok(!coachPanel.includes('className="chatTopic"'), "standalone topic pill is removed");
  assert.ok(!coachPanel.includes('className="chatTopic chatTopicStatic"'), "standalone static topic pill is removed");
});

test("topic picker supports multi-select, Select all, Clear and explicit Apply", () => {
  assert.match(coachPanel, /type="checkbox"/);
  assert.match(coachPanel, />Select all</);
  assert.match(coachPanel, />Clear</);
  assert.match(coachPanel, />Apply topics</);
  assert.match(coachPanel, /setTopicDraftIds/);
  assert.match(coachPanel, /setSelectedTopicIds/);
});

test("Coach and Learn have independent Apply paths with an explicit apply-to-both control", () => {
  assert.match(coachPanel, />Apply Coach</);
  assert.match(coachPanel, />Apply Learn</);
  assert.match(coachPanel, /Apply this explanation level to both Coach and Learn/);
  assert.match(coachPanel, /coaching\.apply\(draft, coachApplyBoth\)/);
  assert.match(coachPanel, /coaching\.applyLearn\(learnDraft, learnApplyBoth\)/);
  assert.match(roomSettings, /apply to both Coach and Learn/);
});

test("Apply resets only the selected response surface unless apply-to-both is enabled", () => {
  assert.match(coachPanel, /conversationId\.current = null/);
  assert.match(coachPanel, /if \(coachApplyBoth\) askConversationId\.current = null/);
  assert.match(coachPanel, /askConversationId\.current = null/);
  assert.match(coachPanel, /if \(learnApplyBoth\) conversationId\.current = null/);
});

test("persistent Challenge me and one-shot harder question use different learner copy", () => {
  assert.match(preferences, /name: COACH_MODE_LABELS\.challenge/);
  assert.match(routeSelection, /Try a harder question/);
  assert.ok(!routeSelection.includes('{ label: "Challenge me", text: "Challenge me" }'));
});
