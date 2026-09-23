import assert from "node:assert/strict";
import test from "node:test";
import type { GeneratedQuestion } from "@studigo/ai";
import type { Topic } from "./rooms";
import type { PracticeEvidence } from "./study-planning";
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MAX_PRACTICE_COUNT,
  buildPracticeQuestionSet,
  citationsForQuestions,
  classifyIntent,
  dedupeQuestions,
  extractPriorPromptsFromHistory,
  formatQuestionsForChat,
  isNearDuplicateText,
  resolvePracticeTopic
} from "./recommendation-engine";

function topic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: "topic-1",
    room_id: "room-1",
    title: "Balanced and unbalanced forces",
    objective: "Explain how unbalanced forces change motion.",
    key_terms: [],
    priority: 60,
    order_index: 0,
    origin: "study_guide",
    mastery_score: 40,
    status: "learning",
    last_practiced_at: "2026-09-10T12:00:00Z",
    ...overrides
  };
}

function question(overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    kind: "true_false",
    prompt: "Balanced forces change an object's speed.",
    choices: ["True", "False"],
    correctChoice: 1,
    expectedAnswer: null,
    acceptedAnswers: [],
    explanation: "Balanced forces do not change motion.",
    difficulty: "core",
    sourceMarkers: [1],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// classifyIntent
// ---------------------------------------------------------------------------

test("classifyIntent reads a digit count out of a practice-question request", () => {
  const intent = classifyIntent("Can you give me 10 questions on forces?");
  assert.deepEqual(intent, { type: "practice_questions", count: 10 });
});

test("classifyIntent reads a spelled-out count", () => {
  assert.deepEqual(classifyIntent("give me ten more questions"), { type: "practice_questions", count: 10 });
  assert.deepEqual(classifyIntent("ask me five practice questions"), { type: "practice_questions", count: 5 });
});

test("classifyIntent recognizes generic quiz requests without an explicit count", () => {
  assert.deepEqual(classifyIntent("quiz me on this topic"), { type: "practice_questions", count: 5 });
  assert.deepEqual(classifyIntent("give me some practice questions"), { type: "practice_questions", count: 5 });
});

test("classifyIntent clamps an out-of-range count instead of trusting the learner's number literally", () => {
  assert.deepEqual(classifyIntent("give me 500 questions"), { type: "practice_questions", count: MAX_PRACTICE_COUNT });
  assert.deepEqual(classifyIntent("give me 0 questions"), { type: "practice_questions", count: 1 });
});

test("classifyIntent leaves ordinary questions as plain Q&A", () => {
  assert.deepEqual(classifyIntent("What is Newton's second law?"), { type: "qa" });
  assert.deepEqual(classifyIntent("Can you explain balanced forces?"), { type: "qa" });
  assert.deepEqual(classifyIntent(""), { type: "qa" });
});

// ---------------------------------------------------------------------------
// resolvePracticeTopic
// ---------------------------------------------------------------------------

test("resolvePracticeTopic prefers a topic the learner names explicitly", () => {
  const topics = [topic({ id: "a", title: "Fossils and rock layers", priority: 40 }), topic({ id: "b", title: "Balanced and unbalanced forces", priority: 90 })];
  const resolved = resolvePracticeTopic({ message: "quiz me on fossils and rock layers", topics, evidence: [] });
  assert.equal(resolved?.topic.id, "a");
});

test("resolvePracticeTopic falls back to the learner's weakest topic when none is named", () => {
  const topics = [
    topic({ id: "strong", title: "Dissolving", mastery_score: 95, status: "mastered", priority: 40 }),
    topic({ id: "weak", title: "Balanced and unbalanced forces", mastery_score: 20, priority: 90, last_practiced_at: null, status: "not_started" })
  ];
  const resolved = resolvePracticeTopic({ message: "give me 5 questions", topics, evidence: [] });
  assert.equal(resolved?.topic.id, "weak");
});

test("resolvePracticeTopic falls back to teacher priority when every topic already looks mastered", () => {
  const topics = [
    topic({ id: "low", title: "Dissolving", mastery_score: 96, status: "mastered", priority: 40, last_practiced_at: "2026-09-12T00:00:00Z" }),
    topic({ id: "high", title: "Fossils and rock layers", mastery_score: 97, status: "mastered", priority: 90, last_practiced_at: "2026-09-12T00:00:00Z" })
  ];
  const resolved = resolvePracticeTopic({
    message: "give me 5 questions",
    topics,
    evidence: [],
    now: Date.parse("2026-09-12T06:00:00Z")
  });
  assert.equal(resolved?.topic.id, "high");
});

test("resolvePracticeTopic returns null when the room has no topics", () => {
  assert.equal(resolvePracticeTopic({ message: "give me 5 questions", topics: [], evidence: [] }), null);
});

// ---------------------------------------------------------------------------
// dedupe (k-shingling + Jaccard similarity)
// ---------------------------------------------------------------------------

test("isNearDuplicateText flags a trivially reworded restatement", () => {
  assert.ok(
    isNearDuplicateText(
      "What force acts on a book resting on a table?",
      "What force is acting on a book that is resting on a table?"
    )
  );
});

test("isNearDuplicateText does not flag two genuinely different questions", () => {
  assert.equal(
    isNearDuplicateText(
      "What force acts on a book resting on a table?",
      "Why does the Moon orbit the Earth instead of flying off into space?"
    ),
    false
  );
});

test("dedupeQuestions drops a candidate that repeats a prior prompt", () => {
  const candidates = [
    question({ prompt: "What force acts on a book resting on a table?" }),
    question({ prompt: "Why does a dropped ball accelerate toward the ground?" })
  ];
  const kept = dedupeQuestions(candidates, ["What force is acting on a book that is resting on a table?"]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].prompt, "Why does a dropped ball accelerate toward the ground?");
});

