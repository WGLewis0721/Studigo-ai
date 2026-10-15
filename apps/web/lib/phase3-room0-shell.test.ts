import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const workspace = readFileSync(join(here, "../components/room/workspace.tsx"), "utf8");
const coach = readFileSync(join(here, "../components/room/coach-panel.tsx"), "utf8");
const preview = readFileSync(join(here, "../components/phase3/mission-preview.tsx"), "utf8");
const css = readFileSync(join(here, "../components/phase3/phase3.css"), "utf8");

test("Study Room keeps five groups and the existing deep-link aliases", () => {
  for (const name of ["Coach", "Practice", "Progress", "Plan", "Materials"]) {
    assert.match(workspace, new RegExp(`name:"${name}"`));
  }
  assert.match(workspace, /initialMode === "ask" \|\| initialMode === "learn"/);
  assert.match(workspace, /import \{ MaterialsPanel \} from "\.\/materials-panel"/);
  assert.equal(workspace.includes("ModeSwitch"), false);
  assert.equal(workspace.includes("phase3/ui"), false);
});

test("Coach and Learn remain the production mode switch", () => {
  assert.match(coach, /aria-pressed=\{chatMode === "coach"\}/);
  assert.match(coach, /aria-pressed=\{chatMode === "learn"\}/);
  assert.match(coach, /className="chatModes"/);
});

test("the Phase 3 fixture keeps the wordmark, mode switch, and restored stylesheet", () => {
  assert.match(preview, /src="\/brand\/studigo-wordmark\.svg"/);
  assert.match(preview, /<ModeSwitch /);
  assert.match(css, /\.p3LearningGrid \{/);
  assert.match(css, /\.p3Stage \{/);
  assert.match(css, /\.p3Key \{/);
  assert.match(css, /\.p3Ticket \{/);
  assert.match(css, /\.p3Choices \{/);
  assert.match(css, /\.p3SourceBackdrop,/);
  assert.match(css, /\.p3Voice \{/);
  assert.match(css, /\.p3System \{/);
  assert.match(css, /\.p3Recovery \{/);
  assert.match(css, /@media\(max-width:1000px\)/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.p3Brand \{ display:flex; flex-direction:column;/);
  assert.match(css, /\.p3Brand__logo \{ height:36px;/);
  assert.match(css, /\.p3Modes__item \{[^}]*min-height:48px/);
  assert.equal(css.includes("$(cat"), false);
});
