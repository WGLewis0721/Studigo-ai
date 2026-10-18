/**
 * Presentation-only heading for source-grounded saved editions.
 * Some scans have their entire first OCR passage stored as chapter.title.
 * Do not promote that raw passage to a giant heading, rewrite its facts,
 * or discard it: GuidePreview keeps the verbatim title in a disclosure.
 */
export function guideOutlineHeading(raw: string, position: number) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= 100) return { heading: text || `Section ${position + 1}`, oversized: false };

  // OCR handouts often begin with a short document heading followed by
  // "Page N" and all the vocabulary on that page, without line breaks.
  const beforePage = text.match(/^(.{6,90}?)\s+Page\s+\d+\b/i)?.[1]?.trim();
  if (beforePage && beforePage.length <= 72) {
    return { heading: beforePage, oversized: true };
  }

  const line = raw.split(/[\n\r]+/).map(part => part.trim()).find(Boolean);
  if (line && line.length >= 5 && line.length <= 80) {
    return { heading: line, oversized: true };
  }

  // A neutral structural label is safer than inventing a subject from OCR.
  return { heading: `Section ${position + 1}`, oversized: true };
}

/** Show a true source excerpt for a very long fact, never an AI summary. */
export function guideFactExcerpt(raw: string, limit = 175) {
  const text = raw.trim();
  if (text.length <= limit) return { excerpt: text, long: false };
  const before = text.slice(0, limit);
  const boundary = before.lastIndexOf(" ");
  return {
    excerpt: (boundary >= 75 ? before.slice(0, boundary) : before).trimEnd() + "…",
    long: true
  };
}

/**
 * Presentation-only outline for source passages that lost their line breaks
 * during OCR. Preserve every word in the same order; do not paraphrase,
 * invent headings, or write this representation back into study evidence.
 * Explicit page/section boundaries and punctuation win. Long unpunctuated
 * blocks are split at whole-word boundaries strictly for legibility.
 */
export type GuideSourceOutlinePart = { kind: "heading" | "point"; text: string };

export function guideSourceOutline(raw: string): GuideSourceOutlinePart[] {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const withSections = normalized
    .replace(/[ \t]+(Page\s+\d{1,3})\b/gi, "\n$1\n")
    .replace(/[ \t]+(Vocabulary|Key Terms|Key Points|Key Ideas|Important Ideas|Definitions)\b/g, "\n$1\n");
  const lines = withSections.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const result: GuideSourceOutlinePart[] = [];
  for (const line of lines) {
    if (/^(?:Page\s+\d{1,3}|Vocabulary|Key Terms|Key Points|Key Ideas|Important Ideas|Definitions)$/i.test(line)) {
      result.push({ kind: "heading", text: line });
      continue;
    }
    // Keep supplied punctuation, sentence order, and words. Do not invent periods.
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
    for (const sentence of sentences) {
      if (sentence.length <= 175) {
        result.push({ kind: "point", text: sentence });
        continue;
      }
      const words = sentence.match(/\S+/g) ?? [];
      let buffer = "";
      for (const word of words) {
        if (buffer && buffer.length + 1 + word.length > 165) {
          result.push({ kind: "point", text: buffer });
          buffer = word;
        } else {
          buffer = buffer ? `${buffer} ${word}` : word;
        }
      }
      if (buffer) result.push({ kind: "point", text: buffer });
    }
  }
  return result;
}
