export const STRUCTURED_OUTPUT_KINDS = ["refusal", "truncated", "empty", "unparsable", "invalid"] as const;

export type StructuredOutputKind = (typeof STRUCTURED_OUTPUT_KINDS)[number];

/**
 * A structured model call that could not produce a usable value. The message
 * carries the kind and the schema name only, so it is safe to log or show:
 * never the prompt, the learner's text, the source text or the model's output.
 */
export class StructuredOutputError extends Error {
  readonly kind: StructuredOutputKind;
  readonly schemaName: string;

  constructor(kind: StructuredOutputKind, schemaName: string) {
    super(`structured output ${kind}: ${schemaName}`);
    this.name = "StructuredOutputError";
    this.kind = kind;
    this.schemaName = schemaName;
  }
}

/** The parts of a Responses API result that classification reads. */
type ResponseShape = {
  status?: string | null;
  incomplete_details?: { reason?: string | null } | null;
  output?: ReadonlyArray<{ type?: string; content?: unknown }> | null;
  output_text?: string | null;
};

export type StructuredRead<T> = { ok: true; value: T } | { ok: false; kind: StructuredOutputKind; problem?: string };

function hasRefusal(response: ResponseShape) {
  return (response.output ?? []).some(
    (item) =>
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some((part) => (part as { type?: string } | null)?.type === "refusal")
  );
}

/**
 * Sorts a result into a value or a failure kind, in this order: a refusal (an
 * explicit refusal item, or the provider's content filter stopping the reply),
 * a truncated reply (the output-token cap was hit), no text, then text that is
 * not a JSON object. Whether the value is acceptable to the caller is the
 * `validate` hook's call, not this function's.
 */
export function readStructuredOutput<T>(response: ResponseShape): StructuredRead<T> {
  if (hasRefusal(response) || response.incomplete_details?.reason === "content_filter") {
    return { ok: false, kind: "refusal" };
  }
  if (response.status === "incomplete") return { ok: false, kind: "truncated" };

  const raw = response.output_text?.trim();
  if (!raw) return { ok: false, kind: "empty" };

  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== "object") return { ok: false, kind: "unparsable" };
    return { ok: true, value: value as T };
  } catch {
    return { ok: false, kind: "unparsable" };
  }
}

/** Upper bound for the output budget of a retry after a truncated reply. */
export const MAX_RETRY_OUTPUT_TOKENS = 8192;

const PROBLEM_LIMIT = 400;

export type StructuredRetry = { note?: string; maxOutputTokens?: number };

/**
 * What the single allowed retry changes, or null when a retry cannot help.
 * Refusals are never retried. A truncated reply is retried with double the
 * output budget up to MAX_RETRY_OUTPUT_TOKENS, and not at all when there is no
 * cap to raise or it is already at the bound. The other kinds are retried with
 * the problem stated in a short note; the model's bad output is not echoed.
 */
export function planRetry(
  failure: { kind: StructuredOutputKind; problem?: string },
  currentOutputTokens: number | undefined
): StructuredRetry | null {
  switch (failure.kind) {
    case "refusal":
      return null;
    case "truncated": {
      if (!currentOutputTokens) return null;
      const raised = Math.min(currentOutputTokens * 2, MAX_RETRY_OUTPUT_TOKENS);
      return raised > currentOutputTokens ? { maxOutputTokens: raised } : null;
    }
    case "empty":
      return { note: "Your previous reply was empty. Reply with the JSON object the schema requires and nothing else." };
    case "unparsable":
      return { note: "Your previous reply was not valid JSON. Reply with only the JSON object the schema requires." };
    case "invalid":
      return {
        note: `Your previous reply was rejected: ${(failure.problem ?? "it did not meet the requirements").slice(0, PROBLEM_LIMIT)}. Correct that and reply with the full JSON object the schema requires.`
      };
  }
}
