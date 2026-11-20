import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPANION_EVENTS, DEFAULT_PREFS, LEAN_AFTER_MS, LINES, MAX_SCALE, MIN_SCALE, OUTFITS, OUTFIT_LABELS, SLEEP_AFTER_MS, WINDOW,
  chooseDock, controlSafeDock, clampScale, coversControl, dirPose, dockForPos, dockFromDrop, idleStage, nudgePos, parseOutfit, parsePrefs, pointFromPos, posFromPoint, reactionFor, readingPose, roomFor, scaleFromDrag, sizeAt, spot,
  type Area, type CompanionPrefs, type Rect
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
  assert.deepEqual(parsePrefs('{"dock":"zz","tuck":false,"seated":true}'), { v: 2, speech: false, seated: true, tuck: false, dock: "br", pos: null, host: "float", outfit: null, calm: false, scale: 1 });
  assert.deepEqual(parsePrefs('{"dock":"tl"}'), { v: 2, speech: false, seated: false, tuck: true, dock: "tl", pos: null, host: "float", outfit: null, calm: false, scale: 1 });
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


test("Phase 3 control-safe docking never relies on scrolling a covered upload action clear", () => {
  const phone: Area = { left: 20, right: 300, top: 170, bottom: 600, inRow: false };
  const upload = { left: 30, right: 290, top: 500, bottom: 550 };
  assert.equal(chooseDock("br", phone, [upload], true), "br");
  assert.equal(controlSafeDock("br", phone, [upload]), "tr");
  const corner = spot("br", phone);
  assert.equal(controlSafeDock("br", phone, [{ left: corner.x - 6, right: corner.x - 2, top: corner.y, bottom: corner.y + 20 }]), "bl");
});

test("Phase 3 seats temporarily when all corners are blocked, then restores the saved dock when clear", () => {
  const a = area();
  const controls = (["br", "bl", "tr", "tl"] as const).map(dock => { const at = spot(dock, a); return under(at.x, at.y); });
  assert.equal(controlSafeDock("bl", a, controls), null);
  assert.equal(controlSafeDock("bl", a, []), "bl");
  assert.equal(controlSafeDock("br", { ...a, right: a.left + WINDOW.w - 1 }, []), null);
  assert.equal(controlSafeDock("br", { ...a, bottom: a.top + WINDOW.h - 1 }, []), null);
  assert.equal(controlSafeDock("br", area(true), controls), "br", "Coach keeps its reserved composer geometry");
});

/** The field picking from before prefs v2, copied so a v2 save can be checked against an older build. */
function parseV1(raw: string) {
  const value = JSON.parse(raw) as Record<string, unknown>;
  return {
    speech: value.speech === true,
    seated: value.seated === true,
    tuck: value.tuck !== false,
    dock: typeof value.dock === "string" && ["br", "bl", "tr", "tl"].includes(value.dock) ? value.dock : "br"
  };
}

test("a save from before v2 migrates: it reads as v2 with the new fields at their defaults", () => {
  assert.deepEqual(parsePrefs('{"speech":true,"seated":false,"tuck":true,"dock":"tl"}', "1.25"), {
    v: 2, speech: true, seated: false, tuck: true, dock: "tl", pos: null, host: "float", outfit: null, calm: false, scale: 1.25
  });
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
});

test("a v2 save reads back unchanged", () => {
  const prefs: CompanionPrefs = { v: 2, speech: true, seated: true, tuck: false, dock: "bl", pos: { x: 0.25, y: 0.75 }, host: "strip", outfit: "sash", calm: true, scale: 1.5 };
  const { scale, ...room } = prefs;
  assert.deepEqual(parsePrefs(JSON.stringify(room), String(scale)), prefs);
});

test("a build from before v2 still reads speech, seated, tuck and dock from a v2 save", () => {
  const saved = '{"v":2,"speech":true,"seated":true,"tuck":false,"dock":"tr","pos":{"x":0.5,"y":0.5},"outfit":"beret","calm":true}';
  assert.deepEqual(parseV1(saved), { speech: true, seated: true, tuck: false, dock: "tr" });
});

