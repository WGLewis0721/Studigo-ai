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

export type SplitClaim = { text: string; citations: number[] };
export type VerifiedClaim = SplitClaim & { status: GroundingStatus };
export type ClaimVerification = {
  claims: VerifiedClaim[];
  verified: number;
  citationPresent: number;
  noEvidence: number;
};

/**
 * Splits an answer into sentence-sized claims (line breaks also end a claim, so
 * outline bullets stay separate) and records the `[n]` / `[n, m]` markers each
 * one carries. Text is kept as written; only surrounding whitespace is trimmed.
 * A marker that trails the full stop ("... end. [2]") stays with the sentence before it.
 */
export function splitClaims(text: string): SplitClaim[] {
  const pieces: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split(/(?<=[.!?])\s+(?!\[\d)/)) {
      const trimmed = part.trim();
      if (trimmed) pieces.push(trimmed);
    }
  }
  return pieces
    .map((piece) => {
      const citations: number[] = [];
      for (const match of piece.matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g)) {
        for (const n of match[1]!.split(",")) {
          const marker = Number(n.trim());
          if (!citations.includes(marker)) citations.push(marker);
        }
      }
      return { text: piece, citations };
    })
    .filter((claim) => claim.citations.length > 0 || words(claim.text).length > 0);
}

export function summarizeClaims(claims: VerifiedClaim[]): ClaimVerification {
  const count = (status: GroundingStatus) => claims.filter((claim) => claim.status === status).length;
  return { claims, verified: count("verified"), citationPresent: count("citation_present"), noEvidence: count("no_evidence") };
}

/**
 * Per-claim check. A claim is compared only with the chunks it cites
 * (`citations` are 1-based indexes into `chunkTexts`); a claim with no
 * citation is `no_evidence`.
 */
export function verifyClaims(args: { text: string; chunkTexts: string[] }): ClaimVerification {
  const claims = splitClaims(args.text).map((claim): VerifiedClaim => {
    if (!claim.citations.length) return { ...claim, status: "no_evidence" };
    const cited = claim.citations
      .map((marker) => args.chunkTexts[marker - 1])
      .filter((chunk): chunk is string => typeof chunk === "string");
    return { ...claim, status: groundingStatus({ citationCount: cited.length, claim: claim.text, chunkTexts: cited }) };
  });
  return summarizeClaims(claims);
}

/** Opt-in model judge for claims that cite a source but fail the lexical check. Off by default. */
export function claimJudgeEnabled() {
  return process.env.STUDIGO_CLAIM_JUDGE === "1";
}
