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
const TITLE = 24;
const TEAL = rgb(0.05, 0.35, 0.38);
const NEAR_BLACK = rgb(0.1, 0.1, 0.1);

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

type SheetChapter = {
  title?: string;
  facts?: Array<{ text: string } | string>;
  terms?: Array<{ term: string; definition: string }>;
};

type SheetSection = { title: string; bullets: string[] };
type SheetVocab = { term: string; definition: string };
type SheetPage = { sections: SheetSection[]; vocabulary: SheetVocab[] };

const CLAUSE = /\b(?:is|are|was|were|am|be|been|being|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|make|makes|made|enforce|enforces|enforced|review|reviews|reviewed|write|writes|wrote|help|helps|helped|include|includes|included|mean|means|meant|become|becomes|became|need|needs|needed|use|uses|used|show|shows|showed|keep|keeps|kept|give|gives|gave|take|takes|took|say|says|said|work|works|worked|serve|serves|served|represent|represents|represented|choose|chooses|chose|vote|votes|voted|pass|passes|passed|sign|signs|signed|interpret|interprets|interpreted|decide|decides|decided|protect|protects|protected|define|defines|defined|refer|refers|referred|consist|consists|consisted|contain|contains|contained|provide|provides|provided|allow|allows|allowed|require|requires|required|follow|follows|followed|describe|describes|described|explain|explains|explained|create|creates|created|control|controls|controlled|lead|leads|led|hold|holds|held|form|forms|formed|cover|covers|covered|let|lets|get|gets|got|come|comes|came|go|goes|went|know|knows|knew|think|thinks|thought|cause|causes|caused|produce|produces|produced|equal|equals|equaled|call|calls|called|live|lives|lived|elect|elects|elected|carry|carries|carried|count|counts|counted)\b/i;

/** A clause is still a sentence when the worksheet left off the period. */
function isSentence(line: string): boolean {
  return /[.!?]/.test(line) || CLAUSE.test(line);
}

