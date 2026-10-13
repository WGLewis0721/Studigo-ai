import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");
const routeSource = (route: string) => read(`../app/api/${route}/route.ts`);

const routes = [
  "chat",
  "learn",
  "learn/check",
  "quiz",
  "quiz/attempt",
  "practice-tests",
  "flashcards",
  "documents/process",
  "documents/reindex"
];

const guarded = [
  "retrieveForRoom",
  "explainTopic",
  "askSocraticQuestion",
  "respondToSocraticAnswer",
  "generateQuizQuestions",
  "generateFlashcards",
  "gradeAnswer",
  "processDocument",
  "runStudigoEngine"
];

for (const route of routes) {
  test(`${route} route reserves AI budget before any provider or retrieval call`, () => {
    const source = routeSource(route);
    const reserve = source.indexOf("reserveAiBudget(");
    assert.notEqual(reserve, -1, `${route}: route.ts never calls reserveAiBudget(`);

    const present = guarded
      .map((name) => ({ name, index: source.indexOf(`${name}(`) }))
      .filter((entry) => entry.index !== -1);
    for (const { name, index } of present) {
      assert.ok(
        reserve < index,
        `${route}: reserveAiBudget( (index ${reserve}) must come before first ${name} (index ${index})`
      );
    }
  });
}

test("documents/reindex checks the cooldown, then the budget, then processes", () => {
  const source = routeSource("documents/reindex");
  const cooldown = source.indexOf("reindexCooldownElapsed");
  const reserve = source.indexOf("reserveAiBudget(");
  const process = source.indexOf("processDocument(");
  assert.notEqual(cooldown, -1, "documents/reindex: reindexCooldownElapsed is never referenced");
  assert.notEqual(reserve, -1, "documents/reindex: reserveAiBudget( is never called");
  assert.notEqual(process, -1, "documents/reindex: processDocument is never referenced");
  assert.ok(cooldown < reserve, "documents/reindex: reindexCooldownElapsed must come before reserveAiBudget(");
  assert.ok(reserve < process, "documents/reindex: reserveAiBudget( must come before processDocument");
});

test("ingest processDocument carries the reindex cooldown guard", () => {
  assert.match(read("ingest.ts"), /reindexCooldownElapsed/, "lib/ingest.ts must reference reindexCooldownElapsed");
});
