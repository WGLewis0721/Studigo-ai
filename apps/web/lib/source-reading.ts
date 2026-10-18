/**
 * Presentation-only structure for source excerpts used by Guided Learn.
 * The learning API, cited chunk, and original OCR are never rewritten.
 * We only suppress recognizable repeated page chrome and separate bullet
 * markers that text extraction may have folded into a single line.
 */
export type SourceReadingBlock = {
  kind: "heading" | "fact" | "paragraph";
  text: string;
};

const DOCUMENT_CHROME = [
  /^GOVERNMENT\s*\/\s*STUDY MATERIALS$/i,
  /^PAGE\s+\d+(?:\s+OF\s+\d+)?$/i,
  /^OUR GOVERNMENT STUDY BUDDY$/i
];

function isPageChrome(line: string) {
  return DOCUMENT_CHROME.some((pattern) => pattern.test(line));
}

function tidy(text: string): string[] {
  // A bullet is structural in the original document, even when extraction
  // delivers the entire page in one paragraph. Preserve its wording.
  return text.replace(/\r\n?/g, "\n")
    .replace(/[ \t]*([•●])[ \t]*/g, "\n$1 ")
    .split("\n").map((line) => line.trim()).filter(Boolean);
}

export function parseSourceReading(text: string, currentTopic = ""): SourceReadingBlock[] {
  const rawLines = tidy(text);
  const lines = rawLines.filter((line) => !isPageChrome(line));
  const result: SourceReadingBlock[] = [];
  const topic = currentTopic.trim().toLocaleLowerCase();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const bullet = line.match(/^[•●]\s*(.*)$/);
    if (bullet) {
      if (bullet[1].trim()) result.push({ kind: "fact", text: bullet[1].trim() });
      continue;
    }
    // A heading precedes a bullet list; it must be a verbatim source line.
    const next = lines[index + 1] ?? "";
    const heading = line.length <= 95 && !/[.!?:;]$/.test(line)
      && /^[•●]\s*/.test(next);
    if (heading && line.toLocaleLowerCase() === topic) continue;
    result.push({ kind: heading ? "heading" : "paragraph", text: line });
  }
  // No bullet paragraphs? Nothing is guessed; render original text as prose.
  return result;
}
