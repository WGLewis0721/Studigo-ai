import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guarded = [
  ["chat", "chat"],
  ["learn", "learn"],
  ["learn/check", "learn-check"],
  ["quiz", "quiz-generate"],
  ["quiz/attempt", "quiz-grade"],
  ["flashcards", "flashcards-generate"],
  ["flashcards/local", "flashcards-local"],
  ["practice-tests", "practice-test-generate"],
  ["practice-tests/submit", "practice-test-grade"],
  ["documents/upload", "document-upload"],
  ["documents/upload/prepare", "document-upload"],
  ["documents/process", "document-process"],
  ["documents/reindex", "document-reindex"],
  ["topics", "topic-regenerate"]
] as const;

test("every known model, OCR, embedding or regeneration POST route has a server guard", () => {
  for (const [route, operation] of guarded) {
    const url = new URL("../app/api/" + route + "/route.ts", import.meta.url);
    const source = readFileSync(url, "utf8");
    assert.match(source, /guardAiRequest/, route);
    assert.ok(source.includes('guardAiRequest(request, "' + operation + '", guardedPost)'), route);
    assert.ok(source.includes("async function guardedPost(request: Request)"), route);
  }
});

test("topic creation remains available without AI generation", () => {
  const source = readFileSync(new URL("../app/api/topics/route.ts", import.meta.url), "utf8");
  assert.ok(source.includes('body?.intent === "create") return guardedPost(request)'));
  assert.equal(source.includes("guardAiRequest"), true);
});

test("learn, streams, embeddings and OCR cannot call the provider outside the admission helpers", () => {
  const root = new URL("../../../packages/ai/src/", import.meta.url);
  const explain = readFileSync(new URL("study.ts", root), "utf8");
  const explainFn = explain.slice(explain.indexOf("export async function explainTopic"));
  assert.match(explainFn, /debitResponseWork\(/);
  assert.match(explainFn, /trackProviderCall\(/);
  assert.match(explainFn, /providerAbortSignal\(/);
  const grounding = readFileSync(new URL("grounding.ts", root), "utf8");
  assert.doesNotMatch(grounding, /args\.signal \?\? providerAbortSignal\(\)/);
  assert.match(grounding, /providerAbortSignal\(args\.signal\)/);
  const ocr = readFileSync(new URL("ocr.ts", root), "utf8");
  assert.match(ocr, /executeAdmittedOcrRequest/);
  assert.match(ocr, /maxRetries:\s*0/);
  assert.doesNotMatch(ocr, /AbortSignal\.timeout/);
  const contract = readFileSync(new URL("ocr-admission.ts", root), "utf8");
  for (const helper of ["debitResponseWork", "providerAbortSignal", "trackProviderCall"]) {
    assert.match(contract, new RegExp(helper));
  }
  assert.doesNotMatch(contract, /pagesNeedingOcr|includeQuality/);
});

test("unguarded API routes do not import a billable provider entrypoint", () => {
  const billable = /generateQuizQuestions|explainTopic|askSocraticQuestion|respondToSocraticAnswer|generateFlashcards|ocrPagePdf|ocrImage|embedTexts|streamGroundedAnswer|extractTopicMap|processDocument|buildTopicMap|runStudigoEngine|gradeAnswer/;
  const api = new URL("../app/api/", import.meta.url);
  const routes = [
    "chat/route.ts", "learn/route.ts", "learn/check/route.ts", "learn/preferences/route.ts",
    "quiz/route.ts", "quiz/attempt/route.ts", "flashcards/route.ts", "flashcards/local/route.ts",
    "flashcards/review/route.ts", "practice-tests/route.ts", "practice-tests/submit/route.ts",
    "documents/upload/route.ts", "documents/upload/prepare/route.ts", "documents/process/route.ts", "documents/reindex/route.ts",
    "topics/route.ts", "dev/coach/route.ts", "study-plan/route.ts", "learning/challenge/route.ts",
    "coach/preferences/route.ts", "local-beta/route.ts", "v1/learning/sessions/route.ts"
  ];
  for (const route of routes) {
    const source = readFileSync(new URL(route, api), "utf8");
    if (!billable.test(source)) continue;
    assert.equal(source.includes("guardAiRequest"), true, route);
  }
  const dev = readFileSync(new URL("dev/coach/route.ts", api), "utf8");
  assert.match(dev, /NODE_ENV !== "development"/);
  assert.doesNotMatch(dev, /guardAiRequest/);
  const topics = readFileSync(new URL("topics/route.ts", api), "utf8");
  assert.match(topics, /intent === "create"\) return guardedPost\(request\)/);
});

test("the native admission policy inventories every route operation", async () => {
  const { estimatedReservation } = await import("./ai-admission-policy");
  for (const [,operation] of guarded) assert.ok(estimatedReservation(operation)>0,operation);
});
