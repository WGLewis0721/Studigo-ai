export type SourceBlockKind = "heading" | "paragraph" | "term" | "table" | "unknown";

export type SourceBlock = {
  blockKey: string;
  kind: SourceBlockKind;
  pageNumber: number;
  readingOrder: number;
  rawText: string;
  text: string;
  coverage: "readable";
  fingerprint: string;
};

function fingerprint(text: string) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function classify(part: string): SourceBlockKind {
  if (part.includes("\t") || part.includes("|")) return "table";
  if (/^[^:\n]{2,40}\s[-:]\s+\S/.test(part)) return "term";
  if (/^#{1,3}\s/.test(part) || (part.length < 80 && !/[.!?]$/.test(part))) return "heading";
  if (part.trim().length < 12) return "unknown";
  return "paragraph";
}

/** Reading-order blocks for one derived revision. IDs follow the text, not the file bytes. */
export function deriveSourceBlocks(pages: Array<{ pageNumber: number; text: string; rawText?: string }>): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  let readingOrder = 0;
  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const raw = page.rawText?.trim() ? page.rawText : page.text;
    const parts = raw.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const text = part.replace(/\s+/g, " ").trim();
      const digest = fingerprint(text);
      blocks.push({
        blockKey: `p${page.pageNumber}-o${readingOrder}-${digest}`,
        kind: classify(part),
        pageNumber: page.pageNumber,
        readingOrder,
        rawText: part,
        text,
        coverage: "readable",
        fingerprint: digest
      });
      readingOrder += 1;
    }
  }
  return blocks;
}

export function blockKeyForChunk(blocks: SourceBlock[], pageNumber: number | null, content: string) {
  const sample = content.replace(/\s+/g, " ").trim();
  return blocks.find((block) => block.pageNumber === pageNumber && (sample.includes(block.text) || block.text.includes(sample.slice(0, 80))))?.blockKey ?? null;
}
