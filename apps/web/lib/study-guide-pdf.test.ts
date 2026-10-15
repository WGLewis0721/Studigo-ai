import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { StudyGuideContent } from "@studigo/ai";
import { buildEditionPdf, editionIsRenderable, exportEditionFromLines, formatGuideDate, guideDownloadDecision } from "./study-guide-pdf";

const evidence = [{ blockKey: "guide", pageNumber: 1 }];
const long = "The legislative branch makes laws and writes the statutes citizens must follow. ".repeat(40);
const edition: StudyGuideContent = {
  version: 1,
  schemaVersion: 1,
  promptVersion: 1,
  level: "general",
  roomId: "room-1",
  topicIds: ["branches"],
  sourceSnapshot: "government",
  chapters: [{
    id: "chapter-1",
    title: "Three Branches of Government",
    objective: "Three Branches of Government",
    objectiveEvidence: evidence,
    facts: [
      { id: "f1", text: "The legislative branch makes laws.", evidence },
      { id: "f2", text: "The executive branch enforces laws.", evidence },
      { id: "f3", text: "The judicial branch reviews laws.", evidence },
      { id: "f4", text: "Señor García’s naïve résumé — “every vote counts”.", evidence },
      { id: "f5", text: "Branch | Role\nLegislative | makes laws\nExecutive | enforces laws\nJudicial | reviews laws", evidence },
      { id: "f6", text: long, evidence }
    ],
    terms: [{ id: "t1", term: "Every Vote Counts", definition: "A citizen's vote helps choose representatives.", evidence }],
    examples: [{ id: "e1", text: "For example, Congress writes a statute and the president carries it out.", evidence }],
    practice: [
      { id: "q1", prompt: "What does the legislative branch do?", answerId: "a1", evidence },
      { id: "q2", prompt: "What does the executive branch do?", answerId: "a2", evidence },
      { id: "q3", prompt: "What does the judicial branch do?", answerId: "a3", evidence }
    ],
    answers: [
      { id: "a1", questionId: "q1", text: "The legislative branch makes laws.", evidence },
      { id: "a2", questionId: "q2", text: "The executive branch enforces laws.", evidence },
      { id: "a3", questionId: "q3", text: "The judicial branch reviews laws.", evidence }
    ]
  }]
};

test("C18 government PDF keeps Unicode, pages, and a separate answer key", async () => {
  assert.equal(formatGuideDate("Invalid Date"), null);
  assert.equal(formatGuideDate("not-a-date"), null);
  assert.equal(editionIsRenderable(edition), true);
  const pdf = await buildEditionPdf(edition, {
    title: "Three Branches of Government",
    subject: "Civics",
    testDate: "Invalid Date",
    page: "letter"
  });
  writeFileSync("/tmp/c18-government.pdf", pdf);
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  const loaded = await PDFDocument.load(pdf);
  assert.ok(loaded.getPageCount() >= 2);
  const first = loaded.getPage(0).getSize();
  assert.equal(Math.round(first.width), 612);
  assert.equal(Math.round(first.height), 792);
  const a4 = await buildEditionPdf(edition, { title: "Three Branches of Government", page: "a4" });
  const a4Size = (await PDFDocument.load(a4)).getPage(0).getSize();
  assert.equal(Math.round(a4Size.height), 842);
});

test("C18 a foreign room downloads no PDF bytes", () => {
  const denied = guideDownloadDecision({ room: null, edition });
  assert.equal(denied.status, 404);
  assert.equal(denied.pdf, false);
  const body = JSON.stringify({ error: "Study Room not found", code: denied.code });
  assert.equal(body.includes("%PDF"), false);
  const missing = guideDownloadDecision({ room: { id: "room-1" }, edition: { version: 1, chapters: [] } });
  assert.equal(missing.status, 409);
  assert.equal(missing.pdf, false);
});

test("a ready worksheet of short lines is still a downloadable guide", () => {
  const exported = exportEditionFromLines("room-1", [
    { blockKey: "h", pageNumber: 5, text: "Homophones" },
    { blockKey: "a", pageNumber: 5, text: "Words such as instant, happy, and hyper" },
    { blockKey: "b", pageNumber: 6, text: "Spellings for the /u/ sound" }
  ]);
  const decision = guideDownloadDecision({ room: { id: "room-1" }, edition: exported });
  assert.equal(decision.pdf, true);
  if (decision.pdf) {
    assert.equal(decision.edition.chapters.length, 2);
    assert.equal(decision.edition.chapters[0].facts.length, 2);
  }
  assert.equal(editionIsRenderable(exported), true);
});
