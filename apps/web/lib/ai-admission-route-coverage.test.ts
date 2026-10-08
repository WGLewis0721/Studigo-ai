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
});

test("the native admission policy inventories every route operation", async () => {
  const { estimatedReservation } = await import("./ai-admission-policy");
  for (const [,operation] of guarded) assert.ok(estimatedReservation(operation)>0,operation);
});
