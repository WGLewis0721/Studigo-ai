import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPANION_EVENTS, DEFAULT_PREFS, LEAN_AFTER_MS, LINES, MAX_SCALE, MIN_SCALE, SLEEP_AFTER_MS, WINDOW,
  chooseDock, clampScale, dirPose, dockFromDrop, idleStage, parsePrefs, reactionFor, readingPose, roomFor, scaleFromDrag, sizeAt, spot,
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
  assert.deepEqual(parsePrefs('{"dock":"zz","tuck":false,"seated":true}'), { speech: false, seated: true, tuck: false, dock: "br", scale: 1 });
  assert.deepEqual(parsePrefs('{"dock":"tl"}'), { speech: false, seated: false, tuck: true, dock: "tl", scale: 1 });
});

test("his size is saved for the device, kept within bounds, and a bad value means the default", () => {
  assert.equal(parsePrefs(null, "1.5").scale, 1.5);
  assert.equal(parsePrefs('{"speech":true}', "2").scale, 2);
  assert.equal(parsePrefs('{"speech":true}', "2").speech, true);
  assert.equal(parsePrefs("not json", "1.25").scale, 1.25);
  assert.equal(parsePrefs(null, "9").scale, MAX_SCALE);
  assert.equal(parsePrefs(null, "0.1").scale, MIN_SCALE);
  for (const bad of [null, undefined, "", "big", "NaN", "-2", "0"]) assert.equal(parsePrefs(null, bad).scale, 1, `default size for ${String(bad)}`);
  assert.equal(clampScale(1.2345), 1.23);
  assert.deepEqual(sizeAt(2), { w: WINDOW.w * 2, h: WINDOW.h * 2 });
});

test("resizing keeps his docked corner still and puts the opposite corner under the pointer", () => {
  // Docked bottom right with that corner at (800, 600): the pointer is where the top-left corner should be.
  assert.equal(scaleFromDrag(800, 600, 800 - WINDOW.w, 600 - WINDOW.h), 1);
  assert.equal(scaleFromDrag(800, 600, 800 - WINDOW.w * 2, 600 - WINDOW.h * 2), 2);
  assert.equal(scaleFromDrag(800, 600, 800 - WINDOW.w * 1.5, 600 - WINDOW.h * 1.5), 1.5);
  assert.equal(scaleFromDrag(800, 600, 100, 100), MAX_SCALE, "never larger than the limit");
  assert.equal(scaleFromDrag(800, 600, 795, 598), MIN_SCALE, "never smaller than the limit");
  // Docked bottom left: the same distances on the other side give the same size.
  assert.equal(scaleFromDrag(200, 600, 200 + WINDOW.w * 2, 600 - WINDOW.h * 2), 2);
});

test("at a larger size he still avoids controls, and the page makes more room", () => {
  const big = sizeAt(2), a: Area = { left: 10, top: 100, right: 1000, bottom: 700, inRow: false };
  const at = spot("br", a, big);
  assert.deepEqual(at, { x: a.right - big.w, y: a.bottom - big.h });
  const underBig = { left: at.x, top: at.y, right: at.x + big.w, bottom: at.y + big.h };
  assert.equal(chooseDock("br", a, [underBig], false, big), "bl");
  // A control that is clear of him at the default size is under him at twice the size.
  const nearby = {
    left: a.right - big.w + 10,
    top: a.bottom - big.h + 10,
    right: a.right - WINDOW.w - 10,
    bottom: a.bottom - WINDOW.h - 10
  };
  assert.equal(chooseDock("br", a, [nearby], false), "br");
  assert.equal(chooseDock("br", a, [nearby], false, big), "bl");
  assert.deepEqual(roomFor("br", area(true), 96, big), { right: big.w + 8, left: 0, thread: big.h - 96 + 8, page: 0 });
  assert.deepEqual(roomFor("br", area(false), 0, big), { right: 0, left: 0, thread: 0, page: big.h - 16 });
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
  assert.deepEqual(roomFor("br", area(true), 96), { right: WINDOW.w + 8, left: 0, thread: WINDOW.h - 96 + 8, page: 0 });
  assert.deepEqual(roomFor("bl", area(true), 96), { right: 0, left: WINDOW.w + 8, thread: WINDOW.h - 96 + 8, page: 0 });
  assert.deepEqual(roomFor("br", area(false), 0), { right: 0, left: 0, thread: 0, page: WINDOW.h - 16 });
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

test("the companion window gives the face breathing room and allows intentional body overlap", () => {
  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  assert.match(css, /width: calc\(116px \* var\(--k\)\)/);
  assert.match(css, /height: calc\(138px \* var\(--k\)\)/);
  assert.match(css, /\.cmpBody[\s\S]*?scale: \.75;/);
  assert.match(css, /\.cmpStage[\s\S]*?clip-path: inset\(-16px -14px 0 -14px/);
  assert.match(css, /\.cmpSill[\s\S]*?z-index: 6;/);
});

test("the tab that calls him back stays under the finger while it is pressed", () => {
  // On a phone the room gives every pressed button its own transform (scale), which
  // replaces any transform the button already has. A tab placed with a transform
  // jumps to the screen's corner mid-press and the tap misses it.
  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  const rule = /\.cmpTab \{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(rule, /left: var\(--tx/);
  assert.match(rule, /top: var\(--ty/);
  assert.ok(!/transform\s*:/.test(rule), "the tab must not be placed with a transform");
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
