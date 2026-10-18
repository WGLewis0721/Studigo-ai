import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { GuidePreview } from "../components/room/guide-preview";
import { guidePreviewModel } from "./guide-preview";
import { guideFactExcerpt, guideOutlineHeading, guideSourceSegments } from "./guide-outline";

const longTerm = "Antidisestablishmentarianism-and-the-legislative-branch-definition-that-must-wrap";
const edition: StudyGuideContent = {
  version: 1,
  schemaVersion: 1,
  promptVersion: 1,
  level: "general",
  roomId: "room-1",
  topicIds: ["branches"],
  sourceSnapshot: "snap",
  chapters: [{
    id: "chapter-1",
    title: "Three Branches of Government",
    objective: "Three Branches of Government",
    objectiveEvidence: [{ blockKey: "heading", pageNumber: 1 }],
    facts: [
      { id: "fact-1", text: "The legislative branch makes laws.", evidence: [{ blockKey: "laws", pageNumber: 1 }] },
      { id: "fact-2", text: "The executive branch enforces laws.", evidence: [{ blockKey: "enforce", pageNumber: 1 }] },
      { id: "fact-3", text: "The judicial branch reviews laws.", evidence: [{ blockKey: "review", pageNumber: 1 }] }
    ],
    terms: [{ id: "term-1", term: longTerm, definition: "A citizen's vote helps choose representatives.", evidence: [{ blockKey: "vote", pageNumber: 2 }] }],
    examples: [{ id: "example-1", text: "For example, Congress writes a statute and the president carries it out.", evidence: [{ blockKey: "example", pageNumber: 1 }] }],
    practice: [
      { id: "question-1", prompt: "What does the legislative branch do?", answerId: "answer-1", evidence: [{ blockKey: "laws", pageNumber: 1 }] },
      { id: "question-2", prompt: `What is ${longTerm}?`, answerId: "answer-2", evidence: [{ blockKey: "vote", pageNumber: 2 }] }
    ],
    answers: [
      { id: "answer-1", questionId: "question-1", text: "The legislative branch makes laws.", evidence: [{ blockKey: "laws", pageNumber: 1 }] },
      { id: "answer-2", questionId: "question-2", text: "Checked answer: a citizen's vote helps choose representatives.", evidence: [{ blockKey: "vote", pageNumber: 2 }] }
    ]
  }]
};

test("C17 preview matches the edition and hides the answer key", () => {
  const model = guidePreviewModel(edition);
  assert.deepEqual(model.chapters[0].facts, edition.chapters[0].facts.map((fact) => fact.text));
  assert.deepEqual(model.chapters[0].examples, edition.chapters[0].examples.map((example) => example.text));
  assert.deepEqual(model.chapters[0].terms, [{ term: longTerm, definition: "A citizen's vote helps choose representatives." }]);
  assert.deepEqual(model.chapters[0].practice, edition.chapters[0].practice.map((question) => question.prompt));
  assert.deepEqual(model.chapters[0].answers, edition.chapters[0].answers.map((answer) => answer.text));
  assert.equal(model.chapters[0].practice.includes(model.chapters[0].answers[1]), false);
  const html = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition }));
  assert.match(html, /The legislative branch makes laws/);
  assert.match(html, /What does the legislative branch do/);
  assert.match(html, /vote helps choose representatives/);
  assert.doesNotMatch(html, /Checked answer/);
  assert.match(html, /Show answers/);
  assert.match(html, /STUDIGO GUIDE · VERSION 1/);
  assert.match(html, /6 cited sources/);
  assert.match(html, /general/);
});

test("C17 compact preview links are keyboard reachable and do not generate", () => {
  const html = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition }));
  assert.match(html, /blockKey=laws/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, new RegExp(longTerm));
  assert.equal(html.includes("tabindex=\"-1\""), false);
  assert.match(html, /<a href=/);
  assert.doesNotMatch(html, /openai|generateChapter|STUDIGO_GUIDE_GENERATION/);
  assert.match(html, />Word</);
  assert.match(html, />Print</);
  assert.match(html, /Download study guide/);
});


