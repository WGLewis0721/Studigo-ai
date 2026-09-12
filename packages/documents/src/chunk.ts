import type { DocumentChunk, ExtractedPage } from "./types";

export const TARGET_CHUNK_CHARS = 1400;
export const CHUNK_OVERLAP_CHARS = 180;
/**
 * Low on purpose: a single-line slide or a one-sentence definition is real
 * content a learner can be tested on, and dropping it loses a citable source.
 */
export const MIN_CHUNK_CHARS = 25;

/** Rough token estimate; good enough for budgeting a context window. */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

/**
 * Chunks page-by-page so every chunk keeps exactly one citable location. A page
 * longer than the target is split on paragraph boundaries with a small overlap
 * so a definition that straddles a boundary is still retrievable.
 */
export function chunkPages(
  pages: ExtractedPage[],
  options: { documentName: string; sourceType: string; pageLabel: string }
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (text.replace(/\s/g, "").length < MIN_CHUNK_CHARS) continue;

    for (const body of splitPageText(text)) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        content: body,
        tokenCount: estimateTokens(body),
        metadata: {
          documentName: options.documentName,
          sourceType: options.sourceType,
          pageLabel: options.pageLabel,
          ocr: page.ocr === true
        }
      });
    }
  }

  return chunks;
}

function splitPageText(text: string): string[] {
  if (text.length <= TARGET_CHUNK_CHARS) return [text];

  const paragraphs = text.split(/\n{2,}/).flatMap(splitOversizedParagraph);
  const parts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > TARGET_CHUNK_CHARS) {
      parts.push(current.trim());
      current = `${tail(current, CHUNK_OVERLAP_CHARS)}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.filter((part) => part.replace(/\s/g, "").length >= MIN_CHUNK_CHARS);
}

/** A single paragraph bigger than a chunk is split on sentence boundaries. */
function splitOversizedParagraph(paragraph: string): string[] {
  if (paragraph.length <= TARGET_CHUNK_CHARS) return [paragraph];

  const sentences = paragraph.match(/[^.!?\n]+[.!?]*\s*/g) ?? [paragraph];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET_CHUNK_CHARS) {
      parts.push(current.trim());
      current = "";
    }
    current += sentence;
    // A "sentence" with no punctuation can still exceed the target on its own.
    while (current.length > TARGET_CHUNK_CHARS) {
      parts.push(current.slice(0, TARGET_CHUNK_CHARS).trim());
      current = current.slice(TARGET_CHUNK_CHARS);
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts;
}

function tail(text: string, size: number) {
  const slice = text.slice(-size);
  const boundary = slice.indexOf(" ");
  return boundary > 0 ? slice.slice(boundary + 1) : slice;
}