test("dedupeQuestions also drops near-duplicates within the same batch", () => {
  const candidates = [
    question({ prompt: "What happens when forces on an object are balanced?" }),
    question({ prompt: "What happens when the forces acting on an object are balanced?" }),
    question({ prompt: "What happens when forces on an object are unbalanced?" })
  ];
  const kept = dedupeQuestions(candidates);
  assert.equal(kept.length, 2);
});

test("dedupeQuestions threshold is exposed and reasonable", () => {
  assert.ok(DUPLICATE_SIMILARITY_THRESHOLD > 0 && DUPLICATE_SIMILARITY_THRESHOLD < 1);
});

// ---------------------------------------------------------------------------
// extractPriorPromptsFromHistory
// ---------------------------------------------------------------------------

test("extractPriorPromptsFromHistory pulls numbered prompts out of a prior coach reply", () => {
  const history = [
    { role: "user" as const, content: "give me 3 questions" },
    {
      role: "assistant" as const,
      content:
        "Here are 3 practice questions grounded in your study guide, focused on balanced and unbalanced forces:\n\n1. What force acts on a resting book? [1]\n\n2. (True or False) Balanced forces change speed. [2]\n\n3. Why does a pushed cart speed up? [1]\n\nAnswer any of these and I'll check your reasoning against the material."
    }
  ];
  const prompts = extractPriorPromptsFromHistory(history);
  assert.deepEqual(prompts, [
    "What force acts on a resting book?",
    "(True or False) Balanced forces change speed.",
    "Why does a pushed cart speed up?"
  ]);
});

test("extractPriorPromptsFromHistory ignores user turns and non-numbered assistant text", () => {
  const history = [
    { role: "user" as const, content: "1. this looks like a list but is from the learner" },
    { role: "assistant" as const, content: "Balanced forces do not change an object's motion." }
  ];
  assert.deepEqual(extractPriorPromptsFromHistory(history), []);
});

// ---------------------------------------------------------------------------
// buildPracticeQuestionSet — the RAG + LLM call is injected so this is a pure
// unit test of the orchestration (top-up retries, dedup, count enforcement).
// ---------------------------------------------------------------------------

const CHUNK = {
  id: "chunk-1",
  documentId: "doc-1",
  documentName: "Study guide.pdf",
  content: "Balanced forces do not change an object's motion.",
  similarity: 0.9,
  sourceType: "study_guide" as const,
  pageNumber: 1,
  pageLabel: "Page",
  priority: 90
};

// A pool of genuinely distinct subjects so a mock `generate` can stand in for
// a model that has enough unique material to draw on. Two prompts built from
// different subjects share only "explain"/"effect" (Jaccard ~0.5), so they
// stay under the near-duplicate threshold — unlike prompts that differ by a
// single index number, which the dedup layer rightly collapses.
const DISTINCT_SUBJECTS = [
  "gravity", "friction", "momentum", "inertia", "acceleration",
  "velocity", "buoyancy", "tension", "torque", "magnetism",
  "elasticity", "density", "thrust", "drag", "compression",
  "vibration", "rotation", "collision", "expansion", "conduction",
  "radiation", "convection", "reflection", "refraction", "resonance",
  "oscillation", "turbulence", "viscosity", "cohesion", "adhesion",
  "capillarity", "sublimation", "condensation", "evaporation", "crystallization",
  "diffraction", "polarization", "ionization", "combustion", "fermentation"
];
let subjectCursor = 0;
function distinctQuestion(): GeneratedQuestion {
  const subject = DISTINCT_SUBJECTS[subjectCursor % DISTINCT_SUBJECTS.length];
  subjectCursor += 1;
  return question({ prompt: `Explain the effect of ${subject} here?` });
}

