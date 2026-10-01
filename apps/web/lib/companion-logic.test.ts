import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPANION_EVENTS, DEFAULT_PREFS, JOB_MODES, LEAN_AFTER_MS, LINES, SLEEP_AFTER_MS, WINDOW,
  chooseDock, dirPose, dockFromDrop, idleStage, parsePrefs, reactionFor, readingPose, roomFor, spot,
  type Area, type Rect
} from "./companion-logic";

const here = dirname(fileURLToPath(import.meta.url));
const area = (inRow = false): Area => ({ left: 10, top: 100, right: 365, bottom: 700, inRow });
const under = (x: number, y: number): Rect => ({ left: x, top: y, right: x + WINDOW.w, bottom: y + WINDOW.h });

test("speech is off unless it was saved on", () => {
  assert.equal(DEFAULT_PREFS.speech, false);
  for (const raw of [null, undefined, "", "not json", "null", "[]", "{}", '{"speech":"yes"}', '{"speech":1}', '{"speech":"true"}']) {
    assert.equal(parsePrefs(raw).speech, false, `speech must stay off for ${String(raw)}`);
  }
  assert.equal(parsePrefs('{"speech":true}').speech, true);
});

test("saved preferences fall back field by field", () => {
  assert.deepEqual(parsePrefs('{"dock":"zz","tuck":false,"seated":true}'), { speech: false, seated: true, tuck: false, dock: "br" });
  assert.deepEqual(parsePrefs('{"dock":"tl"}'), { speech: false, seated: false, tuck: true, dock: "tl" });
});

test("he keeps the corner the learner chose when nothing is under it", () => {
  assert.equal(chooseDock("br", area(), [], false), "br");
  assert.equal(chooseDock("tl", area(), [{ left: 300, top: 600, right: 360, bottom: 690 }], false), "tl");
});

test("he never sits on a control: the other side first, then the top", () => {
  const a = area();
  const br = spot("br", a), bl = spot("bl", a), tr = spot("tr", a);
  assert.equal(chooseDock("br", a, [under(br.x, br.y)], false), "bl");
  assert.equal(chooseDock("br", a, [under(br.x, br.y), under(bl.x, bl.y)], false), "tr");
  assert.equal(chooseDock("br", a, [under(br.x, br.y), under(bl.x, bl.y), under(tr.x, tr.y)], false), "tl");
});

test("with every corner covered he stays where the learner put him", () => {
  const a = area();
  const all = (["br", "bl", "tr", "tl"] as const).map((dock) => { const at = spot(dock, a); return under(at.x, at.y); });
  assert.equal(chooseDock("bl", a, all, false), "bl");
});

test("he does not move when the page can scroll the control clear, or when he stands beside the message field", () => {
  const a = area();
  const br = spot("br", a);
  assert.equal(chooseDock("br", a, [under(br.x, br.y)], true), "br");
  assert.equal(chooseDock("br", area(true), [under(br.x, br.y)], false), "br");
});

test("a sliver of a control under him does not count as sitting on it", () => {
  const a = area();
  const br = spot("br", a);
  assert.equal(chooseDock("br", a, [{ left: br.x - 40, top: br.y + 100, right: br.x + 20, bottom: br.y + 130 }], false), "br");
});

test("dropping him picks the nearest corner", () => {
  const a = area();
  assert.equal(dockFromDrop(40, 150, a), "tl");
  assert.equal(dockFromDrop(340, 150, a), "tr");
  assert.equal(dockFromDrop(40, 650, a), "bl");
  assert.equal(dockFromDrop(340, 650, a), "br");
});

test("the page makes room on the side he is on, and only there", () => {
  assert.deepEqual(roomFor("br", area(true), 96), { right: 108, left: 0, thread: 32, page: 0 });
  assert.deepEqual(roomFor("bl", area(true), 96), { right: 0, left: 108, thread: 32, page: 0 });
  assert.deepEqual(roomFor("br", area(false), 0), { right: 0, left: 0, thread: 0, page: 104 });
  assert.deepEqual(roomFor("tr", area(false), 0), { right: 0, left: 0, thread: 0, page: 0 });
  assert.deepEqual(roomFor("tr", area(true), 96), { right: 0, left: 0, thread: 0, page: 0 });
});

test("gaze: close points read as looking at you, far points pick one of eight directions", () => {
  assert.equal(dirPose(10, 10), "center");
  assert.equal(dirPose(200, 0), "right");
  assert.equal(dirPose(-200, 0), "left");
  assert.equal(dirPose(0, -200), "up");
  assert.equal(dirPose(0, 200), "down");
  assert.equal(dirPose(200, 200), "down-right");
  assert.equal(dirPose(-200, -200), "up-left");
  assert.equal(readingPose(-200, 0), "down-left");
  assert.equal(readingPose(5, 5), "down");
});

test("reactions: a miss is supportive, a right answer celebrates, the third in a row is called out", () => {
  assert.equal(reactionFor("wrong", 0).pose, "support");
  assert.equal(reactionFor("blindspot", 0).lines, LINES.blindspot);
  assert.equal(reactionFor("correct", 1).pose, "celebrate");
  assert.equal(reactionFor("correct", 3).lines, LINES.streak);
  assert.equal(reactionFor("setDone", 0).always, true);
  for (const event of COMPANION_EVENTS) assert.ok(reactionFor(event, 1).ms > 0);
});

test("his lines follow the plain-punctuation rule", () => {
  const all = Object.values(LINES).flat();
  assert.ok(all.length > 0);
  for (const line of all) {
    assert.ok(!/[—–…]/.test(line), `no dashes or ellipsis characters: ${line}`);
    assert.ok(line.length <= 40, `short enough to read at a glance: ${line}`);
  }
});

test("idle: he leans after a long pause and dozes after a much longer one", () => {
  assert.equal(idleStage(0), "awake");
  assert.equal(idleStage(LEAN_AFTER_MS + 1), "lean");
  assert.equal(idleStage(SLEEP_AFTER_MS + 1), "sleep");
  assert.ok(LEAN_AFTER_MS >= 45_000, "a learner reading an answer is not nagged");
});

test("he has a job on the practice pages only", () => {
  assert.deepEqual([...JOB_MODES].sort(), ["cards", "coach", "quiz", "test"]);
});

test("he never changes mastery: nothing in the companion talks to the network or to practice state", () => {
  const files = ["companion-logic.ts", "companion-prefs.ts", "../components/companion/engine.ts", "../components/companion/stage.tsx", "../components/companion/companion.tsx", "../components/companion/figure.tsx"];
  for (const file of files) {
    const source = readFileSync(join(here, file), "utf8");
    for (const banned of ["fetch(", "XMLHttpRequest", "sendBeacon", "supabase", "/api/", "mastery_score", "quiz_attempts", "flashcards"]) {
      assert.ok(!source.includes(banned), `${file} must not contain ${banned}`);
    }
  }
});
