export type StudyGuideSourceNote = {
  text: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel?: string | null;
  /** The learner-facing source type, e.g. "Teacher study guide". Printed only when the data has one. */
  sourceLabel?: string | null;
  /** The document's stored source priority; higher prints first. Notes without one keep their order, after those with one. */
  priority?: number | null;
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

type PdfLine = {
  text: string;
  size: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
};

type Piece = { kind: "text"; text: string } | { kind: "fraction"; top: string; bottom: string };

const PAGE_WIDTH = 612;
const MARGIN = 54;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const EXCERPT_LIMIT = 520;

// Standard Helvetica and Helvetica-Bold advance widths per 1000 units for ASCII 32..126.
const REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584
];
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
  389, 280, 389, 584
];

const VULGAR_FRACTION = /[¼-¾⅐-⅞↉]/g;
const SUPERSCRIPT = /[²³¹⁰⁴-⁹]/g;
// A fraction is digits over digits standing alone, so dates (3/4/2026), ranges and words with slashes stay text.
const FRACTION = /(?<![\w/.])(\d{1,3})\/(\d{1,3})(?![\w/]|\.\d)/g;

function ascii(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/×/g, "x")
    .replace(/÷/g, " / ")
    .replace(VULGAR_FRACTION, (mark) => ` ${mark.normalize("NFKD").replace("⁄", "/")} `)
    .replace(SUPERSCRIPT, (mark) => `^${mark.normalize("NFKD")}`)
    .replace(/\s+/g, " ")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? BOLD_WIDTHS : REGULAR_WIDTHS;
  let units = 0;
  for (let index = 0; index < text.length; index += 1) {
    units += table[text.charCodeAt(index) - 32] ?? 556;
  }
  return (units * size) / 1000;
}

