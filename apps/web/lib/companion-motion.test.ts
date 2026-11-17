import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMPANION_EVENTS, type CompanionEvent } from "./companion-logic";
import { BEATS, CALM_PARTICLE_CAP, type BeatName } from "./companion-motion/beats";
import { createDirector, type MotionFrame } from "./companion-motion/director";
import { EXPRESSION_NAMES } from "./companion-motion/expressions";

/** mulberry32: a small seeded source so every run sees the same "random" motion. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs a director at a display rate until `untilMs`, calling `each` after every frame. */
function run(director: ReturnType<typeof createDirector>, hz: number, fromMs: number, untilMs: number, each?: (frame: MotionFrame, nowMs: number) => void) {
  const first = Math.round((fromMs * hz) / 1000), last = Math.round((untilMs * hz) / 1000);
  let frame = director.advance((first * 1000) / hz);
  for (let i = first + 1; i <= last; i += 1) {
    const now = (i * 1000) / hz;
    frame = director.advance(now);
    each?.(frame, now);
  }
  return frame;
}

const NUMERIC: (keyof MotionFrame)[] = ["gazeX", "gazeY", "headYaw", "headPitch", "headTilt", "bodyYaw", "lean", "lift", "eyeOpenL", "eyeOpenR", "eyeSmile", "brow", "mouthCurve", "mouthOpen", "cheek", "frillL", "frillR", "tail", "tailTip", "flame", "breath", "hop", "dash", "shiver", "squash", "spin", "spark"];

test("the motion modules import nothing but each other, the event contract and the mood meter", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "companion-motion");
  const allowed = /^(\.\/[\w-]+|\.\.\/companion-logic|\.\.\/companion-mood)$/;
  const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
  assert.ok(files.includes("director.ts"));
  for (const file of files) {
    const source = readFileSync(join(dir, file), "utf8");
    for (const match of source.matchAll(/from\s+"([^"]+)"/g)) assert.match(match[1], allowed, `${file} imports ${match[1]}`);
    assert.doesNotMatch(source, /\b(fetch|localStorage|document|window|supabase|requestAnimationFrame|Date\.now|performance\.now|Math\.random)\b/, `${file} reaches outside`);
  }
});

test("there are fourteen faces and every beat names real ones", () => {
  assert.equal(EXPRESSION_NAMES.length, 14);
  for (const [name, def] of Object.entries(BEATS)) {
    for (const key of def.faces) assert.ok(EXPRESSION_NAMES.includes(key.face), `${name} uses ${key.face}`);
    for (const move of def.moves ?? []) assert.ok(move.at + move.ms <= def.ms, `${name}: ${move.kind} runs past the beat`);
  }
});

test("every committed event has a reaction", () => {
  for (const event of COMPANION_EVENTS) {
    const director = createDirector({ random: seeded(1) });
    director.advance(0);
    director.onEvent(event, event === "stall" ? { level: 2 } : undefined);
    assert.notEqual(run(director, 60, 0, 100).beat, null, event);
  }
});

test("a higher priority beat interrupts; a lower one waits; only the two newest wait", () => {
  const director = createDirector({ random: seeded(2) });
  director.advance(0);
  director.onEvent("correct");
  run(director, 60, 0, 200);
  assert.equal(director.state().playing, "hit");
  director.play("poke");
  assert.equal(director.state().playing, "hit", "a touch does not cut a graded reaction");
  director.play("tickle"); director.play("petted");
  assert.deepEqual(director.state().queued, ["tickle", "petted"], "the oldest waiting beat is dropped");
  director.play("sniff");
  assert.deepEqual(director.state().queued, ["tickle", "petted"], "idle vignettes never queue");
  director.onEvent("setDone");
  assert.equal(director.state().playing, "celebrate");
  const after = run(director, 60, 200, 200 + BEATS.celebrate.ms + 50);
  assert.equal(after.beat, "tickle", "the queue plays in order once the celebration ends");
});

test("an interrupted reaction is back at REST within 400 ms, over 50 scripted sequences", () => {
  const pick = seeded(77);
  const names = Object.keys(BEATS) as BeatName[];
  for (let i = 0; i < 50; i += 1) {
    const director = createDirector({ random: seeded(100 + i) });
    director.advance(0);
    let now = 0;
    for (let n = 0; n < 1 + Math.floor(pick() * 4); n += 1) {
      if (pick() < 0.6) director.onEvent(COMPANION_EVENTS[Math.floor(pick() * COMPANION_EVENTS.length)] as CompanionEvent);
      else director.play(names[Math.floor(pick() * names.length)]);
      const next = now + 30 + Math.floor(pick() * 900);
      run(director, 60, now, next);
      now = next;
    }
    director.rest();
    let worst = 0, previous = Infinity;
    run(director, 120, now, now + 400, () => {
      const far = director.restDistance();
      // No pop: the reaction layer never jumps between two frames while it lets go.
      if (previous !== Infinity) worst = Math.max(worst, Math.abs(far - previous));
      previous = far;
    });
    assert.ok(director.restDistance() < 0.02, `sequence ${i}: still ${director.restDistance().toFixed(3)} from REST after 400 ms`);
    assert.ok(worst < 0.2, `sequence ${i}: jumped ${worst.toFixed(3)} in one frame`);
  }
});

test("a beat that runs to its end leaves him at REST", () => {
  for (const name of Object.keys(BEATS) as BeatName[]) {
    const director = createDirector({ random: seeded(5) });
    director.advance(0);
    director.play(name);
    run(director, 60, 0, BEATS[name].ms + 400);
    assert.equal(director.state().playing, null, name);
    assert.ok(director.restDistance() < 0.02, `${name}: ${director.restDistance().toFixed(3)} from REST`);
  }
});

