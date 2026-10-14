import assert from "node:assert/strict";
import { test } from "node:test";
import type { RetrievedChunk } from "@studigo/ai";
import { passagesForLesson, planContextualSearch, type LessonTopic } from "./contextual-retrieval";
import { classifyLearnOutcome } from "./learn-outcome";

const branches: LessonTopic = {
  id: "branches",
  title: "Three Branches of Government",
  objective: "I can identify the legislative, executive, and judicial branches.",
  keyTerms: ["legislative branch", "executive branch", "judicial branch"]
};

const chunks: RetrievedChunk[] = [
  chunk("c-leg", "The legislative branch makes laws."),
  chunk("c-exe", "The executive branch enforces laws."),
  chunk("c-jud", "The judicial branch reviews laws.")
];

function chunk(id: string, content: string): RetrievedChunk {
  return {
    id,
    documentId: "guide",
    documentName: "Government study guide",
    content,
    similarity: 0.8,
    pageNumber: 1,
    pageLabel: "Page"
  };
}

test("C05 known government term returns the supporting definition", () => {
  const plan = planContextualSearch({
    topics: [branches],
    question: "What is the legislative branch?",
    history: [
      { role: "assistant", content: "The pizza special is pepperoni." },
      { role: "user", content: "What toppings are on pizza?" }
    ]
  });
  assert.equal(plan.kind, "search");
  if (plan.kind !== "search") return;
  assert.match(plan.query, /legislative branch/i);
  assert.match(plan.query, /Three Branches of Government/);
  assert.doesNotMatch(plan.query, /pizza|pepperoni/i);
  const passages = passagesForLesson({ topic: plan.topic, substantive: plan.substantive, chunks });
  assert.equal(passages.length, 1);
  assert.equal(passages[0].chunk.id, "c-leg");
  assert.match(passages[0].excerpt, /makes laws/);
});

test("C05 Help stays on the lesson and a fabricated fact abstains", () => {
  const help = planContextualSearch({
    topics: [branches],
    question: "Help",
    history: [
      { role: "user", content: "What toppings are on pizza?" },
      { role: "assistant", content: "Pepperoni is not a government source." },
      { role: "user", content: "What is the legislative branch?" },
      { role: "assistant", content: "The pizza special is pepperoni, and the legislative branch makes laws." }
    ]
  });
  assert.equal(help.kind, "search");
  if (help.kind !== "search") return;
  assert.match(help.query, /legislative branch/i);
  assert.doesNotMatch(help.query, /pizza|pepperoni/i);
  assert.equal(help.substantive, "What is the legislative branch?");
  const helped = passagesForLesson({ topic: help.topic, substantive: help.substantive, chunks });
  assert.equal(helped[0]?.chunk.id, "c-leg");

  const fabricated = planContextualSearch({
    topics: [branches],
    question: "The legislative branch commands the army."
  });
  assert.equal(fabricated.kind, "search");
  if (fabricated.kind !== "search") return;
  const unsupported = passagesForLesson({
    topic: fabricated.topic,
    substantive: fabricated.substantive,
    chunks
  });
  assert.equal(unsupported.length, 0);
  const outcome = classifyLearnOutcome({
    documentStatuses: [{ id: "guide", status: "ready" }],
    evidenceChunkCount: unsupported.length
  });
  assert.equal(outcome.kind, "no_relevant_evidence");

  const offTopicHelp = planContextualSearch({
    topics: [branches],
    question: "Help",
    history: [
      { role: "user", content: "What toppings are on pizza?" },
      { role: "assistant", content: "Pepperoni." }
    ]
  });
  assert.equal(offTopicHelp.kind, "search");
  if (offTopicHelp.kind !== "search") return;
  assert.doesNotMatch(offTopicHelp.query, /pizza|pepperoni/i);
});
