import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { GuidePreview } from "../components/room/guide-preview";
import { guidePreviewModel } from "./guide-preview";

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
  assert.match(html, /version 1/);
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
