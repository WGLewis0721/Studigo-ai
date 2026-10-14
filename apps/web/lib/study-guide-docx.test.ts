import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import test from "node:test";
import type { StudyGuideContent } from "@studigo/ai";
import { buildEditionPdf, guideDownloadDecision } from "./study-guide-pdf";
import { buildEditionDocx, guideFileFormat } from "./study-guide-docx";

const evidence = [{ blockKey: "guide", pageNumber: 1 }];
const long = "The legislative branch makes laws and writes the statutes citizens must follow. ".repeat(30);
const definition = "A citizen's vote helps choose representatives.";
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
      { id: "f5", text: "Branch | Role\nLegislative | makes laws\nExecutive | enforces laws", evidence },
      { id: "f6", text: long, evidence }
    ],
    terms: [{ id: "t1", term: "Every Vote Counts", definition, evidence }],
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

test("C19 Word file matches the PDF edition and stays editable", async () => {
  const docx = await buildEditionDocx(edition, { title: "Three Branches of Government", subject: "Civics", testDate: "Invalid Date" });
  const pdf = await buildEditionPdf(edition, { title: "Three Branches of Government", subject: "Civics", testDate: "Invalid Date" });
  writeFileSync("/tmp/c19-government.docx", docx);
  writeFileSync("/tmp/c19-government.pdf", pdf);
  const report = execFileSync("python3", ["-c", `
import zipfile, html, pymupdf
xml = html.unescape(zipfile.ZipFile("/tmp/c19-government.docx").read("word/document.xml").decode("utf-8"))
pdf = "\\n".join(page.get_text() for page in pymupdf.open("/tmp/c19-government.pdf"))
needles = [
  "The legislative branch makes laws.",
  "The executive branch enforces laws.",
  "The judicial branch reviews laws.",
  "Señor García’s naïve résumé",
  "A citizen's vote helps choose representatives.",
  "What does the legislative branch do?",
  "Every Vote Counts",
  "Answer key",
  "makes laws"
]
missing = [item for item in needles if item not in xml or item not in pdf]
print("MISSING", " | ".join(missing))
print("DRAWING", "w:drawing" in xml)
print("TABLE", "<w:tbl" in xml)
print("HEADING", "Heading1" in xml)
print("PAGE", "w:type=\\"page\\"" in xml)
print("INVALID", "Invalid Date" in xml or "Invalid Date" in pdf)
print("TEXT", "<w:t" in xml)
`], { encoding: "utf8" });
  assert.match(report, /MISSING\s*$/m);
  assert.match(report, /DRAWING False/);
  assert.match(report, /TABLE True/);
  assert.match(report, /HEADING True/);
  assert.match(report, /PAGE True/);
  assert.match(report, /INVALID False/);
  assert.match(report, /TEXT True/);
});

test("C19 a bad format or foreign room returns no file", () => {
  assert.equal(guideFileFormat("slides"), null);
  assert.equal(guideFileFormat("docx"), "docx");
  const denied = guideDownloadDecision({ room: null, edition });
  assert.equal(denied.status, 404);
  assert.equal(denied.pdf, false);
  const body = JSON.stringify({ error: "Study Room not found", code: denied.code });
  assert.equal(body.startsWith("PK"), false);
  assert.equal(body.includes("%PDF"), false);
});