test("a malformed position or outfit falls back to none, and calm is on only when saved as true", () => {
  for (const pos of ['"0.5,0.5"', "[0.5,0.5]", '{"x":"0.5","y":0.5}', '{"x":0.5}', '{"x":null,"y":null}', '{"x":1e400,"y":0.5}', "true", "null"]) {
    assert.equal(parsePrefs(`{"pos":${pos}}`).pos, null, `position ${pos}`);
  }
  for (const outfit of ['"crown"', '"Visor"', "7", '["visor"]', "null"]) {
    assert.equal(parsePrefs(`{"outfit":${outfit}}`).outfit, null, `outfit ${outfit}`);
  }
  for (const outfit of OUTFITS) assert.equal(parsePrefs(JSON.stringify({ outfit })).outfit, outfit);
  assert.equal(parsePrefs('{"calm":"yes"}').calm, false);
  assert.equal(parsePrefs('{"calm":true}').calm, true);
});

test("a saved position is clamped to 0..1 on each side", () => {
  assert.deepEqual(parsePrefs('{"pos":{"x":-0.5,"y":1.5}}').pos, { x: 0, y: 1 });
  assert.deepEqual(parsePrefs('{"pos":{"x":0.3,"y":0.7}}').pos, { x: 0.3, y: 0.7 });
});

test("a point becomes a position and back, and the corners sit at the ends of the free room", () => {
  // 256 px of room to slide each way once his 116 x 138 window is placed.
  const zone: Rect = { left: 10, top: 100, right: 382, bottom: 494 };
  assert.deepEqual(posFromPoint(10, 100, zone, WINDOW), { x: 0, y: 0 });
  assert.deepEqual(posFromPoint(266, 356, zone, WINDOW), { x: 1, y: 1 });
  const pos = posFromPoint(74, 228, zone, WINDOW);
  assert.deepEqual(pos, { x: 0.25, y: 0.5 });
  assert.deepEqual(pointFromPos(pos, zone, WINDOW), { x: 74, y: 228 });
  assert.deepEqual(posFromPoint(0, 0, { left: 0, top: 0, right: WINDOW.w, bottom: WINDOW.h }, WINDOW), { x: 0.5, y: 0.5 }, "no room to slide reads as the middle");
});

test("a saved position keeps the whole window inside an area that has shrunk", () => {
  const small: Rect = { left: 10, top: 100, right: 200, bottom: 300 };
  assert.deepEqual(pointFromPos({ x: 1, y: 1 }, small, WINDOW), { x: small.right - WINDOW.w, y: small.bottom - WINDOW.h });
  for (const pos of [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]) {
    const at = pointFromPos(pos, small, WINDOW);
    assert.ok(at.x >= small.left && at.x + WINDOW.w <= small.right, `across, at ${pos.x}`);
    assert.ok(at.y >= small.top && at.y + WINDOW.h <= small.bottom, `down, at ${pos.y}`);
  }
});

test("the dock for a saved position is the corner nearest to where he sits", () => {
  const a = area();
  assert.equal(dockForPos({ x: 0, y: 0 }, a, WINDOW), "tl");
  assert.equal(dockForPos({ x: 1, y: 0 }, a, WINDOW), "tr");
  assert.equal(dockForPos({ x: 0, y: 1 }, a, WINDOW), "bl");
  assert.equal(dockForPos({ x: 1, y: 1 }, a, WINDOW), "br");
  assert.equal(dockForPos({ x: 0.3, y: 0.7 }, a, WINDOW), "bl");
});

