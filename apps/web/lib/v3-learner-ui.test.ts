import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const coachPanel = readFileSync(join(here, "../components/room/coach-panel.tsx"), "utf8");
const routeSelection = readFileSync(join(here, "coach-route-selection.ts"), "utf8");

test("V3 Coach setup exposes only the three simple modes", () => {
  assert.match(coachPanel, /COACH_MODE_OPTIONS\.map/);
  assert.ok(!coachPanel.includes(">Learning tradition<"));
  assert.ok(!coachPanel.includes(">Practice recipe<"));
  assert.ok(!coachPanel.includes("STYLES.map"));
  assert.ok(!coachPanel.includes("TRADITIONS.map"));
  assert.ok(!coachPanel.includes("PRACTICE_PROTOCOLS.map"));
});

test("Coach Learn is the persistent primary switch and Chat Topics stays secondary", () => {
  const switcher = '<div className="chatModes" role="group" aria-label="How Studigo helps">';
  assert.equal(coachPanel.split(switcher).length - 1, 1, "one primary Coach/Learn switcher");
  assert.match(coachPanel, /<div className="coachTabs" role="group" aria-label="Coach sections">/);
  assert.ok(!coachPanel.includes('{view === "chat" ? (\n          <div className="chatModes"'), "Topics must not replace the primary switcher");
  assert.match(coachPanel, /aria-pressed=\{chatMode === "coach"\}/);
  assert.match(coachPanel, /aria-pressed=\{chatMode === "learn"\}/);
  assert.match(coachPanel, /aria-pressed=\{view === "chat"\}/);
  assert.match(coachPanel, /aria-pressed=\{view === "topics"\}/);
});

test("persistent Challenge me and one-shot harder question use different learner copy", () => {
  assert.match(coachPanel, /Challenge me/);
  assert.match(routeSelection, /Try a harder question/);
  assert.ok(!routeSelection.includes('{ label: "Challenge me", text: "Challenge me" }'));
});