function wrap(value: string, size: number, bold: boolean, maxWidth: number): string[] {
  const text = ascii(value);
  if (!text) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (textWidth(next, size, bold) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = "";
    let rest = word;
    while (textWidth(rest, size, bold) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && textWidth(rest.slice(0, cut), size, bold) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}

function pieces(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const match of text.matchAll(FRACTION)) {
    if (Number(match[2]) === 0) continue;
    const start = match.index ?? 0;
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    out.push({ kind: "fraction", top: match[1], bottom: match[2] });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

function excerptOf(value: string): string {
  const text = ascii(value);
  if (text.length <= EXCERPT_LIMIT) return text;
  const cut = text.slice(0, EXCERPT_LIMIT);
  const space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_LIMIT * 0.75 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

function locationOf(note: StudyGuideSourceNote): string {
  const page = note.pageNumber;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) return "";
  const label = ascii(note.pageLabel || "page").slice(0, 16) || "page";
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${page}`;
}

function byTeacherPriority(notes: StudyGuideSourceNote[]): StudyGuideSourceNote[] {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => (b.note.priority ?? -1) - (a.note.priority ?? -1) || a.index - b.index)
    .map((item) => item.note);
}

function buildLines(input: StudyGuidePdfInput): PdfLine[] {
  const lines: PdfLine[] = [];
  const add = (
    text: string,
    size: number,
    options: { bold?: boolean; indent?: number; rowGap?: number; gapAfter?: number } = {}
  ) => {
    const rows = wrap(text, size, Boolean(options.bold), TEXT_WIDTH - (options.indent ?? 0));
    rows.forEach((row, index) => {
      lines.push({
        text: row,
        size,
        bold: options.bold,
        indent: options.indent,
        gapAfter: index === rows.length - 1 ? options.gapAfter : (options.rowGap ?? 0)
      });
    });
  };

  add(input.title, 20, { bold: true, gapAfter: 6 });
  const context = [input.subject, input.courseName].filter(Boolean).join(" / ");
  if (context) add(context, 10, { gapAfter: 2 });
  if (input.testDate) add(`Test date: ${input.testDate}`, 10, { gapAfter: 10 });
  add(
    "Built from this Study Room's current topic map and uploaded sources. Use the source references to verify anything you are unsure about. Sources under each topic are listed in teacher-priority order: study guide, teacher material, worksheet, slides, your notes, textbook.",
    9,
    { gapAfter: 14 }
  );

  input.topics.forEach((topic, index) => {
    add(`${index + 1}. ${topic.title}`, 14, { bold: true, gapAfter: 4 });
    if (topic.objective) add(`What to know: ${topic.objective}`, 10, { rowGap: 1, gapAfter: 1 });
    if (topic.keyTerms.length) add(`Key terms: ${topic.keyTerms.join(", ")}`, 9, { rowGap: 1, gapAfter: 1 });

    if (topic.sourceNotes.length) {
      lines.push({ text: "From your materials:", size: 10, bold: true, gapAfter: 2 });
      for (const note of byTeacherPriority(topic.sourceNotes)) {
        add(`- ${excerptOf(note.text)}`, 9, { indent: 12, rowGap: 1, gapAfter: 1 });
        const origin = [ascii(note.sourceLabel ?? ""), ascii(note.documentName)].filter(Boolean).join(" - ");
        const source = [origin, locationOf(note)].filter(Boolean).join(", ");
        add(`Source: ${source}`, 8, { indent: 18, rowGap: 1, gapAfter: 4 });
      }
    } else {
      add("No supporting passage was linked strongly enough to include here.", 9, { gapAfter: 4 });
    }

    add(
      `Check yourself: Explain ${topic.title} in your own words without looking, then verify it against the source above.`,
      9,
      { bold: true, rowGap: 1, gapAfter: 1 }
    );
    lines.push({ text: "", size: 9, gapAfter: 10 });
  });

  return lines;
}

function lineOps(line: PdfLine, parts: Piece[], y: number): string[] {
  const font = line.bold ? "F2" : "F1";
  const bold = Boolean(line.bold);
  const ops: string[] = [];
  let x = MARGIN + (line.indent ?? 0);

  for (const part of parts) {
    if (part.kind === "text") {
      if (part.text.trim()) {
        ops.push(`BT /${font} ${num(line.size)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm (${escapePdfString(part.text)}) Tj ET`);
      }
      x += textWidth(part.text, line.size, bold);
      continue;
    }

    const small = line.size * 0.7;
    const pad = line.size * 0.12;
    const topWidth = textWidth(part.top, small, bold);
    const bottomWidth = textWidth(part.bottom, small, bold);
    const width = Math.max(topWidth, bottomWidth) + pad * 2;
    const rule = y + line.size * 0.27;
    ops.push(`q ${num(line.size * 0.06)} w ${num(x)} ${num(rule)} m ${num(x + width)} ${num(rule)} l S Q`);
    ops.push(
      `BT /${font} ${num(small)} Tf 1 0 0 1 ${num(x + (width - topWidth) / 2)} ${num(rule + line.size * 0.12)} Tm (${escapePdfString(part.top)}) Tj ET`
    );
    ops.push(
      `BT /${font} ${num(small)} Tf 1 0 0 1 ${num(x + (width - bottomWidth) / 2)} ${num(rule - line.size * 0.12 - small * 0.72)} Tm (${escapePdfString(part.bottom)}) Tj ET`
    );
    x += width;
  }

  return ops;
}

export function buildStudyGuidePdf(input: StudyGuidePdfInput): Uint8Array {
  const lines = buildLines(input);
  const pages: string[][] = [[]];
  let y = 744;

  for (const line of lines) {
    const parts = line.text ? pieces(line.text) : [];
    const stacked = parts.some((part) => part.kind === "fraction");
    const leading = Math.max(12, line.size + 3) + (stacked ? 2 : 0);
    if (y - leading < 54) {
      pages.push([]);
      y = 744;
    }
    pages[pages.length - 1].push(...lineOps(line, parts, y));
    y -= leading + (line.gapAfter ?? 0);
  }

  const pageCount = pages.length;
  const fontRegularObject = 3 + pageCount * 2;
  const fontBoldObject = fontRegularObject + 1;
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;

  pages.forEach((commands, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = commands.join("\n");
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
  });

  objects[fontRegularObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[fontBoldObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let pdf = "%PDF-1.4\n%Studigo\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "ascii");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "ascii"));
}
