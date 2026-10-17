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
