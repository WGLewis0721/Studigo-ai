import { Document, HeadingLevel, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import type { StudyGuideContent } from "@studigo/ai";
import { formatGuideDate } from "./study-guide-pdf";

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function paragraph(text: string, heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading });
}

function table(raw: string) {
  const rows = raw.split("\n").map((row) => row.split("|").map((cell) => cell.trim())).filter((row) => row.some(Boolean));
  return new Table({
    rows: rows.map((row) => new TableRow({
      children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun(cell)] })] }))
    }))
  });
}

export async function buildEditionDocx(content: StudyGuideContent, options: {
  title: string;
  subject?: string | null;
  courseName?: string | null;
  testDate?: string | null;
}): Promise<Uint8Array> {
  const date = formatGuideDate(options.testDate);
  const detail = [options.subject, options.courseName, date ? `Test date: ${date}` : null, `Level ${content.level}`].filter(Boolean).join(" · ");
  const children: Array<Paragraph | Table> = [
    paragraph(options.title, HeadingLevel.TITLE),
    ...(detail ? [paragraph(detail)] : [])
  ];
  for (const chapter of content.chapters) {
    children.push(paragraph(chapter.title, HeadingLevel.HEADING_1));
    if (chapter.objective && chapter.objective !== chapter.title) children.push(paragraph(chapter.objective));
    for (const fact of chapter.facts) {
      if (fact.text.includes("|")) children.push(table(fact.text));
      else children.push(paragraph(fact.text));
      const source = fact.evidence.map((ref) => `p. ${ref.pageNumber}`).join(", ");
      if (source) children.push(paragraph(`Source ${source}`));
    }
    for (const term of chapter.terms) {
      children.push(paragraph(term.term, HeadingLevel.HEADING_2));
      children.push(paragraph(term.definition));
    }
    for (const example of chapter.examples) children.push(paragraph(example.text));
    if (chapter.practice.length) {
      children.push(paragraph("Practice", HeadingLevel.HEADING_2));
      chapter.practice.forEach((question, index) => children.push(paragraph(`${index + 1}. ${question.prompt}`)));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(paragraph("Answer key", HeadingLevel.HEADING_1));
  for (const chapter of content.chapters) {
    chapter.answers.forEach((answer, index) => children.push(paragraph(`${index + 1}. ${answer.text}`)));
  }
  const document = new Document({
    title: options.title,
    sections: [{ children }]
  });
  return Packer.toBuffer(document);
}

export function guideFileFormat(value: string | null): "pdf" | "docx" | null {
  if (!value || value === "pdf") return "pdf";
  if (value === "docx") return "docx";
  return null;
}
