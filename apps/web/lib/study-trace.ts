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

export type StudyFailureTrace = {
  route: string;
  ownerId: string;
  /** A structured-output failure kind. */
  kind: string;
  schemaName: string;
  latencyMs: number;
};

export function ownerHash(ownerId: string) {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 16);
}

function assertNoLeak(record: object, input: Record<string, unknown>) {
  const json = JSON.stringify(record);
  for (const key of LEAKED) {
    const secret = input[key];
    if (typeof secret === "string" && secret.length >= 8 && json.includes(secret)) {
      throw new Error(`study trace leaked ${key}`);
    }
  }
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
  assertNoLeak(record, input);
  return record;
}

export function writeStudyTrace(input: StudyTrace & Record<string, unknown>) {
  const record = studyTraceRecord(input);
  console.info(JSON.stringify({ studigo_trace: record }));
  return record;
}

/** Allowlisted structured-output failure: the kind and schema name, never what the model or the learner wrote. */
export function studyFailureRecord(input: StudyFailureTrace & Record<string, unknown>) {
  const record = {
    route: input.route,
    ownerHash: input.ownerId ? ownerHash(input.ownerId) : null,
    transport: currentTransport(),
    failureKind: input.kind,
    schemaName: input.schemaName,
    latencyMs: input.latencyMs
  };
  assertNoLeak(record, input);
  return record;
}

export function writeStudyFailure(input: StudyFailureTrace & Record<string, unknown>) {
  const record = studyFailureRecord(input);
  console.info(JSON.stringify({ studigo_trace: record }));
  return record;
}
