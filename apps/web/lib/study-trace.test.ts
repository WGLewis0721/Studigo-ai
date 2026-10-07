import assert from "node:assert/strict";
import { test } from "node:test";
import { studyTraceRecord, writeStudyTrace } from "./study-trace";

const OWNER = "00000000-0000-4000-8000-000000000001";

test("study trace hashes the owner and drops prompt, content, and filename", () => {
  const record = studyTraceRecord({
    route: "retrieval",
    ownerId: OWNER,
    chunkIds: ["10000000-0000-4000-8000-000000000099"],
    cutoff: 0.35,
    tokenEstimate: 12,
    latencyMs: 4,
    prompt: "system prompt that must not be logged anywhere",
    question: "what is photosynthesis in this room",
    content: "chunk text about chloroplasts must stay out",
    filename: "chapter-notes.pdf",
    query: "photosynthesis query text"
  });
  const json = JSON.stringify(record);
  assert.equal(record.ownerHash?.length, 16);
  assert.notEqual(record.ownerHash, OWNER);
  assert.equal(json.includes(OWNER), false);
  assert.equal(json.includes("photosynthesis"), false);
  assert.equal(json.includes("chloroplast"), false);
  assert.equal(json.includes("chapter-notes"), false);
  assert.equal(json.includes("system prompt"), false);
  assert.equal(record.promptVersion, "retrieval-2026-10-07");
  assert.equal(record.transport, "unset");
});

test("writeStudyTrace logs the allowlisted record only", () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (line?: unknown) => {
    lines.push(String(line));
  };
  try {
    writeStudyTrace({
      route: "api/chat",
      ownerId: OWNER,
      chunkIds: [],
      cutoff: 0.35,
      tokenEstimate: 0,
      latencyMs: 1,
      answer: "the model answer must not be logged"
    });
  } finally {
    console.info = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /"studigo_trace"/);
  assert.equal(lines[0].includes("model answer"), false);
  assert.equal(lines[0].includes(OWNER), false);
});
