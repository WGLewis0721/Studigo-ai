import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { chunkPages } from "./chunk";
import { extractPdf, pagesNeedingOcr } from "./extract";
import { PdfOcrPageError, recoverPdfPages } from "./ocr-recovery";

/** Synthetic source without a text layer, not the private government PDF. */
async function scannedLikePdf() {
  const document = await PDFDocument.create();
  for (let index = 0; index < 3; index += 1) {
    const page = document.addPage([600, 800]);
    page.drawRectangle({ x: 30, y: 100, width: 540, height: 600 });
  }
  const bytes = await document.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const syntheticTranscriptions = [
  "Primary sources are original records. Secondary sources explain or analyze those records.",
  "The executive branch enforces laws. The legislative branch makes laws. The judicial branch reviews laws. The Supreme Court belongs to the judicial branch.",
  "Every Vote Counts. Citizens can participate in government by voting in elections."
] as const;

test("C07 synthetic no-text PDF recovers three citable pages with a mocked OCR provider", async () => {
  const buffer = await scannedLikePdf();
  const originalByteLength = buffer.byteLength;
  const extraction = await extractPdf(buffer);
  assert.equal(buffer.byteLength, originalByteLength, "PDF extraction must not detach bytes needed for OCR");
  assert.equal(extraction.pageCount, 3);
  assert.deepEqual(pagesNeedingOcr(extraction), [1, 2, 3]);

  const invocations: number[] = [];
  const recovered = await recoverPdfPages({
    extraction,
    buffer,
    targetPages: pagesNeedingOcr(extraction),
    transcribePage: async ({ pdf, pageNumber }) => {
      invocations.push(pageNumber);
      const onePage = await PDFDocument.load(pdf);
      assert.equal(onePage.getPageCount(), 1, "each paid call receives only one original page");
      return syntheticTranscriptions[pageNumber - 1]!;
    }
  });

  assert.deepEqual(invocations, [1, 2, 3]);
  assert.equal(recovered.ocrPageCount, 3);
  assert.deepEqual(recovered.pages.map((page) => page.pageNumber), [1, 2, 3]);
  assert.ok(recovered.pages.every((page) => page.ocr && page.rawText !== undefined));

  // This exercises the production page chunker and simulates searchable rows.
  // It does not simulate Supabase pgvector, the Learn API, or real OCR quality.
  const indexed = chunkPages(recovered.pages, {
    documentName: "synthetic-government.pdf", sourceType: "study_guide", pageLabel: "page"
  });
  assert.equal(indexed.length, 3);
  assert.ok(indexed.every((chunk) => chunk.metadata.ocr === true));
  assert.deepEqual(indexed.map((chunk) => chunk.pageNumber), [1, 2, 3]);

  for (const [term, expectedPage] of [
    ["primary sources", 1], ["secondary sources", 1], ["executive", 2],
    ["legislative", 2], ["judicial", 2], ["Supreme Court", 2], ["Every Vote Counts", 3]
  ] as const) {
    const matches = indexed.filter((row) => row.content.toLowerCase().includes(term.toLowerCase()));
    assert.equal(matches.length, 1, `expected one citable mock-index row for ${term}`);
    assert.equal(matches[0]?.pageNumber, expectedPage, `wrong source page for ${term}`);
  }
});

test("C07 page-three OCR failure rejects the entire result without publishing incomplete evidence", async () => {
  const buffer = await scannedLikePdf();
  const extraction = await extractPdf(buffer);
  const completedPages: number[] = [];
  let returnedResult = false;
  try {
    await recoverPdfPages({
      extraction,
      buffer,
      targetPages: pagesNeedingOcr(extraction),
      transcribePage: async ({ pageNumber }) => {
        if (pageNumber === 3) throw new Error("Synthetic provider failure");
        completedPages.push(pageNumber);
        return syntheticTranscriptions[pageNumber - 1]!;
      }
    });
    returnedResult = true;
  } catch (error) {
    assert.ok(error instanceof PdfOcrPageError);
    assert.equal(error.pageNumber, 3, `Unexpected synthetic failure: ${error.originalError instanceof Error ? error.originalError.message : String(error.originalError)}`);
    assert.equal(error.message, "OCR could not process Page 3");
    assert.doesNotMatch(error.message, /provider failure/i);
  }
  assert.equal(returnedResult, false);
  assert.deepEqual(completedPages, [1, 2]);
  assert.ok(extraction.pages.every((page) => !page.ocr && !page.text.trim()));
});

test("C07 invalid page selection fails before initiating OCR", async () => {
  const buffer = await scannedLikePdf();
  const extraction = await extractPdf(buffer);
  let calls = 0;
  await assert.rejects(recoverPdfPages({
    extraction,
    buffer,
    targetPages: [1, 1],
    transcribePage: async () => {
      calls += 1;
      return "Unexpected transcription";
    }
  }), /Invalid OCR page selection/);
  assert.equal(calls, 0);
});
