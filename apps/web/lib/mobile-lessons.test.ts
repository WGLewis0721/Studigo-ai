import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonMobileFrame, keepIndependentSurfaces, lessonPositionLabel, retainSuccessfulLesson } from "../components/room/learn-panel";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../app/globals.css"), "utf8");
const coachPanel = readFileSync(join(here, "../components/room/coach-panel.tsx"), "utf8");
const engine = readFileSync(join(here, "../components/companion/engine.ts"), "utf8");
const citationName = "House-and-Senate-legislative-branch-study-guide-chapter-with-an-unbroken-name.pdf";
const threadRef: { current: HTMLDivElement | null } = { current: null };

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing ${start}`);
  return source.slice(from, to);
}

/** Enlarged text still wraps inside 320 and 390. No browser and no device. */
function citationBox(width: number, fontScale: number) {
  const fontSize = 16 * fontScale;
  const inner = width - 24;
  const natural = citationName.length * fontSize * 0.52;
  const used = Math.min(natural, inner);
  const buttonMin = Math.max(44, 2.75 * fontSize);
  const sideBySide = buttonMin * 2 + 8 <= inner;
  return {
    wraps: natural > inner,
    citationOverflow: used > inner,
    buttonOverflow: (sideBySide ? (inner - 8) / 2 : inner) > inner,
    buttonMin
  };
}

test("C21 compact lesson flow keeps label, Clear, Next, and a wrapping citation", () => {
  assert.equal(lessonPositionLabel(1, 6), "Lesson 2 of 6");
  const kept = { text: "The legislative branch makes laws." };
  const cursor = { learn: 1, coach: 0 };
  const afterFail = retainSuccessfulLesson({}, "branches", kept, null);
  assert.equal(afterFail.branches, kept);
  assert.deepEqual(cursor, { learn: 1, coach: 0 });
  const afterSuccess = retainSuccessfulLesson(afterFail, "branches", kept, { text: "newer laws" });
  assert.equal(afterSuccess.branches.text, "newer laws");
  assert.equal(retainSuccessfulLesson(afterSuccess, "branches", kept, null).branches.text, "newer laws");
  const surfaces = { lesson: kept, overview: null as { text: string } | null, coach: ["practice"] };
  const failedOverview = keepIndependentSurfaces(surfaces, { overview: null });
  assert.equal(failedOverview.lesson, surfaces.lesson);
  assert.equal(failedOverview.coach, surfaces.coach);
  const opened = keepIndependentSurfaces(surfaces, { overview: { text: "Six topics." } });
  assert.equal(opened.lesson, surfaces.lesson);
  assert.equal(opened.coach, surfaces.coach);
  assert.equal(opened.overview?.text, "Six topics.");

  const load = sliceBetween(coachPanel, "async function loadCursorLesson", "async function teachSelected");
  assert.equal(load.includes("setCursors"), false);
  assert.equal(load.includes("setOverviewDoc"), false);
  const overview = sliceBetween(coachPanel, "async function teachSelected", "async function coach(");
  assert.equal(overview.includes("setLessonCache"), false);
  assert.equal(overview.includes("setCursors"), false);
  assert.equal(overview.includes("setMessagesByMode"), false);

  const html = renderToStaticMarkup(createElement(LessonMobileFrame, {
    mode: "learn",
    label: "Lesson 2 of 6",
    topicTitle: "Branches of government",
    text: "The legislative branch makes laws.",
    citations: [{ documentId: "doc-1", documentName: citationName, pageNumber: 2, pageLabel: "page" }],
    onClear() {},
    onNext() {},
    threadRef,
    onScroll() {},
    children: null
  }));
  assert.match(html, /data-lesson-label/);
  assert.match(html, /Lesson 2 of 6/);
  assert.match(html, /Branches of government/);
  assert.match(html, /data-lesson-actions/);
  assert.match(html, />Clear</);
  assert.match(html, />Next</);
  assert.match(html, new RegExp(citationName.replace(/[.]/g, "\\.")));
  assert.match(html, /class="[^"]*lessonCitations/);
  assert.equal(html.includes("overflow:hidden"), false);
  assert.match(css, /\.lessonCitations \.sourceStack,\s*\n\.coachChat \.sourceStack \{\s*display: flex; flex-wrap: wrap; overflow: visible;/);
  assert.match(css, /\.lessonActions \{\s*display: flex; flex-wrap: wrap;/);
  assert.match(css, /min-height: max\(44px, 2\.75rem\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  // Phone actions intentionally move from the legacy footer to the visible compact nav and composer dock.
  assert.match(css, /\.coachChat \.lessonActions \{ display: none; \}/);
  assert.match(coachPanel, /className="coachPhoneNav"/);
  assert.match(coachPanel, /className="chatEraser"/);
  assert.match(coachPanel, /"Previous lesson"/);
  assert.match(coachPanel, /"Next lesson"/);
  assert.doesNotMatch(css, /\.lessonCitations[^{]*\{[^}]*overflow:\s*hidden/);
  for (const width of [320, 390]) {
    for (const scale of [1, 1.5]) {
      const box = citationBox(width, scale);
      assert.equal(box.wraps, true, `${width}px at ${scale} text wraps the citation`);
      assert.equal(box.citationOverflow, false);
      assert.equal(box.buttonOverflow, false);
      assert.ok(box.buttonMin >= 44);
    }
  }
});

test("C21 iPad focus names mode and topic and keeps the action row", () => {
  const learn = renderToStaticMarkup(createElement(LessonMobileFrame, {
    mode: "learn",
    label: "Lesson 2 of 6",
    topicTitle: "Branches of government",
    text: "The legislative branch makes laws.",
    citations: [],
    onClear() {},
    onNext() {},
    threadRef,
    onScroll() {},
    children: null
  }));
  const coach = renderToStaticMarkup(createElement(LessonMobileFrame, {
    mode: "coach",
    label: null,
    topicTitle: "The executive branch",
    text: null,
    citations: [],
    onClear() {},
    onNext() {},
    threadRef,
    onScroll() {},
    children: null
  }));
  assert.match(learn, /aria-label="Learn, Branches of government"/);
  assert.match(learn, /aria-label="Learn actions for Branches of government"/);
  assert.match(learn, /aria-label="Clear Learn for Branches of government"/);
  assert.match(learn, /aria-label="Next lesson for Branches of government"/);
  assert.match(learn, /data-lesson-actions/);
  assert.match(coach, /aria-label="Coach, The executive branch"/);
  assert.match(coach, /aria-label="Clear Coach for The executive branch"/);
  assert.match(coach, /aria-label="Next topic for The executive branch"/);
  assert.match(coach, /data-lesson-actions/);
  assert.match(coachPanel, /aria-label=\{`Coach, practice, \$\{coachTopicTitle\}`\}/);
  assert.match(coachPanel, /aria-label=\{`Learn, \$\{learnLabel \?\? "lesson"\}, \$\{learnTopicTitle\}`\}/);
  assert.match(coachPanel, /ariaLabel=\{chatMode === "learn" \? `Message Learn about \$\{learnTopicTitle\}` : `Message Coach about \$\{coachTopicTitle\}`\}/);
  assert.match(css, /@media \(min-width: 701px\) and \(max-width: 1100px\) \{\s*\n {2}\.lessonActions \{ display: flex; flex: none; position: relative; z-index: 4; overflow: visible; \}/);
  assert.match(css, /\.roomWorkspace \.lessonActions,\s*\n\.roomWorkspace \.lessonCitations \{ margin-left: var\(--dock-l, 0px\); margin-right: var\(--dock-r, 0px\); \}/);
  assert.match(engine, /\.chatComposer, \.chatChips, \.chatError, \.lessonActions, \.lessonCitations/);
  assert.match(engine, /MIN_SCALE/);
  assert.equal(learn.includes("cmp"), false);
  assert.equal(coach.includes("class=\"cmp"), false);
  assert.doesNotMatch(css, /\.cmp\[data-state="seat"\][^{]*\.lessonActions/);
});
