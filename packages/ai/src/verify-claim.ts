/**
 * Syntactic citation presence is not semantic support.
 * `verified` means the cited chunk's words cover the claim. It is a
 * conservative lexical check, not a model judgment.
 */
export type GroundingStatus = "no_evidence" | "citation_present" | "verified";

const STOP = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "from", "with",
  "is", "are", "was", "were", "be", "by", "that", "this", "it", "as", "at"
]);

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
}

/** True when every content word of the claim appears in the chunk. */
export function claimSupportedByChunk(claim: string, chunk: string) {
  const needed = words(claim);
  if (!needed.length || !chunk.trim()) return false;
  const have = new Set(words(chunk));
  return needed.every((word) => have.has(word));
}

export function groundingStatus(args: { citationCount: number; claim: string; chunkTexts: string[] }): GroundingStatus {
  if (args.citationCount <= 0) return "no_evidence";
  const supported = args.chunkTexts.some((chunk) => claimSupportedByChunk(args.claim, chunk));
  return supported ? "verified" : "citation_present";
}
