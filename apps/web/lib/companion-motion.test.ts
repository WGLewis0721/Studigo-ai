import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMPANION_EVENTS, WINDOW_POSES, type CompanionEvent, type WindowPose } from "./companion-logic";
import { BEATS, CALM_PARTICLE_CAP, type BeatDef, type BeatName } from "./companion-motion/beats";
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

test("30, 60 and 120 Hz displays see the same motion and the same drawings", () => {
  const script: [number, CompanionEvent][] = [[500, "correct"], [1500, "wrong"], [2600, "correctFast"], [4000, "setDone"]];
  const runs = [30, 60, 120].map((hz) => {
    const director = createDirector({ random: seeded(9) });
    const poses: (WindowPose | null)[] = [];
    // Every tenth of a second is a frame on all three displays, so their drawings can be compared frame for frame.
    const sample = (frame: MotionFrame, nowMs: number) => { if (Math.abs(nowMs / 100 - Math.round(nowMs / 100)) < 1e-6) poses.push(frame.pose); };
    let at = 0;
    for (const [when, event] of script) { run(director, hz, at, when, sample); director.onEvent(event); at = when; }
    director.lookAt(0.8, -0.3, 900);
    return { final: { ...run(director, hz, at, 7000, sample), t: director.state().t }, poses };
  });
  for (const other of runs.slice(1)) {
    assert.equal(other.final.t, runs[0].final.t);
    assert.equal(other.final.expression, runs[0].final.expression);
    assert.equal(other.final.pose, runs[0].final.pose);
    assert.deepEqual(other.poses, runs[0].poses);
    for (const key of NUMERIC) assert.ok(Math.abs((other.final[key] as number) - (runs[0].final[key] as number)) < 1e-9, `${String(key)} differs`);
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

test("the rig at rest is the approved drawing, untouched", async () => {
  const { buildRig, poseMesh } = await import("./companion-motion/rig");
  const mesh = buildRig();
  const frame = createDirector({ random: seeded(20) }).advance(0);
  const posed = poseMesh(mesh, frame, new Float32Array(mesh.count * 2));
  for (let i = 0; i < posed.length; i += 1) assert.ok(Math.abs(posed[i] - mesh.rest[i]) < 1e-3, `point ${i >> 1} moved at rest`);
});

test("a head turn has depth: the snout travels further than the skull's edge, and the far side foreshortens", async () => {
  const { RIG, poseHeadPoint } = await import("./companion-motion/rig");
  const director = createDirector({ random: seeded(21) });
  director.advance(0);
  director.lookAt(1, 0, 5000);
  const frame = run(director, 120, 0, 2000);
  const moved = (x: number, y: number) => poseHeadPoint(x, y, frame).x - x;
  const snout = moved(RIG.snout.x, RIG.snout.y), eye = moved(RIG.eyeL.x, RIG.eyeL.y), rim = moved(RIG.head.x - RIG.head.rx + 2, RIG.head.y);
  assert.ok(snout > 12, `the snout only moved ${snout.toFixed(1)} px`);
  assert.ok(snout > eye && eye > rim, JSON.stringify({ snout, eye, rim }));
  const near = poseHeadPoint(RIG.eyeR.x, RIG.eyeR.y, frame).x - poseHeadPoint(RIG.head.x, RIG.eyeR.y, frame).x;
  const far = poseHeadPoint(RIG.head.x, RIG.eyeL.y, frame).x - poseHeadPoint(RIG.eyeL.x, RIG.eyeL.y, frame).x;
  assert.ok(Math.abs(near - far) > 1.5, "both halves of his face kept the same width, so the turn is flat");
  // The body is not part of the head: a point on his chest does not ride the turn.
  const { posePoint } = await import("./companion-motion/rig");
  const chest = { x: 0, y: 0 };
  posePoint(205, 330, { head: 0, depth: 0, frillL: 0, frillR: 0, tail: 0, flame: 0, body: 1 }, frame, chest);
  assert.ok(Math.abs(chest.x - 205) < snout / 2);
});

test("beat drawings are real poses, in time order, and inside the beat", () => {
  for (const [name, def] of Object.entries<BeatDef>(BEATS)) {
    let last = -1;
    for (const key of def.poses ?? []) {
      assert.ok(key.pose === null || WINDOW_POSES.includes(key.pose), `${name} names ${key.pose}`);
      assert.ok(key.at > last && key.at < def.ms, `${name}: drawing at ${key.at} ms is out of order or past the beat`);
      last = key.at;
    }
  }
});

/* What each beat shows: a time into the beat, and the drawing he should show then (null is the rig). */
const DRAWINGS: [BeatName, number, WindowPose | null][] = [
  ["hit", 300, "celebrate"], ["hit", 650, null], ["hitFast", 400, "celebrate"], ["hitFast", 850, null],
  ["celebrate", 300, "celebrate"], ["celebrate", 800, null], ["celebrate", 1500, "celebrate"], ["celebrate", 2400, null],
  ["cardGood", 250, "celebrate"], ["cardGood", 600, null], ["cardMiss", 350, "support"], ["cardMiss", 800, null],
  ["miss", 400, "support"], ["miss", 1000, null], ["blindspot", 400, "support"], ["blindspot", 1000, null],
  ["streak5", 500, "celebrate"], ["streak5", 1200, null], ["streak10", 200, null], ["streak10", 500, "celebrate"], ["streak10", 1800, null],
  ["bound", 600, "celebrate"], ["bound", 1300, null], ["poke", 300, "poke"], ["poke", 700, null],
  ["petted", 400, "pet"], ["petted", 850, null], ["tickle", 600, "poke"], ["tickle", 1450, null],
  ["support", 500, "support"], ["support", 1100, null], ["lean", 2000, "lean"], ["lean", 5200, null],
  ["wake", 200, "poke"], ["wake", 600, null]
];

test("each beat shows its drawings at the right moments, and the rig in between", () => {
  for (const [name, at, pose] of DRAWINGS) {
    const director = createDirector({ random: seeded(31) });
    director.advance(0);
    director.play(name);
    assert.equal(run(director, 120, 0, at).pose, pose, `${name} at ${at} ms`);
  }
});

test("a far gaze draws his head turn in that direction, and lets go when it ends", () => {
  const turns: [number, number, WindowPose][] = [[1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0.7, 0.7, "down-right"], [-0.7, -0.7, "up-left"], [0, -1, "up"]];
  for (const [x, y, pose] of turns) {
    const director = createDirector({ random: seeded(34) });
    run(director, 120, 0, 1000);
    director.lookAt(x, y, 800, "snap");
    assert.equal(run(director, 120, 1000, 1200).pose, pose, pose);
    assert.equal(run(director, 120, 1200, 1900).pose, null, `${pose} after its gaze ends`);
  }
});

test("a gaze near the entry line draws nothing, and a drawn gaze survives a dip below it", () => {
  const quiet = createDirector({ random: seeded(35) });
  run(quiet, 120, 0, 1000);
  quiet.lookAt(0.33, 0, 900, "look");
  const none = new Set<WindowPose | null>();
  run(quiet, 120, 1000, 1900, (frame) => { none.add(frame.pose); });
  assert.deepEqual([...none], [null]);

  const director = createDirector({ random: seeded(35) });
  run(director, 120, 0, 1000);
  director.lookAt(0.7, 0, 100, "snap");
  run(director, 120, 1000, 1100);
  director.lookAt(0.33, 0, 1000, "look");
  const held = new Set<WindowPose | null>();
  run(director, 120, 1100, 2000, (frame) => { held.add(frame.pose); });
  assert.deepEqual([...held], ["right"]);
});

test("a drawn look holds for 250 ms, so a short glance cannot flicker", () => {
  const director = createDirector({ random: seeded(36) });
  run(director, 120, 0, 1000);
  director.lookAt(1, 0, 60, "snap");
  assert.equal(run(director, 120, 1000, 1200).pose, "right", "held inside 250 ms");
  director.lookAt(0, 1, 800, "look");
  assert.equal(run(director, 120, 1200, 1240).pose, "right", "a switch waits for the hold too");
  assert.equal(run(director, 120, 1240, 1300).pose, "down", "then it switches");
});

test("being held, petted or thinking shows its drawing, and the rig comes back after", () => {
  const director = createDirector({ random: seeded(37) });
  run(director, 120, 0, 300);
  director.setHeld(true);
  assert.equal(run(director, 120, 300, 500).pose, "poke");
  director.setHeld(false);
  assert.equal(run(director, 120, 500, 700).pose, null);
  director.setPetted(true);
  assert.equal(run(director, 120, 700, 900).pose, "pet");
  director.setPetted(false);
  director.setThinking(true);
  assert.equal(run(director, 120, 900, 1100).pose, "up");
  director.setThinking(false);
  assert.equal(run(director, 120, 1100, 1300).pose, null);
});

test("asleep shows the sleep drawing, and waking shows a poke", () => {
  const director = createDirector({ random: seeded(13) });
  let now = 0;
  const until = (ms: number) => { for (; now <= ms; now += 50) director.advance(now); };
  until(200_000);
  assert.equal(director.advance(now).pose, "sleep");
  director.activity();
  until(now + 100);
  assert.equal(director.advance(now).pose, "poke");
});

test("an explicit rig beat shows the rig, even while his gaze is far off", () => {
  const director = createDirector({ random: seeded(38) });
  run(director, 120, 0, 500);
  director.lookAt(1, 0, 3000, "look");
  assert.equal(run(director, 120, 500, 700).pose, "right");
  director.play("stretch");
  assert.equal(run(director, 120, 700, 1000).pose, null);
});

test("calm mode shows the same drawings; only the motion is gentler", () => {
  const trail = (reducedMotion: boolean) => {
    const director = createDirector({ random: seeded(39), reducedMotion });
    run(director, 120, 0, 300);
    director.onEvent("setDone");
    director.lookAt(0.9, 0, 4000, "look");
    const poses: (WindowPose | null)[] = [];
    run(director, 120, 300, 4500, (frame) => { poses.push(frame.pose); });
    return poses;
  };
  const normal = trail(false);
  assert.ok(normal.includes("celebrate") && normal.includes("right") && normal.includes(null));
  assert.deepEqual(trail(true), normal);
});

test("the idle glance's sway is one gentle sway: no tickle, no face change", () => {
  assert.deepEqual(BEATS.sway.moves.map((move) => [move.kind, move.amount]), [["sway", 0.5]]);
  assert.deepEqual(BEATS.sway.faces.map((key) => key.face), ["Sunny"]);
});
