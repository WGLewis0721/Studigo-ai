import { createHash } from "node:crypto";
import { currentTransport } from "@studigo/ai";

/** Bumped only when the retrieval prompt contract changes. Not the prompt text. */
export const RETRIEVAL_PROMPT_VERSION = "retrieval-2026-10-07";

export type StudyTrace = {
  route: string;
  ownerId: string;
  chunkIds: string[];
  cutoff: number;
  tokenEstimate: number;
  latencyMs: number;
};

const LEAKED = ["prompt", "question", "content", "filename", "name", "text", "query", "answer", "ownerId"] as const;

export function ownerHash(ownerId: string) {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 16);
}

/**
 * Allowlisted retrieval/chat span. Token estimate is a local character count,
 * not a provider usage record, so it cannot be billed from.
 */
export function studyTraceRecord(input: StudyTrace & Record<string, unknown>) {
  const record = {
    route: input.route,
    ownerHash: input.ownerId ? ownerHash(input.ownerId) : null,
    chunkIds: input.chunkIds,
    cutoff: input.cutoff,
    transport: currentTransport(),
    tokenEstimate: input.tokenEstimate,
    latencyMs: input.latencyMs,
    promptVersion: RETRIEVAL_PROMPT_VERSION
  };
  const json = JSON.stringify(record);
  for (const key of LEAKED) {
    const secret = input[key];
    if (typeof secret === "string" && secret.length >= 8 && json.includes(secret)) {
      throw new Error(`study trace leaked ${key}`);
    }
  }
  return record;
}

export function writeStudyTrace(input: StudyTrace & Record<string, unknown>) {
  const record = studyTraceRecord(input);
  console.info(JSON.stringify({ studigo_trace: record }));
  return record;
}
