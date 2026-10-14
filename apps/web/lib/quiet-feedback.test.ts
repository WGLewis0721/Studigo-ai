import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  QUIET_ACK_KEY,
  loadAcknowledged,
  quietFeedback,
  requestQuietAcknowledgement,
  saveAcknowledged,
  type QuietStorage
} from "./quiet-feedback";

const here = dirname(fileURLToPath(import.meta.url));

function memoryStorage(): QuietStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); }
  };
}

test("C23 success, error, and repeated render", () => {
  const storage = memoryStorage();
  const lesson = { kind: "lesson-open" as const, eventKey: "lesson-open:room:topic", reducedMotion: false, minimized: false };

  const loading = quietFeedback({ ...lesson, phase: "loading", acknowledged: [] });
  assert.equal(loading.acknowledgement, "none");
  assert.equal(loading.status, null);
  assert.equal(loading.animate, false);
  assert.deepEqual(loading.acknowledged, []);

  const error = quietFeedback({ ...lesson, phase: "error", acknowledged: [] });
  assert.equal(error.acknowledgement, "none");
  assert.equal(error.status, null);
  assert.equal(error.animate, false);
  assert.deepEqual(error.acknowledged, []);

  const success = quietFeedback({ ...lesson, phase: "success", acknowledged: loadAcknowledged(storage) });
  assert.equal(success.acknowledgement, "once");
  assert.equal(success.animate, true);
  assert.equal(success.status, "Lesson open");
  assert.deepEqual(success.acknowledged, [lesson.eventKey]);
  saveAcknowledged(storage, success.acknowledged);

  const rerender = quietFeedback({ ...lesson, phase: "success", acknowledged: success.acknowledged });
  assert.equal(rerender.acknowledgement, "none");
  assert.equal(rerender.status, null);
  assert.equal(rerender.animate, false);

  const reloaded = requestQuietAcknowledgement({
    phase: "success",
    kind: "lesson-open",
    eventKey: lesson.eventKey,
    storage,
    reducedMotion: false,
    minimized: false
  });
  assert.equal(reloaded.acknowledgement, "none");
  assert.equal(reloaded.animate, false);
  assert.equal(JSON.parse(storage?.getItem(QUIET_ACK_KEY) ?? "[]").length, 1);

  const guide = requestQuietAcknowledgement({
    phase: "success",
    kind: "guide-ready",
    eventKey: "guide-ready:room:snap",
    storage,
    reducedMotion: false,
    minimized: false
  });
  assert.equal(guide.acknowledgement, "once");
  assert.equal(guide.status, "Guide ready");
  assert.equal(guide.animate, true);

  const guideAgain = quietFeedback({
    phase: "success",
    kind: "guide-ready",
    eventKey: "guide-ready:room:snap",
    acknowledged: loadAcknowledged(storage),
    reducedMotion: false,
    minimized: false
  });
  assert.equal(guideAgain.acknowledgement, "none");

  const stillNoError = quietFeedback({
    ...lesson,
    phase: "error",
    acknowledged: loadAcknowledged(storage)
  });
  assert.equal(stillNoError.acknowledgement, "none");
  assert.equal(stillNoError.status, null);
  assert.deepEqual(stillNoError.acknowledged, loadAcknowledged(storage));
});

test("C23 reduced motion and minimized stay quiet", () => {
  const reduced = quietFeedback({
    phase: "success",
    kind: "lesson-open",
    eventKey: "lesson-open:room:topic",
    acknowledged: [],
    reducedMotion: true,
    minimized: false
  });
  assert.equal(reduced.acknowledgement, "static");
  assert.equal(reduced.animate, false);
  assert.equal(reduced.status, "Lesson open");

  const minimized = quietFeedback({
    phase: "success",
    kind: "guide-ready",
    eventKey: "guide-ready:room:snap",
    acknowledged: [],
    reducedMotion: false,
    minimized: true
  });
  assert.equal(minimized.acknowledgement, "static");
  assert.equal(minimized.animate, false);
  assert.equal(minimized.status, "Guide ready");

  const both = quietFeedback({
    phase: "success",
    kind: "lesson-open",
    eventKey: "lesson-open:room:other",
    acknowledged: [],
    reducedMotion: true,
    minimized: true
  });
  assert.equal(both.acknowledgement, "static");
  assert.equal(both.animate, false);

  const again = quietFeedback({
    phase: "success",
    kind: "lesson-open",
    eventKey: "lesson-open:room:topic",
    acknowledged: reduced.acknowledged,
    reducedMotion: true,
    minimized: true
  });
  assert.equal(again.acknowledgement, "none");
  assert.equal(again.animate, false);
  assert.equal(again.status, null);

  const loading = quietFeedback({
    phase: "loading",
    kind: "guide-ready",
    eventKey: "guide-ready:room:snap",
    acknowledged: [],
    reducedMotion: true,
    minimized: true
  });
  assert.equal(loading.acknowledgement, "none");
  assert.equal(loading.status, null);
  assert.equal(loading.animate, false);

  const engine = readFileSync(join(here, "../components/companion/engine.ts"), "utf8");
  const acknowledge = /function acknowledgeQuiet\([\s\S]*?\n  \}/.exec(engine)?.[0] ?? "";
  assert.match(acknowledge, /quietFeedback\(/);
  assert.match(acknowledge, /reducedMotion: reduced/);
  assert.match(acknowledge, /minimized: rt\.mode !== "window"/);
  assert.match(acknowledge, /if \(decision\.animate\) pulse\("quietAck"/);
  assert.doesNotMatch(acknowledge, /burst\(|say\(|confetti|mastery/);
  assert.match(engine, /QUIET_FEEDBACK_EVENT/);

  const css = readFileSync(join(here, "../components/companion/companion.css"), "utf8");
  assert.match(css, /\.cmp\.quietAck \.cmpBody \{ animation: cmpNod/);
  assert.match(css, /\.lessonProgressRow/);
  const reducedCss = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reducedCss, /quietAck/);
  assert.match(reducedCss, /quietStatus/);
  assert.match(reducedCss, /animation: none !important/);

  const learn = readFileSync(join(here, "../components/room/learn-panel.tsx"), "utf8");
  assert.match(learn, /requestQuietAcknowledgement\(\{ phase, kind: "lesson-open", eventKey \}\)/);
  assert.match(learn, /lessonProgressRow/);
  assert.match(learn, /RichText className="lessonText"/);
  assert.doesNotMatch(learn, /disabled=\{[^}]*lessonQuiet/);

  const guide = readFileSync(join(here, "../components/room/guide-preview.tsx"), "utf8");
  assert.match(guide, /kind: "guide-ready"/);
  assert.match(guide, /lessonProgressRow/);
  assert.match(guide, /requestQuietAcknowledgement/);
  assert.doesNotMatch(guide, /disabled=\{[^}]*guideQuiet/);
});