test("Phase 3 guide exposes evidence for facts, terms, examples, and practice without revealing answers", () => {
  const html = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition, phase3Materials: true }));
  assert.equal((html.match(/class="materialsCitation"/g) ?? []).length, 7);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 7);
  assert.match(html, /aria-controls=/);
  assert.doesNotMatch(html, /Checked answer/);
});

test("Phase 3 answer reveal remains reversible and citations do not invent page zero", () => {
  const withoutPage = structuredClone(edition);
  withoutPage.chapters[0].facts[0].evidence[0].pageNumber = 0;
  const html = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition: withoutPage, phase3Materials: true, initialAnswersRevealed: true }));
  assert.match(html, /Hide answers/);
  assert.match(html, /Checked answer/);
  assert.match(html, />Check source passage<\/button>/);
  assert.doesNotMatch(html, /Source, page 0/);
  assert.equal((html.match(/class="materialsCitation"/g) ?? []).length, 9);
});

test("Guide preview distinguishes a pending load from a confirmed absent edition", () => {
  const loading = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", phase3Materials: true }));
  const absent = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition: null, phase3Materials: true }));
  assert.match(loading, /role="status"[^>]*>Loading your saved guide/);
  assert.doesNotMatch(loading, /No generated guide yet/);
  assert.match(absent, /No generated guide yet/);
  assert.match(absent, /original files remain available/);
});

test("Materials outlines long OCR headings without replacing their original wording or citations", () => {
  const long = "GOVERNMENT / STUDY MATERIALS Page 1 Our Government Vocabulary primary source — a record made by someone who was there secondary source — a later record made by someone else democracy — people vote to choose leaders";
  const result = guideOutlineHeading(long, 0);
  assert.equal(result.heading, "GOVERNMENT / STUDY MATERIALS");
  assert.equal(result.oversized, true);
  assert.deepEqual(guideOutlineHeading("Three Branches of Government", 0), { heading: "Three Branches of Government", oversized: false });
  const noisy = structuredClone(edition);
  noisy.chapters[0].title = long;
  noisy.chapters[0].facts[0].text = "The legislative branch makes laws. ".repeat(12);
  const html = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition: noisy, phase3Materials: true }));
  assert.match(html, /Your study outline/);
  assert.match(html, /<h3>GOVERNMENT \/ STUDY MATERIALS<\/h3>/);
  assert.match(html, /guideOutlinePoints/);
  assert.match(html, /guideOutlineTerms/);
  assert.match(html, /View original heading and source wording/);
  assert.match(html, /secondary source/); // Verbatim preserved in expandable original.
  assert.match(html, /Check source/);
  assert.doesNotMatch(html, /<h2>GOVERNMENT/);
  assert.doesNotMatch(html, /Checked answer/);
});

test("oversized source notes disclose exact wording rather than fabricating summaries", () => {
  const text = "People can learn by asking questions and reviewing their class notes. ".repeat(6);
  const summary = guideFactExcerpt(text, 175);
  assert.equal(summary.long, true);
  assert.ok(summary.excerpt.endsWith("…"));
  assert.ok(text.startsWith(summary.excerpt.slice(0, -1)));
  assert.equal(guideFactExcerpt("A short fact.").long, false);
  assert.deepEqual(guideOutlineHeading("  A short heading  ", 2), { heading: "A short heading", oversized: false });
});

test("OCR vocabulary outlines retain all original source wording in the original order", () => {
  const raw = "GOVERNMENT / STUDY MATERIALS Page 1 Our Government Vocabulary primary source — a record made by a person who was there secondary source — a record created after the event democracy — a form of government";
  const segments = guideSourceSegments(raw, ["primary source", "secondary source", "democracy"]);
  assert.equal(segments.join(""), raw, "no source characters are dropped or rewritten");
  assert.equal(segments.length, 4, "heading plus glossary definitions become readable separate blocks");
  assert.match(segments[1], /^primary source —/);
  assert.match(segments[2], /^secondary source —/);
  assert.match(segments[3], /^democracy —/);
});

test("long OCR without recognized vocabulary wraps without inventing facts", () => {
  const raw = ("facts in the original study material without reliable headings " ).repeat(20);
  const segments = guideSourceSegments(raw, []);
  assert.ok(segments.length >= 2);
  assert.equal(segments.join(""), raw);
  assert.ok(segments.every(segment => segment.length <= 240));
});
