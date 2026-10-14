import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { citationsUsedIn, toCitations, type RetrievedChunk } from "@studigo/ai";
import {
  buildLearnSuccess,
  classifyLearnOutcome,
  learnOutcomeStatus,
  learnStreamDone,
  learnStreamError,
  type LearnOutcome,
  type LearnOutcomeKind
} from "./learn-outcome";
import { learnOutcomeView, readLearnOutcome } from "./learn-outcome-client";

const ready = { id: "ready-doc", status: "ready" };
const processing = { id: "processing-doc", status: "processing" };
const failedDocument = { id: "failed-doc", status: "failed" };

test("C04 Learn outcome contract distinguishes source, evidence, scope, and provider states", () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof classifyLearnOutcome>[0];
    kind: LearnOutcomeKind;
    status: number;
    retryable: boolean;
    action: "retry" | "see_topics" | "materials" | null;
    counts: LearnOutcome["counts"];
    coverageIds: string[];
  }> = [
    {
      name: "no uploads",
      input: { documentStatuses: [] },
      kind: "no_ready_materials",
      status: 422,
      retryable: false,
      action: "materials",
      counts: { readyMaterials: 0, processingMaterials: 0, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "documents still processing",
      input: { documentStatuses: [processing] },
      kind: "materials_processing",
      status: 425,
      retryable: true,
      action: "materials",
      counts: { readyMaterials: 0, processingMaterials: 1, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "uploaded document failed before becoming ready",
      input: { documentStatuses: [failedDocument] },
      kind: "no_ready_materials",
      status: 422,
      retryable: false,
      action: "materials",
      counts: { readyMaterials: 0, processingMaterials: 0, failedMaterials: 1, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "ready sources but no relevant chunks",
      input: { documentStatuses: [ready], sourceDocumentIds: [ready.id] },
      kind: "no_relevant_evidence",
      status: 422,
      retryable: false,
      action: "see_topics",
      counts: { readyMaterials: 1, processingMaterials: 0, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "cited ready source with another document processing",
      input: {
        documentStatuses: [ready, processing],
        sourceDocumentIds: [ready.id, processing.id],
        evidenceDocumentIds: [ready.id],
        evidenceChunkCount: 2
      },
      kind: "partial_coverage",
      status: 200,
      retryable: true,
      action: "materials",
      counts: { readyMaterials: 1, processingMaterials: 1, failedMaterials: 0, relevantChunks: 2 },
      coverageIds: [ready.id]
    },
    {
      name: "all source documents covered",
      input: {
        documentStatuses: [ready],
        sourceDocumentIds: [ready.id],
        evidenceDocumentIds: [ready.id],
        evidenceChunkCount: 1
      },
      kind: "ready",
      status: 200,
      retryable: false,
      action: null,
      counts: { readyMaterials: 1, processingMaterials: 0, failedMaterials: 0, relevantChunks: 1 },
      coverageIds: [ready.id]
    },
    {
      name: "invalid selected topic",
      input: { documentStatuses: [ready], failure: "invalid_topic_scope" },
      kind: "invalid_topic_scope",
      status: 404,
      retryable: false,
      action: "see_topics",
      counts: { readyMaterials: 1, processingMaterials: 0, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "source retrieval failure",
      input: { documentStatuses: [ready], failure: "retrieval_error" },
      kind: "retrieval_error",
      status: 503,
      retryable: true,
      action: "retry",
      counts: { readyMaterials: 1, processingMaterials: 0, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    },
    {
      name: "answer generation failure",
      input: { documentStatuses: [ready], failure: "generation_error" },
      kind: "generation_error",
      status: 503,
      retryable: true,
      action: "retry",
      counts: { readyMaterials: 1, processingMaterials: 0, failedMaterials: 0, relevantChunks: 0 },
      coverageIds: []
    }
  ];

  for (const scenario of cases) {
    const outcome = classifyLearnOutcome(scenario.input);
    assert.equal(outcome.kind, scenario.kind, scenario.name);
    assert.equal(outcome.reasonCode, scenario.kind.toUpperCase(), scenario.name);
    assert.equal(outcome.retryable, scenario.retryable, scenario.name);
    assert.deepEqual(outcome.counts, scenario.counts, scenario.name);
    assert.deepEqual(outcome.coverageIds, scenario.coverageIds, scenario.name);
    assert.equal(learnOutcomeStatus(outcome.kind), scenario.status, scenario.name);
    assert.deepEqual(readLearnOutcome(JSON.parse(JSON.stringify(outcome))), outcome, scenario.name);
    assert.equal(learnOutcomeView(outcome)?.action ?? null, scenario.action, scenario.name);
  }

  assert.equal(readLearnOutcome({ kind: "ready", reasonCode: "READY" }), null, "incomplete wire outcome ignored");
  assert.equal(readLearnOutcome({ kind: "made_up", reasonCode: "READY" }), null, "unknown kind ignored");
  assert.equal(readLearnOutcome({
    ...classifyLearnOutcome({ documentStatuses: [ready] }),
    reasonCode: "GENERATION_ERROR"
  }), null, "a mismatched reason code cannot drive a recovery action");

  const foreignEvidence = classifyLearnOutcome({
    documentStatuses: [ready],
    evidenceDocumentIds: ["another-room-document"],
    evidenceChunkCount: 1
  });
  assert.equal(foreignEvidence.kind, "no_relevant_evidence");
  assert.deepEqual(foreignEvidence.coverageIds, []);

  const failedView = learnOutcomeView(classifyLearnOutcome({ documentStatuses: [failedDocument] }));
  assert.match(failedView?.message ?? "", /failed uploads/i);
  const emptyView = learnOutcomeView(classifyLearnOutcome({ documentStatuses: [] }));
  assert.match(emptyView?.message ?? "", /add a document/i);
});

test("C04 grounded answer and SSE compatibility preserves cited legacy fields", () => {
  const chunks: RetrievedChunk[] = [{
    id: "chunk-1",
    documentId: ready.id,
    documentName: "Government guide.pdf",
    content: "The legislative branch makes laws.",
    similarity: 0.8,
    pageNumber: 2,
    pageLabel: "page",
    sourceType: "study_guide"
  }];
  const explanation = "The legislative branch makes laws [1].";
  const citations = citationsUsedIn(explanation, toCitations(chunks));
  const outcome = classifyLearnOutcome({
    documentStatuses: [ready],
    sourceDocumentIds: [ready.id],
    evidenceDocumentIds: [ready.id],
    evidenceChunkCount: 1
  });
  if (outcome.kind !== "ready") throw new Error("fixture must produce a ready outcome");
  const response = buildLearnSuccess({
    topicId: "topic-1", level: "standard", explanation, citations,
    outcome: outcome as LearnOutcome & { kind: "ready" }
  });
  if (!("level" in response) || !response.citations) throw new Error("sourced fixture must be a lesson");

  assert.equal(response.topicId, "topic-1");
  assert.equal(response.level, "standard");
  assert.equal(response.explanation, explanation);
  assert.deepEqual(response.citations, citations);
  assert.equal(response.citations[0].documentName, "Government guide.pdf");
  assert.equal(response.citations[0].pageNumber, 2);
  assert.equal(response.outcome.kind, "ready");

  const done = learnStreamDone({ text: explanation, citations, grounded: true }, outcome);
  const wire = `data: ${JSON.stringify(done)}\n\n`;
  const decoded = JSON.parse(wire.slice("data: ".length).trim());
  assert.equal(decoded.type, "done");
  assert.equal(decoded.text, explanation);
  assert.deepEqual(decoded.citations, citations);
  assert.equal(decoded.grounded, true);
  assert.deepEqual(readLearnOutcome(decoded.outcome), outcome);

  const failed = classifyLearnOutcome({ documentStatuses: [ready], failure: "generation_error" });
  const error = learnStreamError(failed);
  assert.equal(error.type, "error");
  assert.deepEqual(error.outcome, failed);
  assert.ok(error.error.includes("retry"));
  assert.deepEqual(Object.keys(error).sort(), ["error", "outcome", "type"], "no provider details cross the wire");

  const chatRoute = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(chatRoute, /learnStreamDone\(/, "the chat route uses the tested completion serializer");
  assert.match(chatRoute, /learnStreamError\(/, "the chat route uses the tested error serializer");
});
