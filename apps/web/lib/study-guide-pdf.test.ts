import assert from "node:assert/strict";
import test from "node:test";
import { buildStudyGuidePdf } from "./study-guide-pdf";

test("buildStudyGuidePdf creates a real PDF with grounded topic content", () => {
  const pdf = buildStudyGuidePdf({
    title: "Fifth Grade Science",
    subject: "Science",
    courseName: "Ms. Rivera",
    testDate: "September 30, 2026",
    topics: [
      {
        title: "States of water",
        objective: "Identify the solid, liquid, and gas forms of water.",
        keyTerms: ["ice", "liquid water", "water vapor"],
        sourceNotes: [
          {
            text: "Water can exist as ice, liquid water, or water vapor depending on temperature.",
            documentName: "Unit 2 Study Guide.pdf",
            pageNumber: 2,
            pageLabel: "page"
          }
        ]
      }
    ]
  });

  const text = Buffer.from(pdf).toString("ascii");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.includes("Fifth Grade Science"));
  assert.ok(text.includes("States of water"));
  assert.ok(text.includes("Unit 2 Study Guide.pdf"));
  assert.ok(text.includes("Check yourself"));
  assert.ok(text.endsWith("%%EOF\n"));
});
