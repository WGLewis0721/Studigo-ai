import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMPANION_EVENTS } from "./companion-logic";
import { MILESTONE_STREAKS, ROUTINE_CORRECT_GAP_MS, VOICE_COOLDOWN_MS, VOICE_LINES, VOICE_START, momentFor, planVoice, voiceLine, type VoiceLineId, type VoiceMoment, type VoiceState } from "./companion-voice";

const publicVoice = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mascot", "voice");

/** Plays a sequence of moments at the given times and returns the lines that started, in order. */
function speak(steps: [number, VoiceMoment][], start: VoiceState = VOICE_START): VoiceLineId[] {
  let state = start;
  const said: VoiceLineId[] = [];
  for (const [now, moment] of steps) {
    const planned = planVoice(moment, state, now);
    if (planned) { said.push(planned.id); state = planned.state; }
  }
  return said;
}

test("the voice table has the fourteen take-B clips, each one on disk, with unique ids", () => {
  assert.equal(VOICE_LINES.length, 14);
  assert.equal(new Set(VOICE_LINES.map((line) => line.id)).size, 14);
  const files = new Set(readdirSync(publicVoice));
  for (const line of VOICE_LINES) {
    assert.equal(line.src, `/mascot/voice/${line.id}.mp3`, `${line.id} uses its own file`);
    assert.ok(files.has(`${line.id}.mp3`) && existsSync(join(publicVoice, `${line.id}.mp3`)), `${line.id}.mp3 is in public/mascot/voice`);
  }
});

test("every line's text is plain: no dashes, and the one trimmed clip stops at two seconds", () => {
  for (const line of VOICE_LINES) assert.doesNotMatch(line.text, /[‒-―−]/, `${line.id} has a dash`);
  assert.deepEqual(VOICE_LINES.filter((line) => line.maxMs !== undefined).map((line) => [line.id, line.maxMs]), [["whatever-your-teacher", 2000]]);
  assert.equal(voiceLine("nice").text, "Nice.");
  assert.throws(() => voiceLine("not-a-line" as VoiceLineId));
});

test("a correct answer says Nice; the third, fifth and tenth in a row say You knew that one", () => {
  assert.equal(planVoice({ kind: "correct", streak: 1 }, VOICE_START, 0)?.id, "nice");
  for (const streak of MILESTONE_STREAKS) assert.equal(planVoice({ kind: "correct", streak }, VOICE_START, 0)?.id, "you-knew-that-one", `streak ${streak}`);
  assert.equal(planVoice({ kind: "correct", streak: 4 }, VOICE_START, 0)?.id, "nice");
});

test("set done and a good card streak are milestones; a single good card says nothing", () => {
  assert.equal(planVoice({ kind: "setDone" }, VOICE_START, 0)?.id, "you-knew-that-one");
  assert.equal(planVoice({ kind: "cardGood", streak: 1 }, VOICE_START, 0), null);
  assert.equal(planVoice({ kind: "cardGood", streak: 3 }, VOICE_START, 0)?.id, "you-knew-that-one");
});

test("each event maps to its line; mistakes are answered gently, not with praise", () => {
  const cases: [VoiceMoment, VoiceLineId][] = [
    [{ kind: "wrong" }, "one-step-at-a-time"], [{ kind: "blindspot" }, "one-step-at-a-time"], [{ kind: "cardMiss" }, "one-step-at-a-time"],
    [{ kind: "stall", level: 1 }, "stuck-okay"], [{ kind: "stall", level: 2 }, "your-turn"], [{ kind: "hintOpened" }, "your-turn"],
    [{ kind: "missionComplete" }, "come-on"], [{ kind: "sessionReturn" }, "oh-youre-here-early"], [{ kind: "firstMeet" }, "im-studigo"], [{ kind: "summon" }, "im-coming-with-you"]
  ];
  for (const [moment, id] of cases) assert.equal(planVoice(moment, VOICE_START, 0)?.id, id, moment.kind);
});

test("every committed event is either silent by design or says a line", () => {
  for (const event of COMPANION_EVENTS) {
    const moment = momentFor(event, { streak: 3, cardStreak: 3, level: 1 });
    if (event === "correctFast") { assert.equal(moment, null, "no speed pressure: correctFast stays quiet"); continue; }
    assert.ok(moment, `${event} has a moment`);
    assert.ok(planVoice(moment, VOICE_START, 0), `${event} says a line`);
  }
});

