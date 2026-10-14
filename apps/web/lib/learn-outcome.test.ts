import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLearnOutcome, isLearnSuccess, learnOutcomeMessage, type LearnMaterial, type LearnReasonCode } from "./learn-outcome";
import { scopeTopicsForRequest } from "./engine";
import type { Topic } from "./rooms";

const ready: LearnMaterial = { id: "ready-doc", status: "ready" };
const processing: LearnMaterial = { id: "queued-doc", status: "processing" };
const failed: LearnMaterial = { id: "failed-doc", status: "failed" };

test("Learn outcome contract distinguishes availability, matching, scope and stage failures", () => {
  const cases: Array<{
    name: string;
    materials: LearnMaterial[];
    evidenceCount?: number;
    error?: "invalid_topic_scope" | "retrieval_error" | "generation_error";
    reason: LearnReasonCode;
    retryable: boolean;
    counts: [number, number, number];
  }> = [
    { name: "ready", materials: [ready], evidenceCount: 1, reason: "ready", retryable: false, counts: [1, 0, 0] },
    { name: "partial", materials: [ready, processing, failed], evidenceCount: 1, reason: "partial_coverage", retryable: false, counts: [1, 1, 1] },
    { name: "processing", materials: [processing], reason: "materials_processing", retryable: true, counts: [0, 1, 0] },
    { name: "empty", materials: [], reason: "no_ready_materials", retryable: false, counts: [0, 0, 0] },
    { name: "ready but no match", materials: [ready], evidenceCount: 0, reason: "no_relevant_evidence", retryable: false, counts: [1, 0, 0] },
    { name: "invalid scope", materials: [ready], error: "invalid_topic_scope", reason: "invalid_topic_scope", retryable: false, counts: [1, 0, 0] },
    { name: "retrieval failed", materials: [ready], error: "retrieval_error", reason: "retrieval_error", retryable: true, counts: [1, 0, 0] },
    { name: "generation failed", materials: [ready], error: "generation_error", reason: "generation_error", retryable: true, counts: [1, 0, 0] }
  ];

  for (const item of cases) {
    const outcome = classifyLearnOutcome(item);
    assert.equal(outcome.reasonCode, item.reason, item.name);
    assert.equal(outcome.retryable, item.retryable, item.name);
    assert.deepEqual(Object.values(outcome.counts), item.counts, item.name);
    assert.deepEqual(outcome.coverageIds, item.materials.filter((material) => material.status === "ready").map((material) => material.id), item.name);
    assert.equal(isLearnSuccess(outcome), item.reason === "ready" || item.reason === "partial_coverage", item.name);
    assert.ok(learnOutcomeMessage(outcome.reasonCode).length > 10, item.name);
  }
  assert.notEqual(learnOutcomeMessage("materials_processing"), learnOutcomeMessage("no_ready_materials"));
  assert.notEqual(learnOutcomeMessage("retrieval_error"), learnOutcomeMessage("generation_error"));
  assert.match(learnOutcomeMessage("no_relevant_evidence"), /materials are available/i);

  const topics = [{ id: "topic-one" }, { id: "topic-two" }] as Topic[];
  assert.deepEqual(scopeTopicsForRequest(topics, ["topic-two"]).map((topic) => topic.id), ["topic-two"]);
  assert.throws(() => scopeTopicsForRequest(topics, ["topic-one", "removed-topic"]), /no longer available/);
});
