import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { extractPdf, pageWithOcrTranscription, pagesNeedingOcr, pdfPageQualityIssues } from "./extract";
import type { ExtractionResult } from "./types";

test("original government guide page facts stay in reading order without unnecessary OCR", async () => {
  const path = process.env.STUDIGO_C07_GOVERNMENT_PDF;
  assert.ok(path, "Set STUDIGO_C07_GOVERNMENT_PDF to the supplied source; never commit learner material");
  const bytes = await readFile(path);
  const result = await extractPdf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(result.pageCount, 3);
  assert.deepEqual(pagesNeedingOcr(result), []);
  assert.match(result.pages[0].text, /primary source/i);
  assert.match(result.pages[0].text, /secondary source/i);
  assert.match(result.pages[1].text, /executive/i);
  assert.match(result.pages[1].text, /legislative/i);
  assert.match(result.pages[1].text, /judicial/i);
  assert.match(result.pages[1].text, /Supreme Court/i);
  assert.match(result.pages[2].text, /Every Vote Counts/i);
  assert.ok(result.pages.every((page) => page.rawText !== undefined));
});

test("quality selection flags corrupt layers and OCR replaces rather than duplicates them", () => {
  const healthy = { pageNumber: 1, text: "The Constitution establishes three branches of government. The executive branch enforces laws, the legislative branch makes laws, and the judicial branch reviews them. Each has a distinct role in the government." };
  const corrupt = { pageNumber: 2, text: "UnitedStatesConstitutionEstablishesThreeBranchesExecutiveLegislativeJudicialGovernment".repeat(3), rawText: "corrupt original layer" };
  const glyphs = { pageNumber: 3, text: `The judiciary compares laws to the Constitution. ${"�".repeat(8)} The Supreme Court includes judges and reviews fairness.` };
  const spaced = { pageNumber: 4, text: `U n i t e d S t a t e s C o n s t i t u t i o n ${"Government branches are on this page. ".repeat(4)}` };
  const result: ExtractionResult = { pages: [healthy, corrupt, glyphs, spaced], pageCount: 4, pageLabel: "page", ocrPageCount: 0 };
  assert.deepEqual(pdfPageQualityIssues(healthy), []);
  assert.deepEqual(pagesNeedingOcr(result), [2, 3, 4]);
  assert.deepEqual(pagesNeedingOcr(result, { includeQuality: false }), []);
  const recovered = pageWithOcrTranscription(corrupt, "# The three branches\nExecutive | enforces laws\nLegislative | makes laws\nJudicial | reviews laws");
  assert.equal(recovered.ocr, true);
  assert.equal(recovered.rawText, "corrupt original layer");
  assert.match(recovered.text, /^# The three branches\nExecutive \| enforces laws/);
  assert.doesNotMatch(recovered.text, /UnitedStatesConstitution/);
  assert.throws(() => pageWithOcrTranscription(corrupt, "   "), /no readable text/);
});