test("arrow keys nudge him a step at a time, stop at the edges, and step back to the same spot", () => {
  // The same zone as the position tests: 256 px of room to slide each way.
  const zone: Rect = { left: 10, top: 100, right: 382, bottom: 494 };
  assert.deepEqual(nudgePos({ x: 0.25, y: 0.5 }, 16, 0, zone, WINDOW), { x: 0.3125, y: 0.5 }, "one 16 px step");
  assert.deepEqual(nudgePos({ x: 0.25, y: 0.5 }, 0, -64, zone, WINDOW), { x: 0.25, y: 0.25 }, "a Shift step is 64 px");
  assert.deepEqual(nudgePos({ x: 1, y: 1 }, 16, 16, zone, WINDOW), { x: 1, y: 1 }, "clamped at the bottom right");
  assert.deepEqual(nudgePos({ x: 0, y: 0 }, -16, -16, zone, WINDOW), { x: 0, y: 0 }, "clamped at the top left");
  assert.deepEqual(nudgePos({ x: 0.5, y: 0.5 }, 10_000, 0, zone, WINDOW), { x: 1, y: 0.5 }, "a long push stops at the edge");
  const moved = nudgePos({ x: 0.25, y: 0.5 }, 16, -16, zone, WINDOW);
  assert.deepEqual(pointFromPos(moved, zone, WINDOW), { x: 90, y: 212 });
  assert.deepEqual(nudgePos(moved, -16, 16, zone, WINDOW), { x: 0.25, y: 0.5 });
});

test("a free spot counts as covered only past a sliver of him", () => {
  const at = { x: 100, y: 200 };
  assert.equal(coversControl(at, [under(100, 200)]), true);
  assert.equal(coversControl(at, [{ left: 90, top: 200, right: 110, bottom: 230 }]), false, "a 10 by 30 px corner is a sliver");
  assert.equal(coversControl(at, [{ left: 300, top: 200, right: 340, bottom: 240 }]), false, "a control beside him is clear");
  assert.equal(coversControl(at, []), false);
});

test("the strip is chosen only by the exact value; a save without it, or with another value, is float", () => {
  assert.equal(DEFAULT_PREFS.host, "float");
  assert.equal(parsePrefs('{"host":"strip"}').host, "strip");
  assert.equal(parsePrefs('{"host":"float"}').host, "float");
  for (const raw of ['{"v":2,"speech":true}', '{"host":"top"}', '{"host":"STRIP"}', '{"host":1}', '{"host":null}', '{"host":["strip"]}', "not json"]) {
    assert.equal(parsePrefs(raw).host, "float", `host from ${raw}`);
  }
  assert.equal(parsePrefs('{"speech":true,"seated":false,"tuck":true,"dock":"tl"}').host, "float", "a v1 save has no host");
});

test("every outfit has a short plain menu name, and anything else reads as no outfit", () => {
  for (const outfit of OUTFITS) {
    const label = OUTFIT_LABELS[outfit];
    assert.ok(label.length > 0 && label.length <= 24, `${outfit}: ${label}`);
    assert.ok(!/[—–]/.test(label), `no dashes in ${label}`);
  }
  assert.equal(OUTFIT_LABELS.goggles, "Science goggles");
  assert.equal(OUTFIT_LABELS.sash, "Civics sash");
  for (const value of ["", "none", "Visor", null, undefined, 3]) assert.equal(parseOutfit(value), null, `outfit from ${String(value)}`);
  assert.equal(parseOutfit("visor"), "visor");
});

test("the strip takes no room until he is shown in it, folds with the header, and is at most 56px on a phone", () => {
  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  assert.match(css, /\.cmpStripSlot \{[^}]*height: 0;/, "the slot is empty by default");
  assert.match(css, /\.cmpStripSlot\[data-on\] \{ height: 64px; \}/);
  assert.match(css, /\.modeFrame\[data-collapsed="true"\] \.cmpStripSlot, html\[data-keyboard="open"\] \.cmpStripSlot \{ height: 0; \}/);
  assert.match(css, /@media \(max-width: 700px\) \{\s*\.cmp\[data-host="strip"\] \{ --strip-k: \.823; --strip-x: 14px; \}\s*\.cmpStripSlot\[data-on\] \{ height: 56px; \}\s*\}/);
});