test("30, 60 and 120 Hz displays see the same motion", () => {
  const script: [number, CompanionEvent][] = [[500, "correct"], [1500, "wrong"], [2600, "correctFast"], [4000, "setDone"]];
  const final = [30, 60, 120].map((hz) => {
    const director = createDirector({ random: seeded(9) });
    let at = 0;
    for (const [when, event] of script) { run(director, hz, at, when); director.onEvent(event); at = when; }
    director.lookAt(0.8, -0.3, 900);
    return { ...run(director, hz, at, 7000), t: director.state().t };
  });
  for (const other of final.slice(1)) {
    assert.equal(other.t, final[0].t);
    assert.equal(other.expression, final[0].expression);
    for (const key of NUMERIC) assert.ok(Math.abs((other[key] as number) - (final[0][key] as number)) < 1e-9, `${String(key)} differs`);
  }
});

test("the eyes lead the head, and the head leads the body", () => {
  const director = createDirector({ random: seeded(3) });
  director.advance(0);
  director.lookAt(1, 0, 2000, "snap");
  const early = { ...run(director, 120, 0, 120) };
  assert.ok(early.gazeX > early.headYaw && early.headYaw > early.bodyYaw && early.bodyYaw > 0, JSON.stringify([early.gazeX, early.headYaw, early.bodyYaw]));
  const settled = run(director, 120, 120, 1500);
  assert.ok(settled.gazeX > 0.9 && settled.headYaw > 0.5 && settled.bodyYaw > 0.1);
});

test("he blinks on his own, and both eyes close together", () => {
  const director = createDirector({ random: seeded(4) });
  let closed = 0;
  run(director, 120, 0, 12_000, (frame) => { if (frame.eyeOpenL < 0.15) { closed += 1; assert.equal(frame.eyeOpenL, frame.eyeOpenR); } });
  assert.ok(closed > 2, "no blink in twelve seconds");
});

test("mistakes never lower mood, and right answers lift it", () => {
  const director = createDirector({ random: seeded(6) });
  director.advance(0);
  let now = 0, low = Infinity;
  for (let i = 0; i < 10; i += 1) {
    const before = director.state().spark;
    director.onEvent(i % 2 ? "wrong" : "blindspot");
    assert.ok(director.state().spark >= before, "a mistake lowered mood");
    run(director, 60, now, now + 1500, (frame) => { low = Math.min(low, frame.spark); });
    now += 1500;
  }
  assert.ok(low >= 1);
  const before = director.state().spark;
  director.onEvent("correct");
  assert.ok(director.state().spark > before);
});

test("streaks are counted here, from committed right answers only", () => {
  const director = createDirector({ random: seeded(8) });
  director.advance(0);
  director.onEvent("correct"); director.onEvent("correct");
  assert.deepEqual(director.state().queued, ["hit"]);
  director.onEvent("correct");
  assert.equal(director.state().streak, 3);
  assert.ok(director.state().queued.includes("streak3"));
  director.onEvent("wrong");
  assert.equal(director.state().streak, 0);
});

test("calm mode: no hops, spins, dashes or shivers, and at most four particles", () => {
  const director = createDirector({ random: seeded(10), reducedMotion: true });
  director.advance(0);
  director.onEvent("setDone");
  run(director, 60, 0, BEATS.celebrate.ms, (frame) => {
    assert.equal(frame.hop, 0); assert.equal(frame.spin, 0); assert.equal(frame.dash, 0); assert.equal(frame.shiver, 0);
    for (const fx of frame.fx) assert.ok(fx.count <= CALM_PARTICLE_CAP);
  });
  assert.equal(director.state().playing, null);
  // The idle never starts a vignette on its own in calm mode.
  let beats = 0;
  run(director, 30, BEATS.celebrate.ms, 50_000, (frame) => { if (frame.beat) beats += 1; });
  assert.equal(beats, 0);
});

test("a hidden tab stops the clock and resumes without a jump", () => {
  const director = createDirector({ random: seeded(11) });
  run(director, 60, 0, 1000);
  const at = director.state().t;
  director.setVisible(false);
  director.advance(60_000);
  assert.equal(director.state().t, at);
  director.setVisible(true);
  director.advance(120_000); director.advance(120_016);
  assert.ok(director.state().t - at <= 17 + 1e-6, "time jumped on resume");
});

test("one long frame cannot throw him across the screen", () => {
  const director = createDirector({ random: seeded(12) });
  director.advance(0); director.advance(10_000);
  assert.ok(director.state().t <= 100 + 1e-6);
});

test("the idle ladder: he leans after a minute, sleeps after three, and wakes when the learner returns", () => {
  const director = createDirector({ random: seeded(13) });
  const cues: string[] = [];
  let now = 0;
  // 20 fps keeps this fast; long frames are capped at 100 ms, so step by 50.
  const until = (ms: number) => { for (; now <= ms; now += 50) cues.push(...director.advance(now).cues); };
  until(62_000);
  assert.ok(cues.includes("lean"));
  until(200_000);
  assert.ok(cues.includes("sleep"));
  assert.equal(director.state().asleep, true);
  const asleep = director.advance(now);
  assert.equal(asleep.eyeOpenL, 0);
  director.activity();
  until(now + 100);
  assert.ok(cues.includes("wake"));
  assert.equal(director.state().asleep, false);
});

test("the mouth follows its driver and settles shut", () => {
  const director = createDirector({ random: seeded(14) });
  director.advance(0);
  director.setMouth(1);
  assert.ok(run(director, 120, 0, 200).mouthOpen > 0.6);
  director.setMouth(0);
  assert.ok(run(director, 120, 200, 900).mouthOpen < 0.05);
});