test("buildPracticeQuestionSet returns exactly the requested count when the model has enough unique material", async () => {
  const generate = async ({ count }: { count: number }) => {
    return Array.from({ length: count }, () => distinctQuestion());
  };
  const result = await buildPracticeQuestionSet({ chunks: [CHUNK], count: 10, generate: generate as never });
  assert.equal(result.length, 10);
  const prompts = new Set(result.map((q) => q.prompt));
  assert.equal(prompts.size, 10, "no duplicates should reach the learner");
});

test("buildPracticeQuestionSet tops up with additional attempts when the first batch has duplicates", async () => {
  let call = 0;
  const generate = async ({ count }: { count: number }) => {
    call += 1;
    if (call === 1) {
      // The model returns mostly the same question restated — realistic failure mode.
      return Array.from({ length: count }, () => question({ prompt: "What happens when forces on an object are balanced?" }));
    }
    return Array.from({ length: count }, () => distinctQuestion());
  };
  const result = await buildPracticeQuestionSet({ chunks: [CHUNK], count: 5, generate: generate as never });
  assert.equal(result.length, 5);
  assert.ok(call > 1, "should have retried after the first batch collapsed to duplicates");
  const prompts = new Set(result.map((q) => q.prompt));
  assert.equal(prompts.size, 5);
});

test("buildPracticeQuestionSet excludes prior conversation prompts across every attempt", async () => {
  const prior = ["What happens when forces on an object are balanced?"];
  const generate = async ({ count }: { count: number }) =>
    Array.from({ length: count }, () => question({ prompt: "What happens when forces on an object are balanced?" }));
  const result = await buildPracticeQuestionSet({ chunks: [CHUNK], count: 3, priorPrompts: prior, generate: generate as never });
  assert.equal(result.length, 0, "a model that only ever repeats the prior prompt should yield nothing, not a duplicate");
});

test("buildPracticeQuestionSet never asks for more than the bounded retry budget implies", async () => {
  const requestedCounts: number[] = [];
  const generate = async ({ count }: { count: number }) => {
    requestedCounts.push(count);
    return [];
  };
  await buildPracticeQuestionSet({ chunks: [CHUNK], count: 5, generate: generate as never });
  assert.equal(requestedCounts.length, 3, "gives up after a bounded number of attempts rather than looping forever");
  for (const count of requestedCounts) assert.ok(count <= MAX_PRACTICE_COUNT * 2);
});

test("buildPracticeQuestionSet returns nothing when there are no chunks to ground on", async () => {
  const generate = async () => [question()];
  const result = await buildPracticeQuestionSet({ chunks: [], count: 5, generate: generate as never });
  assert.equal(result.length, 0);
});

// ---------------------------------------------------------------------------
// formatQuestionsForChat / citationsForQuestions
// ---------------------------------------------------------------------------

test("formatQuestionsForChat never self-narrates coaching directives, only content", () => {
  const text = formatQuestionsForChat({
    questions: [question({ prompt: "What force acts on a resting book?" })],
    topicTitle: "Balanced and unbalanced forces",
    sourceLabel: "Study guide.pdf"
  });
  assert.ok(text.includes("What force acts on a resting book?"));
  assert.ok(!/coaching style|learning tradition|practice protocol/i.test(text));
});

test("formatQuestionsForChat explains itself instead of returning an empty reply when nothing survives dedup", () => {
  const text = formatQuestionsForChat({ questions: [], topicTitle: "Balanced and unbalanced forces", sourceLabel: "Study guide.pdf" });
  assert.ok(text.toLowerCase().includes("don't have enough"));
});

test("citationsForQuestions only keeps citations the returned questions actually cite", () => {
  const available = [
    { marker: 1, documentId: "doc-1", documentName: "Study guide.pdf", pageNumber: 1, pageLabel: "Page" },
    { marker: 2, documentId: "doc-1", documentName: "Study guide.pdf", pageNumber: 2, pageLabel: "Page" }
  ];
  const kept = citationsForQuestions([question({ sourceMarkers: [2] })], available as never);
  assert.deepEqual(kept.map((c) => c.marker), [2]);
});

void ({} as PracticeEvidence);
