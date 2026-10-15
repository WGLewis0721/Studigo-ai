import { readFileSync } from "node:fs";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { StudyGuideContent } from "@studigo/ai";

export type StudyGuideSourceNote = {
  text: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel?: string | null;
};

export type StudyGuideTopic = {
  title: string;
  objective: string | null;
  keyTerms: string[];
  sourceNotes: StudyGuideSourceNote[];
};

export type StudyGuidePdfInput = {
  title: string;
  subject?: string | null;
  courseName?: string | null;
  testDate?: string | null;
  topics: StudyGuideTopic[];
};

export type GuidePageFormat = "letter" | "a4";

const MARGIN = 54;
const BODY = 12.5;
const BODY_LEADING = 19;
const HEADING = 22;
const TITLE = 24;

export function formatGuideDate(value: string | null | undefined): string | null {
  if (!value || /invalid date/i.test(value)) return null;
  const parsed = new Date(value.includes("T") ? value : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function editionIsRenderable(value: unknown): value is StudyGuideContent {
  if (!value || typeof value !== "object") return false;
  const content = value as StudyGuideContent;
  if (content.version !== 1 || !Array.isArray(content.chapters) || content.chapters.length === 0) return false;
  return content.chapters.every((chapter) => {
    if (!chapter.title || !Array.isArray(chapter.facts) || !Array.isArray(chapter.answers) || !Array.isArray(chapter.practice)) return false;
    return chapter.answers.every((answer) => {
      const question = chapter.practice.find((item) => item.id === answer.questionId);
      return Boolean(answer.text && question && question.answerId === answer.id);
    });
  });
}

/** A printable copy of the ready file. Short worksheet lines stay in the guide. */
export function exportEditionFromLines(
  roomId: string,
  lines: Array<{ blockKey: string; pageNumber: number; text: string }>
): StudyGuideContent | null {
  const pages = new Map<number, Array<{ blockKey: string; pageNumber: number; text: string }>>();
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (text.length < 2) continue;
    const pageNumber = line.pageNumber > 0 ? line.pageNumber : 1;
    const page = pages.get(pageNumber) ?? [];
    page.push({ blockKey: line.blockKey, pageNumber, text });
    pages.set(pageNumber, page);
  }
  const chapters = [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([pageNumber, page]) => ({
    id: `page-${pageNumber}`,
    title: `Page ${pageNumber}`,
    objective: "",
    objectiveEvidence: [] as Array<{ blockKey: string; pageNumber: number }>,
    facts: page.map((line, index) => ({
      id: `p${pageNumber}-f${index + 1}`,
      text: line.text,
      evidence: [{ blockKey: line.blockKey, pageNumber }]
    })),
    terms: [],
    examples: [],
    practice: [],
    answers: []
  }));
  if (!chapters.length) return null;
  return {
    version: 1,
    schemaVersion: 1,
    promptVersion: 1,
    level: "general",
    roomId,
    topicIds: [],
    sourceSnapshot: "source-export",
    chapters
  };
}

export function guideDownloadDecision(input: { room: { id: string } | null; edition: unknown }) {
  if (!input.room) return { status: 404 as const, code: "room_not_found", pdf: false as const };
  if (!editionIsRenderable(input.edition)) return { status: 409 as const, code: "no_valid_edition", pdf: false as const };
  return { status: 200 as const, pdf: true as const, edition: input.edition };
}

function pageBox(format: GuidePageFormat) {
  return format === "a4" ? { width: 595.28, height: 841.89 } : { width: 612, height: 792 };
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type Draw = {
  doc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
};

function newPage(draw: Draw) {
  draw.page.drawText(String(draw.pageNumber), {
    x: draw.width / 2 - 6,
    y: 28,
    size: 10,
    font: draw.font,
    color: rgb(0.2, 0.2, 0.2)
  });
  draw.page = draw.doc.addPage([draw.width, draw.height]);
  draw.pageNumber += 1;
  draw.y = draw.height - MARGIN;
}

function ensure(draw: Draw, needed: number) {
  if (draw.y - needed < MARGIN) newPage(draw);
}

function writeLines(draw: Draw, lines: string[], size: number, leading: number, indent = 0) {
  for (const line of lines) {
    ensure(draw, leading);
    draw.page.drawText(line, {
      x: MARGIN + indent,
      y: draw.y - size,
      size,
      font: draw.font,
      color: rgb(0, 0, 0)
    });
    draw.y -= leading;
  }
}

function writeParagraph(draw: Draw, text: string, size = BODY, leading = BODY_LEADING, indent = 0) {
  const width = draw.width - MARGIN * 2 - indent;
  writeLines(draw, wrap(draw.font, text, size, width), size, leading, indent);
}

function writeTable(draw: Draw, rows: string[][]) {
  const columns = Math.max(...rows.map((row) => row.length), 1);
  const tableWidth = draw.width - MARGIN * 2;
  const columnWidth = tableWidth / columns;
  for (const row of rows) {
    const wrapped = row.map((cell) => wrap(draw.font, cell, 11, columnWidth - 8));
    const height = Math.max(...wrapped.map((lines) => lines.length), 1) * 16 + 8;
    ensure(draw, height);
    const top = draw.y;
    draw.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: tableWidth,
      height,
      borderColor: rgb(0.35, 0.35, 0.35),
      borderWidth: 0.6,
      color: rgb(1, 1, 1)
    });
    wrapped.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        draw.page.drawText(line, {
          x: MARGIN + columnWidth * index + 4,
          y: top - 16 - lineIndex * 16,
          size: 11,
          font: draw.font,
          color: rgb(0, 0, 0)
        });
      });
    });
    draw.y = top - height - 8;
  }
}

