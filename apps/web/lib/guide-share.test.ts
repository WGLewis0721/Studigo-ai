import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { StudyGuideContent } from "@studigo/ai";
import { GuidePreview } from "../components/room/guide-preview";
import { decideGuideExport, guidePrintEdition, guideSharePayload, isShareCancellation } from "./guide-share";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const signedUrl = "https://project.supabase.co/storage/v1/object/sign/study-materials/source.pdf?token=sekret";
const blobUrl = "blob:https://studigo.app/8c2e-private";

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
    terms: [{ id: "term-1", term: "Representation", definition: "A citizen's vote helps choose representatives.", evidence: [{ blockKey: "vote", pageNumber: 2 }] }],
    examples: [{ id: "example-1", text: "For example, Congress writes a statute and the president carries it out.", evidence: [{ blockKey: "example", pageNumber: 1 }] }],
    practice: [{ id: "question-1", prompt: "What does the legislative branch do?", answerId: "answer-1", evidence: [{ blockKey: "laws", pageNumber: 1 }] }],
    answers: [{ id: "answer-1", questionId: "question-1", text: "Checked answer: the legislative branch makes laws.", evidence: [{ blockKey: "laws", pageNumber: 1 }] }]
  }]
};

function publicStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") found.push(value);
  else if (typeof File !== "undefined" && value instanceof File) found.push(value.name, value.type);
  else if (Array.isArray(value)) for (const item of value) publicStrings(item, found);
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      found.push(key);
      publicStrings(item, found);
    }
  }
  return found;
}

test("C22 supported share returns the file, unsupported browsers download, and cancel is not an error", async () => {
  const source = readFileSync(new URL("./guide-share.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /openai|generateChapter|STUDIGO_GUIDE_GENERATION/);
  assert.equal(process.env.STUDIGO_GUIDE_GENERATION, undefined);

  const shared = decideGuideExport({
    inFlight: false,
    canShare: true,
    cancelled: false,
    format: "pdf",
    filename: "Government-Study-Guide.pdf",
    bytes: pdfBytes
  });
  assert.equal(shared.action, "share-file");
  if (shared.action !== "share-file") return;
  assert.ok(shared.file instanceof File);
  assert.equal(shared.file.name, "Government-Study-Guide.pdf");
  assert.equal(shared.file.type, "application/pdf");
  assert.deepEqual(new Uint8Array(await shared.file.arrayBuffer()), pdfBytes);

  const word = decideGuideExport({
    inFlight: false,
    canShare: true,
    cancelled: false,
    format: "docx",
    filename: "Government-Study-Guide.docx",
    bytes: docxBytes
  });
  assert.equal(word.action, "share-file");
  if (word.action !== "share-file") return;
  assert.equal(word.file.name, "Government-Study-Guide.docx");
  assert.equal(word.file.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.deepEqual(new Uint8Array(await word.file.arrayBuffer()), docxBytes);

  const fallback = decideGuideExport({
    inFlight: false,
    canShare: false,
    cancelled: false,
    format: "pdf",
    filename: "Government-Study-Guide.pdf",
    bytes: pdfBytes
  });
  assert.equal(fallback.action, "download");
  if (fallback.action !== "download") return;
  assert.equal(fallback.filename, "Government-Study-Guide.pdf");
  assert.equal(fallback.file.type, "application/pdf");

  const cancelled = decideGuideExport({
    inFlight: false,
    canShare: true,
    cancelled: true,
    format: "docx",
    filename: "Government-Study-Guide.docx",
    bytes: docxBytes
  });
  assert.equal(cancelled.action, "ignore-cancel");
  assert.equal("message" in cancelled, false);
  assert.equal(isShareCancellation(Object.assign(new Error("Share canceled"), { name: "AbortError" })), true);

  const duplicate = decideGuideExport({
    inFlight: true,
    canShare: true,
    cancelled: false,
    format: "pdf",
    filename: "Government-Study-Guide.pdf",
    bytes: pdfBytes
  });
  assert.equal(duplicate.action, "reject-inflight");

  const failure = decideGuideExport({
    inFlight: false,
    canShare: true,
    cancelled: false,
    failed: true,
    format: "pdf",
    message: "Could not share the study guide."
  });
  assert.equal(failure.action, "error");
  if (failure.action === "error") assert.equal(failure.message, "Could not share the study guide.");
});

test("C22 print includes the edition and the answer key only when revealed, and share has no blob or signed URL", () => {
  const hidden = guidePrintEdition(edition, false);
  assert.match(hidden, /The legislative branch makes laws/);
  assert.match(hidden, /What does the legislative branch do/);
  assert.match(hidden, /Congress writes a statute/);
  assert.doesNotMatch(hidden, /Checked answer/);

  const revealed = guidePrintEdition(edition, true);
  assert.match(revealed, /The executive branch enforces laws/);
  assert.match(revealed, /Checked answer: the legislative branch makes laws/);
  assert.doesNotMatch(revealed, /blob:/);
  assert.doesNotMatch(revealed, /token=/);
  assert.doesNotMatch(revealed, /\/object\/sign\//);

  const concealed = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition }));
  assert.match(concealed, /guidePrintSheet/);
  assert.match(concealed, /The legislative branch makes laws/);
  assert.match(concealed, />Print</);
  assert.doesNotMatch(concealed, /Checked answer/);
  assert.doesNotMatch(concealed, /blob:/);

  const opened = renderToStaticMarkup(createElement(GuidePreview, { roomId: "room-1", edition, initialAnswersRevealed: true }));
  assert.match(opened, /guidePrintSheet[\s\S]*Checked answer: the legislative branch makes laws/);
  assert.match(opened, /guideAnswerKey/);
  assert.doesNotMatch(opened, /blob:/);
  assert.doesNotMatch(opened, /token=/);

  const shared = decideGuideExport({
    inFlight: false,
    canShare: true,
    cancelled: false,
    format: "pdf",
    filename: "Government-Study-Guide.pdf",
    bytes: pdfBytes,
    links: { blobUrl, signedUrl }
  });
  assert.equal(shared.action, "share-file");
  if (shared.action !== "share-file") return;
  const payload = guideSharePayload(shared.file, `${blobUrl} ${signedUrl}`);
  assert.equal("url" in payload, false);
  assert.deepEqual(Object.keys(payload).sort(), ["files", "title"]);
  const visible = publicStrings(payload).join("\n");
  assert.doesNotMatch(visible, /blob:/);
  assert.doesNotMatch(visible, /token=/);
  assert.doesNotMatch(visible, /signedUrl|\/object\/sign\/|X-Amz-/i);
  assert.equal(payload.title, "Government-Study-Guide.pdf");
});
