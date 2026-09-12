import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { chunkPages, estimateTokens } from "./chunk";
import { extractPdf, extractPlainText, extractPptx, normalizeText, pagesNeedingOcr } from "./extract";
import { assertUploadAllowed, resolveMimeType, sanitizeFilename } from "./index";

async function buildPdf(pages: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const body of pages) {
    const page = pdf.addPage([600, 800]);
    page.drawText(body, { x: 40, y: 720, size: 12, font, lineHeight: 16, maxWidth: 520 });
  }
  const bytes = await pdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test("PDF extraction keeps one entry per page, in order", async () => {
  const buffer = await buildPdf([
    "Page one covers the water cycle and evaporation in detail.",
    "Page two covers condensation, precipitation, and collection."
  ]);

  const result = await extractPdf(buffer);
  assert.equal(result.pageCount, 2);
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages[0].pageNumber, 1);
  assert.match(result.pages[0].text, /water cycle/);
  assert.match(result.pages[1].text, /precipitation/);
  assert.equal(result.pageLabel, "page");
});

test("a page with no usable text layer is flagged for OCR", async () => {
  const buffer = await buildPdf([
    "",
    "This second page carries a full text layer, with more than enough readable characters on it to be studied directly without any OCR pass at all."
  ]);
  const result = await extractPdf(buffer);
  assert.deepEqual(pagesNeedingOcr(result), [1]);
});

test("PPTX extraction numbers slides and keeps speaker notes", async () => {
  const zip = new JSZip();
  const slide = (text: string) =>
    `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

  zip.file("ppt/slides/slide1.xml", slide("Tornado formation"));
  zip.file("ppt/slides/slide2.xml", slide("Supercell rotation"));
  zip.file("ppt/notesSlides/notesSlide2.xml", slide("Mention the updraft"));

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const result = await extractPptx(buffer);

  assert.equal(result.pageLabel, "slide");
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages[1].pageNumber, 2);
  assert.match(result.pages[1].text, /Supercell rotation/);
  assert.match(result.pages[1].text, /Speaker notes: Mention the updraft/);
});

test("chunks never span two pages, so every citation has one location", () => {
  const longPage = `${"Supercells produce rotating updrafts. ".repeat(120)}`;
  const chunks = chunkPages(
    [
      { pageNumber: 1, text: longPage },
      { pageNumber: 2, text: "A short but studiable second page about safety procedures." }
    ],
    { documentName: "Textbook", sourceType: "textbook", pageLabel: "page" }
  );

  assert.ok(chunks.length > 2, "a long page should split into several chunks");
  assert.deepEqual(
    chunks.map((chunk) => chunk.chunkIndex),
    chunks.map((_, index) => index)
  );
  for (const chunk of chunks) {
    assert.ok(chunk.pageNumber === 1 || chunk.pageNumber === 2);
    assert.ok(chunk.content.length <= 1800, "chunks stay near the embedding target size");
    assert.equal(chunk.metadata.documentName, "Textbook");
  }
});

test("pages with nothing to study are dropped rather than embedded", () => {
  const chunks = chunkPages(
    [
      { pageNumber: 1, text: "   \n  " },
      { pageNumber: 2, text: "Real content that a learner could actually be tested on later." }
    ],
    { documentName: "Notes", sourceType: "student_notes", pageLabel: "page" }
  );

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].pageNumber, 2);
});

test("plain text splits on headings and estimates tokens", () => {
  const result = extractPlainText(
    `# Unit 4\n${"Weather systems move across the region. ".repeat(20)}\n# Unit 5\nFronts and pressure.`
  );
  assert.ok(result.pages.length >= 1);
  assert.equal(result.pageLabel, "section");
  assert.ok(estimateTokens("abcd") >= 1);
});

test("normalizeText rejoins hyphenated line breaks", () => {
  assert.equal(normalizeText("condensa-\ntion happens"), "condensation happens");
});

test("upload validation trusts the extension when the browser sends nothing", () => {
  assert.equal(
    resolveMimeType({ type: "", name: "study-guide.docx" }),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(assertUploadAllowed({ type: "", name: "notes.pdf", size: 10 }), "application/pdf");
  assert.throws(() => assertUploadAllowed({ type: "", name: "virus.exe", size: 10 }));
  assert.throws(() => assertUploadAllowed({ type: "application/pdf", name: "a.pdf", size: 0 }));
  assert.equal(sanitizeFilename("Weather Unit — Study Guide.pdf"), "Weather-Unit-Study-Guide.pdf");
});