function vocabularyFromLine(line: string): SheetVocab | null {
  const candidates = [" — ", " - "]
    .map((sep) => ({ sep, index: line.indexOf(sep) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  const found = candidates[0];
  if (!found) return null;
  const term = line.slice(0, found.index).trim();
  const definition = line.slice(found.index + found.sep.length).trim();
  if (!term || !definition || term.length >= 40) return null;
  if (!line.includes(term) || !line.includes(definition)) return null;
  return { term, definition };
}

function startsSection(line: string): boolean {
  if (line.length >= 60) return false;
  if (line.includes(" — ") || line.includes(" - ")) return false;
  if (isSentence(line)) return false;
  return true;
}

function factText(fact: { text: string } | string): string {
  const text = typeof fact === "string" ? fact : fact?.text;
  return typeof text === "string" ? text.trim() : "";
}

function contained(source: string, text: string): boolean {
  return text.length > 0 && source.includes(text);
}

function layoutFromLines(title: string, lines: string[]): SheetPage[] {
  const sourceLines = lines.map((line) => line.trim()).filter(Boolean);
  const source = sourceLines.join("\n");
  const sections: SheetSection[] = [];
  const vocabulary: SheetVocab[] = [];
  let current: SheetSection | null = null;

  for (const line of sourceLines) {
    const vocab = vocabularyFromLine(line);
    if (vocab) {
      if (contained(source, vocab.term) && contained(source, vocab.definition)) vocabulary.push(vocab);
      continue;
    }
    if (startsSection(line)) {
      current = { title: line, bullets: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title, bullets: [] };
      sections.push(current);
    }
    if (contained(source, line)) current.bullets.push(line);
  }

  const kept = sections.filter((section) => section.bullets.length > 0 || contained(source, section.title));
  return [{ sections: kept, vocabulary: vocabulary.filter((item) => contained(source, item.term) && contained(source, item.definition)) }];
}

function layoutFromChapters(title: string, chapters: SheetChapter[]): SheetPage[] {
  const sections: SheetSection[] = [];
  const vocabulary: SheetVocab[] = [];
  for (const chapter of chapters) {
    const facts = (chapter.facts ?? []).map(factText).filter(Boolean);
    const terms = (chapter.terms ?? []).flatMap((term) => {
      const name = term.term?.trim() ?? "";
      const definition = term.definition?.trim() ?? "";
      if (!name || !definition) return [];
      return [{ term: name, definition }];
    });
    const corpus = [...facts, ...terms.flatMap((term) => [term.term, term.definition])].join("\n");
    const bullets = facts.filter((fact) => contained(corpus, fact));
    const chapterTerms = terms.filter((term) => contained(corpus, term.term) && contained(corpus, term.definition));
    const sectionTitle = chapter.title?.trim() || title;
    if (chapter.title?.trim() || bullets.length) sections.push({ title: sectionTitle, bullets });
    vocabulary.push(...chapterTerms);
  }
  return [{ sections, vocabulary }];
}

/** Pure study-sheet layout. Every bullet and vocabulary string is copied from the source. */
export function layoutStudySheet(input: {
  title: string;
  subject?: string | null;
  lines: string[];
  chapters?: SheetChapter[];
}): { header: string; pages: SheetPage[] } {
  const header = `${(input.subject?.trim() || "STUDY").toUpperCase()} / STUDY MATERIALS`;
  const pages = input.chapters?.length
    ? layoutFromChapters(input.title, input.chapters)
    : layoutFromLines(input.title, input.lines ?? []);
  return { header, pages: pages.length ? pages : [{ sections: [], vocabulary: [] }] };
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
  header: string;
};

const BOTTOM = 56;

function stampPageNumber(draw: Draw) {
  const label = `Page ${draw.pageNumber}`;
  const width = draw.font.widthOfTextAtSize(label, 10);
  draw.page.drawText(label, {
    x: (draw.width - width) / 2,
    y: 28,
    size: 10,
    font: draw.font,
    color: rgb(0.25, 0.25, 0.25)
  });
}

function paintRunningHeader(draw: Draw) {
  const baseline = draw.height - 40;
  draw.page.drawText(draw.header, {
    x: MARGIN,
    y: baseline,
    size: 9,
    font: draw.font,
    color: rgb(0.2, 0.27, 0.29)
  });
  draw.page.drawLine({
    start: { x: MARGIN, y: baseline - 8 },
    end: { x: draw.width - MARGIN, y: baseline - 8 },
    thickness: 0.8,
    color: TEAL
  });
  draw.y = baseline - 28;
}

function nextPage(draw: Draw) {
  stampPageNumber(draw);
  draw.page = draw.doc.addPage([draw.width, draw.height]);
  draw.pageNumber += 1;
  paintRunningHeader(draw);
}

function ensure(draw: Draw, needed: number) {
  if (draw.y - needed < BOTTOM) nextPage(draw);
}

function drawWrapped(draw: Draw, text: string, size: number, leading: number, color: ReturnType<typeof rgb>, indent = 0) {
  const width = Math.max(draw.width - MARGIN * 2 - indent, 40);
  const lines = wrap(draw.font, text, size, width);
  for (const line of lines) {
    ensure(draw, leading);
    draw.page.drawText(line, {
      x: MARGIN + indent,
      y: draw.y - size,
      size,
      font: draw.font,
      color
    });
    draw.y -= leading;
  }
}

function drawVocabulary(draw: Draw, term: string, definition: string) {
  const size = 12;
  const leading = 16;
  const gap = 16;
  const contentWidth = draw.width - MARGIN * 2;
  const termWidth = draw.font.widthOfTextAtSize(term, size);
  if (termWidth + gap + 100 <= contentWidth) {
    const defWidth = contentWidth - termWidth - gap;
    const defLines = wrap(draw.font, definition, size, defWidth);
    for (let index = 0; index < defLines.length; index += 1) {
      ensure(draw, leading);
      if (index === 0) {
        draw.page.drawText(term, {
          x: MARGIN,
          y: draw.y - size,
          size,
          font: draw.font,
          color: TEAL
        });
      }
      draw.page.drawText(defLines[index] ?? "", {
        x: MARGIN + termWidth + gap,
        y: draw.y - size,
        size,
        font: draw.font,
        color: NEAR_BLACK
      });
      draw.y -= leading;
    }
  } else {
    drawWrapped(draw, term, size, leading, TEAL);
    drawWrapped(draw, definition, size, leading, NEAR_BLACK, 12);
  }
  draw.y -= 3;
}

function drawSectionTitle(draw: Draw, text: string) {
  ensure(draw, 36);
  draw.y -= 8;
  drawWrapped(draw, text, 16, 21, rgb(0.08, 0.12, 0.14));
  draw.y -= 2;
}

function drawBullet(draw: Draw, text: string) {
  const size = 12;
  const leading = 16;
  const indent = 16;
  const rows = text.split(/\n/).map((row) => row.trim()).filter(Boolean);
  const lines = (rows.length ? rows : [text]).flatMap((row) => wrap(draw.font, row, size, Math.max(draw.width - MARGIN * 2 - indent, 40)));
  lines.forEach((line, index) => {
    ensure(draw, leading);
    if (index === 0) {
      draw.page.drawText("•", {
        x: MARGIN,
        y: draw.y - size,
        size,
        font: draw.font,
        color: TEAL
      });
    }
    draw.page.drawText(line, {
      x: MARGIN + indent,
      y: draw.y - size,
      size,
      font: draw.font,
      color: NEAR_BLACK
    });
    draw.y -= leading;
  });
}

export async function buildEditionPdf(content: StudyGuideContent, options: {
  title: string;
  subject?: string | null;
  courseName?: string | null;
  testDate?: string | null;
  page?: GuidePageFormat;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(new URL("./fonts/DejaVuSans.ttf", import.meta.url)), { subset: true });
  const box = pageBox(options.page ?? "letter");
  const page = doc.addPage([box.width, box.height]);
  const sheet = layoutStudySheet({
    title: options.title,
    subject: options.subject,
    lines: [],
    chapters: content.chapters
  });
  const draw: Draw = {
    doc,
    font,
    page,
    y: box.height - MARGIN,
    width: box.width,
    height: box.height,
    pageNumber: 1,
    header: sheet.header
  };
  paintRunningHeader(draw);
  if (options.title.trim()) {
    drawWrapped(draw, options.title, TITLE, 30, rgb(0.07, 0.09, 0.1));
    draw.y -= 6;
  }
  sheet.pages.forEach((sheetPage, index) => {
    if (index > 0) nextPage(draw);
    for (const item of sheetPage.vocabulary) drawVocabulary(draw, item.term, item.definition);
    if (sheetPage.vocabulary.length && sheetPage.sections.length) draw.y -= 6;
    for (const section of sheetPage.sections) {
      if (section.title.trim()) drawSectionTitle(draw, section.title);
      for (const bullet of section.bullets) drawBullet(draw, bullet);
    }
  });
  stampPageNumber(draw);
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
