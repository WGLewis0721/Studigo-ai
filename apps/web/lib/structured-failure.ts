import { StructuredOutputError, type StructuredOutputKind } from "@studigo/ai";
import { writeStudyFailure } from "@/lib/study-trace";

type FailureContext = { route: string; ownerId: string; started: number };

const TRY_AGAIN = "Studigo couldn't finish that. Please try again.";

const LEARNER_FAILURES: Record<StructuredOutputKind, { status: number; message: string }> = {
  refusal: { status: 422, message: "Studigo can't help with that request. Try rewording it or choosing a different topic." },
  truncated: { status: 422, message: "That request was too big to finish. Try a smaller one, such as fewer questions or a narrower topic." },
  empty: { status: 503, message: TRY_AGAIN },
  unparsable: { status: 503, message: TRY_AGAIN },
  invalid: { status: 503, message: TRY_AGAIN }
};

/**
 * Maps a structured-output failure to what the learner is told and logs one line with the kind and
 * schema name. Returns null for any other error so the caller keeps its own handling.
 */
export function structuredFailure(error: unknown, trace: FailureContext) {
  if (!(error instanceof StructuredOutputError)) return null;
  writeStudyFailure({
    route: trace.route,
    ownerId: trace.ownerId,
    kind: error.kind,
    schemaName: error.schemaName,
    latencyMs: Date.now() - trace.started
  });
  return LEARNER_FAILURES[error.kind];
}

export function structuredFailureResponse(error: unknown, trace: FailureContext) {
  const failure = structuredFailure(error, trace);
  return failure ? Response.json({ error: failure.message }, { status: failure.status }) : null;
}