test("the strip clips to its own band, so a hop or a bubble cannot leave it or push the rail", () => {
  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  assert.match(css, /\.cmpStrip \{ position: absolute; inset: 0; overflow: hidden; \}/);
  assert.match(css, /\.cmp\[data-host="strip"\] \{[^}]*position: absolute;[^}]*overflow: hidden;/);
  assert.doesNotMatch(css, /\.cmpStripSlot[^{]*\{[^}]*(margin|padding|transform)\s*:/, "the slot does not offset the rail");
});

test("the strip slot sits between the room navigation and the colored rail, and folds with the drawer", () => {
  const header = readFileSync(join(here, "../components/room/mode-header.tsx"), "utf8");
  const at = header.indexOf('<div className="cmpStripSlot"');
  assert.ok(at > header.indexOf("{accessory}") && at < header.indexOf("<StudigoRail tone={tone} />"), "slot is after the accessory and before the rail");
  const slotLine = header.split("\n").find((line) => line.includes("cmpStripSlot")) ?? "";
  assert.match(slotLine, /data-companion-strip=""/);
  assert.match(slotLine, /inert=\{collapsed\}/);
});

test("calm mode allows no sparks or hearts, only the sleep letters", () => {
  const engine = readFileSync(join(here, "../components/companion/engine.ts"), "utf8");
  const burst = /function burst\([\s\S]*?\n  \}/.exec(engine)?.[0] ?? "";
  assert.match(burst, /if \(calm && kind !== "zzz"\) return;/);
  assert.doesNotMatch(burst, /Math\.min\(count, 2\)/);
});

test("the menu and Room Settings offer the same two places and the same outfit names", () => {
  const engine = readFileSync(join(here, "../components/companion/engine.ts"), "utf8");
  const settings = readFileSync(join(here, "../components/companion/companion.tsx"), "utf8");
  for (const label of ["Where he sits", "Floating window", "Strip under the menu"]) {
    assert.ok(engine.includes(label), `menu: ${label}`);
    assert.ok(settings.includes(label), `room settings: ${label}`);
  }
  assert.match(engine, /renderer\.setOutfit\?\.\(prefs\.outfit\)/);
  assert.match(engine, /OUTFIT_LABELS\[outfit\]/);
  assert.match(settings, /OUTFIT_LABELS\[outfit\]/);
});

test("the strip's menu button is named and has a visible focus style, like the rest of his controls", () => {
  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  const engine = readFileSync(join(here, "../components/companion/engine.ts"), "utf8");
  assert.match(engine, /class="cmpStripMenu" type="button"[^>]*aria-label="Studigo's menu"/);
  assert.match(css, /\.cmpStripMenu:focus-visible \{/);
  assert.match(css, /\.cmpSegment button:focus-visible/);
});

test("no em or en dashes in anything he shows", () => {
  for (const file of ["../components/companion/engine.ts", "../components/companion/companion.tsx", "../components/room/mode-header.tsx", "companion-logic.ts"]) {
    assert.ok(!/[—–]/.test(readFileSync(join(here, file), "utf8")), `${file} has an em or en dash`);
  }
});

test("the strip choice is saved per room and reads back; another room and an older save stay float", async () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); }
  };
  Object.assign(globalThis, { window: { localStorage: storage, addEventListener() {}, removeEventListener() {} } });
  try {
    const saved = await import("./companion-prefs");
    saved.writeCompanionPrefs("room-a", { host: "strip" });
    assert.equal(saved.readCompanionPrefs("room-a").host, "strip");
    assert.equal(saved.readCompanionPrefs("room-b").host, "float");
    store.set("studigo.companion.room-c", '{"v":2,"speech":true,"seated":false}');
    assert.equal(saved.readCompanionPrefs("room-c").host, "float");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
