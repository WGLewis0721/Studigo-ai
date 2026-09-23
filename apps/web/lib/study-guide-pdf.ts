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

type PdfLine = {
  text: string;
  size: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
};

function ascii(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, maxChars: number): string[] {
  const text = ascii(value);
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length <= maxChars ? word : word.slice(0, maxChars);
  }
  if (current) lines.push(current);
  return lines;
}

function buildLines(input: StudyGuidePdfInput): PdfLine[] {
  const lines: PdfLine[] = [];
  lines.push({ text: input.title, size: 20, bold: true, gapAfter: 6 });
  const context = [input.subject, input.courseName].filter(Boolean).join(" / ");
  if (context) lines.push({ text: context, size: 10, gapAfter: 2 });
  if (input.testDate) lines.push({ text: `Test date: ${input.testDate}`, size: 10, gapAfter: 10 });
  lines.push({
    text: "Built from this Study Room's current topic map and uploaded sources. Use the source references to verify anything you are unsure about.",
    size: 9,
    gapAfter: 14
  });

  input.topics.forEach((topic, index) => {
    lines.push({ text: `${index + 1}. ${topic.title}`, size: 14, bold: true, gapAfter: 4 });
    if (topic.objective) {
      for (const line of wrap(`What to know: ${topic.objective}`, 88)) {
        lines.push({ text: line, size: 10, gapAfter: 1 });
      }
    }
    if (topic.keyTerms.length) {
      for (const line of wrap(`Key terms: ${topic.keyTerms.join(", ")}`, 88)) {
        lines.push({ text: line, size: 9, gapAfter: 1 });
      }
    }

    if (topic.sourceNotes.length) {
      lines.push({ text: "From your materials:", size: 10, bold: true, gapAfter: 2 });
      for (const note of topic.sourceNotes) {
        const source = [note.documentName, note.pageNumber ? `${note.pageLabel || "page"} ${note.pageNumber}` : ""]
          .filter(Boolean)
          .join(", ");
        const excerpt = ascii(note.text).slice(0, 520);
        for (const line of wrap(`- ${excerpt}`, 84)) {
          lines.push({ text: line, size: 9, indent: 12, gapAfter: 1 });
        }
        lines.push({ text: `Source: ${source}`, size: 8, indent: 18, gapAfter: 4 });
      }
    } else {
      lines.push({ text: "No supporting passage was linked strongly enough to include here.", size: 9, gapAfter: 4 });
    }

    for (const line of wrap(`Check yourself: Explain ${topic.title} in your own words without looking, then verify it against the source above.`, 88)) {
      lines.push({ text: line, size: 9, bold: true, gapAfter: 1 });
    }
    lines.push({ text: "", size: 9, gapAfter: 10 });
  });

  return lines;
}

export function buildStudyGuidePdf(input: StudyGuidePdfInput): Uint8Array {
  const lines = buildLines(input);
  const pages: string[][] = [[]];
  let y = 744;

  for (const line of lines) {
    const leading = Math.max(12, line.size + 3);
    if (y - leading < 54) {
      pages.push([]);
      y = 744;
    }
    if (line.text) {
      const font = line.bold ? "F2" : "F1";
      const x = 54 + (line.indent ?? 0);
      pages[pages.length - 1].push(
        `BT /${font} ${line.size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(line.text)}) Tj ET`
      );
    }
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
