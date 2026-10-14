import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AI_OPERATION_HEADER, abortGesture, beginGesture, createGestureBook, finishGesture, operationHeaders
} from "./ai-operation-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8a-f0-9]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("a gesture keeps one id across an in-flight lock and a same-body retry", () => {
  const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"];
  const mint = () => ids.shift()!;
  const first = beginGesture(null, "body-a", mint);
  assert.equal(first.started, true);
  assert.equal(first.gesture.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  const overlap = beginGesture(first.gesture, "body-a", mint);
  assert.equal(overlap.started, false);
  assert.equal(overlap.gesture.id, first.gesture.id);
  const retried = beginGesture(abortGesture(first.gesture), "body-a", mint);
  assert.equal(retried.started, true);
  assert.equal(retried.gesture.id, first.gesture.id);
  assert.equal(ids.length, 1);
});

test("an ordinary failure can start a different request, but 409 and 202 cannot", () => {
  const ids = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"];
  const mint = () => ids.shift()!;
  const failed = finishGesture(beginGesture(null, "body-a", mint).gesture, 429);
  assert.ok(failed);
  const changed = beginGesture(failed, "body-b", mint);
  assert.equal(changed.gesture.id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2");
  const sealed = finishGesture(changed.gesture, 409);
  assert.equal(sealed?.sealed, true);
  const replay = beginGesture(sealed!, "body-c", mint);
  assert.equal(replay.gesture.id, sealed!.id);
  const completed = finishGesture(beginGesture(null, "done", mint).gesture, 202);
  assert.equal(beginGesture(completed!, "other", mint).gesture.id, completed!.id);
  assert.equal(finishGesture(beginGesture(null, "ok", mint).gesture, 200), null);
});

test("the book does not mint a second id for a sealed or in-flight slot", () => {
  let n = 0;
  const book = createGestureBook(() => `cccccccc-cccc-4ccc-8ccc-ccccccccccc${++n}`);
  const first = book.begin("quiz", "same");
  const second = book.begin("quiz", "same");
  assert.equal(second.started, false);
  assert.equal(second.id, first.id);
  book.finish("quiz", 503);
  const retry = book.begin("quiz", "same");
  assert.equal(retry.id, first.id);
  book.finish("quiz", 409);
  const afterConflict = book.begin("quiz", "different");
  assert.equal(afterConflict.id, first.id);
  book.finish("quiz", 200);
  const fresh = book.begin("quiz", "different");
  assert.notEqual(fresh.id, first.id);
});

test("operation headers carry the stable id and do not drop a content type", () => {
  const headers = operationHeaders("dddddddd-dddd-4ddd-8ddd-dddddddddddd", { "Content-Type": "application/json" });
  assert.equal(headers.get(AI_OPERATION_HEADER), "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  assert.equal(headers.get("Content-Type"), "application/json");
  assert.match(headers.get(AI_OPERATION_HEADER)!, UUID);
});

function slice(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

test("billable room actions send one stable operation id and manual topic create does not", () => {
  const room = new URL("../components/room/", import.meta.url);
  const coach = readFileSync(new URL("coach-panel.tsx", room), "utf8");
  const learn = readFileSync(new URL("learn-panel.tsx", room), "utf8");
  const quiz = readFileSync(new URL("quiz-panel.tsx", room), "utf8");
  const cards = readFileSync(new URL("cards-panel.tsx", room), "utf8");
  const practice = readFileSync(new URL("practice-test-panel.tsx", room), "utf8");
  const materials = readFileSync(new URL("materials-panel.tsx", room), "utf8");

  const coachFetch = slice(coach, "const endpoint = isFixture", "const reader = response.body");
  assert.match(coachFetch, /operationHeaders\(interactionId\)/);

  for (const endpoint of [
    'fetch("/api/learn"',
    'fetch("/api/learn/check"',
    'fetch("/api/topics", { method: "POST", headers: operationHeaders(attempt.id), body })',
    'fetch("/api/quiz"',
    'fetch("/api/quiz/attempt"',
    'fetch("/api/flashcards", { method: "POST", headers: operationHeaders(attempt.id), body })',
    "fetch('/api/practice-tests',{method:'POST',headers:operationHeaders(attempt.id),body}",
    "fetch('/api/practice-tests/submit'",
    'fetch("/api/documents/reindex"',
    'fetch("/api/documents/process"',
    'fetch("/api/documents/upload/prepare"'
  ]) {
    const haystack = [learn, quiz, cards, practice, materials, coach].join("\n");
    const at = haystack.indexOf(endpoint);
    assert.notEqual(at, -1, endpoint);
    assert.match(haystack.slice(at, at + 220), /operationHeaders\(/, endpoint);
  }
  assert.equal(learn.match(/fetch\("\/api\/learn\/check"/g)?.length, 2);

  const create = slice(learn, "async function addTopic", "async function buildTopicMap");
  assert.match(create, /intent: "create"/);
  assert.doesNotMatch(create, /operationHeaders|x-studigo-operation-id/);

  const finalize = slice(materials, 'fetch("/api/documents/upload/complete"', "setQueue");
  assert.match(finalize, /"Content-Type": "application\/json"/);
  assert.doesNotMatch(finalize, /operationHeaders|x-studigo-operation-id/);
  assert.doesNotMatch(materials, /crypto\.randomUUID\(\)/);
  assert.match(practice, /method:'PATCH',headers:\{'Content-Type':'application\/json'\}/);
});