test("the stall level picks the line, and the level-2 stall reaches the hint line", () => {
  assert.deepEqual(momentFor("stall", { streak: 0, cardStreak: 0, level: 2 }), { kind: "stall", level: 2 });
  assert.deepEqual(momentFor("stall", { streak: 0, cardStreak: 0 }), { kind: "stall", level: 1 });
});

test("the cooldown holds: a second line within twelve seconds is silent, and one after it may speak", () => {
  const said = speak([[0, { kind: "wrong" }], [5000, { kind: "cardMiss" }], [VOICE_COOLDOWN_MS - 1, { kind: "stall", level: 1 }], [VOICE_COOLDOWN_MS, { kind: "stall", level: 1 }]]);
  assert.deepEqual(said, ["one-step-at-a-time", "stuck-okay"]);
});

test("the same line never plays twice in a row, even after the cooldown", () => {
  assert.deepEqual(speak([[0, { kind: "wrong" }], [VOICE_COOLDOWN_MS * 2, { kind: "blindspot" }]]), ["one-step-at-a-time"]);
  assert.deepEqual(speak([[0, { kind: "wrong" }], [VOICE_COOLDOWN_MS * 2, { kind: "wrong" }], [VOICE_COOLDOWN_MS * 4, { kind: "stall", level: 1 }]]), ["one-step-at-a-time", "stuck-okay"]);
});

test("routine Nice is capped to one per 45 seconds, and a milestone is not held back by that cap", () => {
  const said = speak([
    [0, { kind: "correct", streak: 1 }],
    [13_000, { kind: "wrong" }],
    [26_000, { kind: "correct", streak: 2 }],
    [30_000, { kind: "setDone" }],
    [44_000, { kind: "correct", streak: 4 }],
    [ROUTINE_CORRECT_GAP_MS, { kind: "correct", streak: 4 }]
  ]);
  assert.deepEqual(said, ["nice", "one-step-at-a-time", "you-knew-that-one", "nice"]);
});

test("the first meeting and a summon always start, even inside the cooldown", () => {
  const said = speak([[0, { kind: "wrong" }], [100, { kind: "firstMeet" }], [200, { kind: "summon" }]]);
  assert.deepEqual(said, ["one-step-at-a-time", "im-studigo", "im-coming-with-you"]);
});

test("a room opened in Coach or Materials speaks now and then, from its own pair of lines", () => {
  assert.equal(planVoice({ kind: "room", room: "coach", roll: 0.6 }, VOICE_START, 0), null);
  assert.equal(planVoice({ kind: "room", room: "coach", roll: 0.1 }, VOICE_START, 0)?.id, "got-a-test");
  assert.equal(planVoice({ kind: "room", room: "coach", roll: 0.4 }, VOICE_START, 0)?.id, "ask-me-something");
  assert.equal(planVoice({ kind: "room", room: "materials", roll: 0.1 }, VOICE_START, 0)?.id, "ill-show-you-the-page");
  assert.equal(planVoice({ kind: "room", room: "materials", roll: 0.4 }, VOICE_START, 0)?.id, "whatever-your-teacher");
});

test("the planner's memory moves on only when a line is said", () => {
  const first = planVoice({ kind: "correct", streak: 1 }, VOICE_START, 1000);
  assert.ok(first);
  assert.equal(first.state.last, "nice");
  assert.equal(first.state.lastAt, 1000);
  assert.equal(first.state.routineCorrectAt, 1000);
  assert.equal(planVoice({ kind: "wrong" }, first.state, 1000 + VOICE_COOLDOWN_MS - 1), null);
  const wrong = planVoice({ kind: "wrong" }, first.state, 1000 + VOICE_COOLDOWN_MS);
  assert.ok(wrong);
  assert.equal(planVoice({ kind: "correct", streak: 2 }, wrong.state, 1000 + 2 * VOICE_COOLDOWN_MS), null, "inside the routine cap");
  assert.equal(planVoice({ kind: "correct", streak: 2 }, wrong.state, 1000 + ROUTINE_CORRECT_GAP_MS)?.id, "nice");
});

test("a long session of answers speaks a few times, not on every answer", () => {
  let state = VOICE_START;
  const said: VoiceLineId[] = [];
  for (let i = 0; i < 120; i += 1) {
    const planned = planVoice({ kind: "correct", streak: (i % 7) + 1 }, state, i * 2000);
    if (planned) { said.push(planned.id); state = planned.state; }
  }
  assert.ok(said.length >= 1 && said.length <= 20, `said ${said.length} lines in four minutes of answers`);
  assert.ok(said.filter((id) => id === "nice").length <= 6, "routine Nice at most every 45 seconds");
});