function blocksFromEdition(content: StudyGuideContent, meta: { title: string; detail: string | null }) {
  const blocks: Array<{ kind: "title" | "h2" | "body" | "term" | "example" | "table" | "source" | "break"; text: string; extra?: string }> = [];
  blocks.push({ kind: "title", text: meta.title });
  if (meta.detail) blocks.push({ kind: "body", text: meta.detail });
  for (const chapter of content.chapters) {
    blocks.push({ kind: "h2", text: chapter.title });
    if (chapter.objective && chapter.objective !== chapter.title) blocks.push({ kind: "body", text: chapter.objective });
    for (const fact of chapter.facts) {
      if (fact.text.includes("|")) {
        blocks.push({ kind: "table", text: fact.text });
      } else {
        blocks.push({ kind: "body", text: fact.text });
      }
      const source = fact.evidence.map((ref) => `p. ${ref.pageNumber}`).join(", ");
      if (source) blocks.push({ kind: "source", text: `Source ${source}` });
    }
    for (const term of chapter.terms) blocks.push({ kind: "term", text: term.term, extra: term.definition });
    for (const example of chapter.examples) blocks.push({ kind: "example", text: example.text });
    if (chapter.practice.length) {
      blocks.push({ kind: "h2", text: "Practice" });
      chapter.practice.forEach((question, index) => blocks.push({ kind: "body", text: `${index + 1}. ${question.prompt}` }));
    }
  }
  blocks.push({ kind: "break", text: "" });
  blocks.push({ kind: "title", text: "Answer key" });
  for (const chapter of content.chapters) {
    chapter.answers.forEach((answer, index) => blocks.push({ kind: "body", text: `${index + 1}. ${answer.text}` }));
  }
  return blocks;
}

export async function buildEditionPdf(content: StudyGuideContent, options: {
  title: string;
  subject?: string | null;
  courseName?: string | null;
  testDate?: string | null;
  page?: GuidePageFormat;
} ): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(new URL("./fonts/DejaVuSans.ttf", import.meta.url)), { subset: true });
  const box = pageBox(options.page ?? "letter");
  const page = doc.addPage([box.width, box.height]);
  const draw: Draw = { doc, font, page, y: box.height - MARGIN, width: box.width, height: box.height, pageNumber: 1 };
  const date = formatGuideDate(options.testDate);
  const detail = [options.subject, options.courseName, date ? `Test date: ${date}` : null, `Level ${content.level}`].filter(Boolean).join(" · ");
  for (const block of blocksFromEdition(content, { title: options.title, detail: detail || null })) {
    if (block.kind === "break") {
      newPage(draw);
      continue;
    }
    if (block.kind === "title") {
      writeParagraph(draw, block.text, TITLE, 32);
      draw.y -= 6;
    } else if (block.kind === "h2") {
      draw.y -= 8;
      writeParagraph(draw, block.text, HEADING, 30);
    } else if (block.kind === "term") {
      writeParagraph(draw, block.text, 13, 18);
      writeParagraph(draw, block.extra ?? "", BODY, BODY_LEADING, 12);
    } else if (block.kind === "example") {
      writeParagraph(draw, block.text, BODY, BODY_LEADING, 12);
    } else if (block.kind === "table") {
      writeTable(draw, block.text.split("\n").map((row) => row.split("|").map((cell) => cell.trim())).filter((row) => row.some(Boolean)));
    } else if (block.kind === "source") {
      writeParagraph(draw, block.text, 10, 14);
      draw.y -= 6;
    } else {
      writeParagraph(draw, block.text, BODY, BODY_LEADING);
      draw.y -= 4;
    }
  }
  draw.page.drawText(String(draw.pageNumber), {
    x: draw.width / 2 - 6, y: 28, size: 10, font, color: rgb(0.2, 0.2, 0.2)
  });
  doc.setTitle(options.title);
  return doc.save();
}

function topicsToEdition(input: StudyGuidePdfInput): StudyGuideContent {
  return {
    version: 1,
    schemaVersion: 1,
    promptVersion: 1,
    level: "general",
    roomId: "legacy",
    topicIds: [],
    sourceSnapshot: "legacy",
    chapters: input.topics.map((topic, index) => ({
      id: `chapter-${index + 1}`,
      title: topic.title,
      objective: topic.objective ?? topic.title,
      objectiveEvidence: [],
      facts: topic.sourceNotes.map((note, noteIndex) => ({
        id: `fact-${noteIndex + 1}`,
        text: note.text,
        evidence: [{ blockKey: note.documentName, pageNumber: note.pageNumber ?? 0 }]
      })),
      terms: topic.keyTerms.map((term, termIndex) => ({
        id: `term-${termIndex + 1}`,
        term,
        definition: term,
        evidence: []
      })),
      examples: [],
      practice: [],
      answers: []
    }))
  };
}

export async function buildStudyGuidePdf(input: StudyGuidePdfInput): Promise<Uint8Array> {
  return buildEditionPdf(topicsToEdition(input), {
    title: input.title,
    subject: input.subject,
    courseName: input.courseName,
    testDate: input.testDate
  });
}
