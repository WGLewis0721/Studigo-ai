import assert from "node:assert/strict";
import { test } from "node:test";
import type { GuideChapter, GuideSourceBlock } from "@studigo/ai";
import { buildPersistedEdition, type GuideEditionStore } from "./study-guide-content";

const blocks: GuideSourceBlock[] = [{
  blockKey: "p1",
  pageNumber: 1,
  text: "The legislative branch makes laws.",
  kind: "paragraph"
}];

function memoryStore(): GuideEditionStore & { puts: number } {
  const rows = new Map<string, unknown>();
  return {
    puts: 0,
    async get(key) {
      return (rows.get(key) as never) ?? null;
    },
    async put(key, content) {
      this.puts += 1;
      rows.set(key, content);
      return content;
    }
  };
}

test("C15 invalid output is not stored and a duplicate build runs once", async () => {
  const empty = memoryStore();
  let calls = 0;
  const invalid = await buildPersistedEdition({
    roomId: "room",
    level: "general",
    topicIds: [],
    blocks,
    store: empty,
    generate: async () => {
      calls += 1;
      return [{
        id: "bad",
        title: "Outside",
        objective: "The moon is made of cheese.",
        objectiveEvidence: [{ blockKey: "missing", pageNumber: 1 }],
        facts: [],
        terms: [],
        examples: [],
        practice: [],
        answers: []
      }] as GuideChapter[];
    }
  });
  assert.equal(invalid.status, "unsupported");
  assert.equal(calls, 2);
  assert.equal(empty.puts, 0);

  const store = memoryStore();
  let builds = 0;
  const generate = async () => {
    builds += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return [{
      id: "chapter-1",
      title: "The legislative branch makes laws.",
      objective: "The legislative branch makes laws.",
      objectiveEvidence: [{ blockKey: "p1", pageNumber: 1 }],
      facts: [{ id: "fact-1", text: "The legislative branch makes laws.", evidence: [{ blockKey: "p1", pageNumber: 1 }] }],
      terms: [],
      examples: [],
      practice: [{
        id: "question-1",
        prompt: "What does the legislative branch do?",
        answerId: "answer-1",
        evidence: [{ blockKey: "p1", pageNumber: 1 }]
      }],
      answers: [{
        id: "answer-1",
        questionId: "question-1",
        text: "The legislative branch makes laws.",
        evidence: [{ blockKey: "p1", pageNumber: 1 }]
      }]
    }] as GuideChapter[];
  };
  const [first, second] = await Promise.all([
    buildPersistedEdition({ roomId: "room", level: "general", topicIds: ["laws"], blocks, store, generate }),
    buildPersistedEdition({ roomId: "room", level: "general", topicIds: ["laws"], blocks, store, generate })
  ]);
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status === "ready" && second.status === "ready") assert.equal(first.content, second.content);
  assert.equal(builds, 1);
  assert.equal(store.puts, 1);
});
