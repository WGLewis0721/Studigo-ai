import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import type { ExtractedPage, ExtractionResult } from "./types";

/**
 * Below this many characters a PDF page is treated as image-only, which means
 * the text layer is missing and the page needs OCR to be studiable.
 */
export const OCR_TEXT_THRESHOLD = 90;

export function normalizeText(input: string) {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    // Words split across a line break by hyphenation.
    .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages: ExtractedPage[] = (text as string[]).map((raw, index) => ({
    pageNumber: index + 1,
    text: normalizeText(raw ?? "")
  }));

  return {
    pages,
    pageCount: totalPages ?? pages.length,
    pageLabel: "page",
    ocrPageCount: 0
  };
}

/**
 * Pages whose text layer is too thin to study from. The ingestion worker hands
 * these to OCR; everything else is used as-is.
 */
export function pagesNeedingOcr(result: ExtractionResult) {
  return result.pages
    .filter((page) => page.text.replace(/\s/g, "").length < OCR_TEXT_THRESHOLD)
    .map((page) => page.pageNumber);
}

/** Isolates one page as its own small PDF so it can be sent to an OCR model. */
export async function extractSinglePagePdf(
  buffer: ArrayBuffer,
  pageNumber: number
): Promise<Uint8Array> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const target = await PDFDocument.create();
  const [copied] = await target.copyPages(source, [pageNumber - 1]);
  target.addPage(copied);
  return target.save();
}

export async function extractDocx(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
  const text = normalizeText(htmlToStudyText(value));
  const pages = splitIntoSections(text).map((section, index) => ({
    pageNumber: index + 1,
    text: section
  }));

  return {
    pages: pages.length ? pages : [{ pageNumber: 1, text }],
    pageCount: Math.max(1, pages.length),
    pageLabel: "section",
    ocrPageCount: 0
  };
}

export async function extractPptx(buffer: ArrayBuffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const pages: ExtractedPage[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const notesName = name.replace("ppt/slides/", "ppt/notesSlides/").replace("slide", "notesSlide");
    const notesXml = zip.files[notesName] ? await zip.files[notesName].async("string") : "";
    const body = [xmlToText(xml), notesXml ? `Speaker notes: ${xmlToText(notesXml)}` : ""]
      .filter(Boolean)
      .join("\n\n");

    pages.push({ pageNumber: slideNumber(name), text: normalizeText(body) });
  }

  return { pages, pageCount: pages.length, pageLabel: "slide", ocrPageCount: 0 };
}

export function extractPlainText(text: string): ExtractionResult {
  const normalized = normalizeText(text);
  const pages = splitIntoSections(normalized).map((section, index) => ({
    pageNumber: index + 1,
    text: section
  }));

  return {
    pages: pages.length ? pages : [{ pageNumber: 1, text: normalized }],
    pageCount: Math.max(1, pages.length),
    pageLabel: "section",
    ocrPageCount: 0
  };
}

function slideNumber(name: string) {
  return Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
}

/** Pulls the run text out of an OOXML part without a full XML parser. */
function xmlToText(xml: string) {
  const paragraphs = xml.split(/<a:p[ >]/).slice(1);
  return paragraphs
    .map((paragraph) =>
      [...paragraph.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXmlEntities(match[1]))
        .join("")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Keeps DOCX structure that matters for studying: headings, lists, tables. */
function htmlToStudyText(html: string) {
  return html
    .replace(/<h([1-6])[^>]*>/g, (_match, level: string) => `\n\n${"#".repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/li>/g, "")
    .replace(/<\/p>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/tr>/g, "\n")
    .replace(/<\/t[dh]>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Flow formats have no pages, so citations point at headed sections instead —
 * a location a learner can actually find by scrolling to a heading.
 */
function splitIntoSections(text: string): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && current.join("\n").trim().length > 400) {
      sections.push(current.join("\n").trim());
      current = [];
    }
    current.push(line);
  }
  if (current.join("\n").trim()) sections.push(current.join("\n").trim());

  // Nothing useful to split on: fall back to fixed-size sections.
  if (sections.length <= 1 && text.length > 6000) {
    const chunked: string[] = [];
    for (let index = 0; index < text.length; index += 6000) {
      chunked.push(text.slice(index, index + 6000).trim());
    }
    return chunked.filter(Boolean);
  }

  return sections.filter(Boolean);
}
