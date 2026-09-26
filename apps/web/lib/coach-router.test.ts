import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachEvaluation, RetrievedChunk } from "@studigo/ai";
import { runCoachTurn } from "./coach-router";
import type { Topic } from "./rooms";

/**
 * Minimal fake of the `supabase.from("conversations")` surface `coach-router`
 * actually calls: `select().eq().maybeSingle()` to load state and
 * `update().eq()` to save it. Each can be configured to return a Postgres-
 * style `{ data, error }` result so tests can assert on the DB-failure path
 * without a real database.
 */
function fakeSupabase(options: {
  loadResult?: { data: unknown; error: { message: string } | null };
  saveResult?: { error: { message: string } | null };
}): SupabaseClient {
  const loadResult = options.loadResult ?? { data: { coach_state: null }, error: null };
  const saveResult = options.saveResult ?? { error: null };

  const conversationsTable = {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => loadResult
      })
    }),
    update: () => ({
      eq: async () => saveResult
    })
  };

  return {
    from: (table: string) => {
      if (table === "conversations") return conversationsTable as never;
      throw new Error(`fakeSupabase: unexpected table "${table}"`);
    }
  } as unknown as SupabaseClient;
}

async function drain<T>(generator: AsyncGenerator<unknown, T>): Promise<T> {
  let result = await generator.next();
  while (!result.done) {
    result = await generator.next();
  }
  return result.value;
}

type DoneEvent = { type: "done"; answer: { text: string; citations: Array<{ marker: number; chunkId: string }>; grounded: boolean } };

/**
 * Drains a Coach turn while capturing the final `done` stream event, so a
 * test can assert on the surfaced answer (text, citations, grounded flag)
 * without re-running the generator.
 */
async function drainCollectingDone<T>(generator: AsyncGenerator<unknown, T>): Promise<DoneEvent> {
  let doneEvent: DoneEvent | undefined;
  let result = await generator.next();
  while (!result.done) {
    const event = result.value as { type?: string };
    if (event?.type === "done") doneEvent = event as DoneEvent;
    result = await generator.next();
  }
  if (!doneEvent) throw new Error("Coach turn ended without emitting a done event");
  return doneEvent;
}

const topics: Topic[] = [];

test("a Coach-state load failure surfaces as a thrown error instead of silently resetting to idle", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: null, error: { message: "connection reset" } }
  });

  await assert.rejects(
    () =>
      drain(
        runCoachTurn({
          supabase,
          roomId: "room-1",
          conversationId: "conv-1",
          question: "next",
          topics
        })
      ),
    /Could not load Coach state for conversation conv-1/
  );
});

test("a Coach-state save failure surfaces as a thrown error instead of silently dropping the transition", async () => {
  // "awaiting_control" + a decline ("no") takes the shortest path to a save:
  // it goes straight to `saveCoachState(IDLE_COACH_STATE)` with no retrieval
  // or model call in between, so this isolates the save failure cleanly.
  const supabase = fakeSupabase({
    loadResult: {
      data: {
        coach_state: {
          version: 1,
          kind: "awaiting_control",
          action: "more_practice",
          topicId: null,
          sourceChunkIds: []
        }
      },
      error: null
    },
    saveResult: { error: { message: "write conflict" } }
  });

  await assert.rejects(
    () =>
      drain(
        runCoachTurn({
          supabase,
          roomId: "room-1",
          conversationId: "conv-1",
          question: "no",
          topics
        })
      ),
    /Could not save Coach state for conversation conv-1/
  );
});

test("a healthy load/save round trip still completes normally (control-flow sanity check)", async () => {
  const supabase = fakeSupabase({
    loadResult: {
      data: {
        coach_state: {
          version: 1,
          kind: "awaiting_control",
          action: "more_practice",
          topicId: null,
          sourceChunkIds: []
        }
      },
      error: null
    },
    saveResult: { error: null }
  });

  const log = await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "no",
      topics
    })
  );

  assert.equal(log.outcome, "control");
  assert.equal(log.stateAfter, "idle");
});

const awaitingAnswerState = {
  version: 1,
  kind: "awaiting_answer",
  question: "What causes tides?",
  topicId: "topic-1",
  expectedConcepts: [{ id: "gravity", description: "the moon's gravitational pull", weight: 1 }],
  sourceChunkIds: ["chunk-1"],
  askedAt: new Date().toISOString()
};

const fakeChunk: RetrievedChunk = {
  id: "chunk-1",
  documentId: "source-1",
  documentName: "Tides Reading",
  content: "The moon's gravity pulls on Earth's oceans, causing tides.",
  similarity: 0.9
};

test("the model's evaluation.intent can never promote a deterministic 'answer' into a conversation_control transition", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  // A plain content reply — detectTurnIntent reads this as "answer" — but the
  // fake model evaluator (simulating a prompt-injection or a model mistake)
  // claims it's a discourse move. If the guard in coach-router didn't exist,
  // this would incorrectly short-circuit into outcome "control" and skip
  // grading entirely.
  const rogueEvaluation: CoachEvaluation = {
    intent: "conversation_control",
    concepts: [{ id: "gravity", status: "demonstrated" }]
  };

  const log = await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "The moon's gravity pulls the oceans.",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => rogueEvaluation,
        generateCoachFeedback: async () => "Nice — that's exactly it."
      }
    })
  );

  // The guard forces effectiveIntent back to the deterministic "answer", so
  // grading proceeds normally and the concept evidence still counts.
  assert.equal(log.turnIntent, "answer");
  assert.equal(log.outcome, "correct");
  assert.notEqual(log.outcome, "control");
});

test("the model's evaluation.intent can still refine a deterministic 'answer' into 'irrelevant' (a demotion, not a promotion into control)", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  const log = await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "pizza",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "irrelevant", concepts: [] }),
        generateCoachFeedback: async () => "That doesn't address the question — want a hint?"
      }
    })
  );

  assert.equal(log.turnIntent, "irrelevant");
  assert.equal(log.outcome, "irrelevant");
});

test("answering a pending question never re-retrieves using the raw learner reply — it re-fetches the question's own source chunks by id", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  let retrieveForRoomCalls = 0;
  let fetchChunksByIdsCalls = 0;

  await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "The moon's gravity pulls the oceans.",
      topics,
      deps: {
        retrieveForRoom: async () => {
          retrieveForRoomCalls += 1;
          return [fakeChunk];
        },
        fetchChunksByIds: async () => {
          fetchChunksByIdsCalls += 1;
          return [fakeChunk];
        },
        evaluateCoachAnswer: async () => ({ intent: "answer", concepts: [{ id: "gravity", status: "demonstrated" }] }),
        generateCoachFeedback: async () => "Correct."
      }
    })
  );

  assert.equal(retrieveForRoomCalls, 0);
  assert.equal(fetchChunksByIdsCalls, 1);
});

test("pedagogy directives are formatted and threaded into generateCoachFeedback, but never influence the deterministic outcome", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  let receivedDirectives: string[] | undefined;

  const log = await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "The moon's gravity pulls the oceans.",
      topics,
      directives: [{ name: "socratic", instruction: "Favor guiding questions over direct statements." }],
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "answer", concepts: [{ id: "gravity", status: "demonstrated" }] }),
        generateCoachFeedback: async (args) => {
          receivedDirectives = args.pedagogyDirectives;
          return "Nice — that's exactly it.";
        }
      }
    })
  );

  assert.deepEqual(receivedDirectives, ["[SOCRATIC] Favor guiding questions over direct statements."]);
  // Grading is unaffected by the directive — same outcome as the equivalent
  // test above with no directives.
  assert.equal(log.outcome, "correct");
});

test("pedagogy directives are threaded into generateCoachQuestion when opening a fresh question", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: { version: 1, kind: "idle" } }, error: null }
  });

  let receivedDirectives: string[] | undefined;

  await drain(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "Let's talk about tides",
      topics: [{ id: "topic-1", title: "Tides", objective: null, key_terms: [], priority: 1, order_index: 0, active: true } as unknown as Topic],
      directives: [{ name: "feynman", instruction: "Explain like teaching a curious beginner." }],
      deps: {
        retrieveForRoom: async () => [fakeChunk],
        generateCoachQuestion: async (args) => {
          receivedDirectives = args.pedagogyDirectives;
          return { question: "Why do tides happen?", expectedConcepts: [], sourceChunkIds: ["chunk-1"], sourceMarkers: [1] };
        }
      }
    })
  );

  assert.deepEqual(receivedDirectives, ["[FEYNMAN] Explain like teaching a curious beginner."]);
});

// ---------------------------------------------------------------------------
// Citation-marker regression: a [n] in Coach prose must resolve to real
// source chunk n (in the order chunks were presented), and `grounded` must
// track whether a source was actually cited — never true with zero citations,
// never false when the prose cited a valid marker.
// ---------------------------------------------------------------------------

const twoChunks: RetrievedChunk[] = [
  { id: "chunk-A", documentId: "doc-A", documentName: "Genetics Guide", content: "Traits pass from parents to offspring.", similarity: 0.9 },
  { id: "chunk-B", documentId: "doc-B", documentName: "Biology Textbook", content: "Alleles vary across a population.", similarity: 0.8 }
];

const genderNeutralTopic: Topic = {
  id: "topic-1",
  title: "Heredity",
  objective: null,
  key_terms: [],
  priority: 1,
  order_index: 0,
  active: true
} as unknown as Topic;

test("a [n] marker in a freshly opened Coach question resolves to source chunk n and reports grounded", async () => {
  const done = await drainCollectingDone(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: { version: 1, kind: "idle" } }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "coach me on heredity",
      topics: [genderNeutralTopic],
      deps: {
        retrieveForRoom: async () => twoChunks,
        generateCoachQuestion: async () => ({
          question: "How do traits pass to offspring [1], and why do they vary [2]?",
          expectedConcepts: [],
          sourceChunkIds: ["chunk-A", "chunk-B"],
          sourceMarkers: [1, 2]
        })
      }
    })
  );

  assert.equal(done.answer.grounded, true);
  assert.deepEqual(done.answer.citations.map((c) => c.marker), [1, 2]);
  // marker 1 -> chunk-A, marker 2 -> chunk-B, in presented order.
  assert.equal(done.answer.citations[0].chunkId, "chunk-A");
  assert.equal(done.answer.citations[1].chunkId, "chunk-B");
});

test("a Coach question with no [n] markers is reported grounded:false with no citations", async () => {
  const done = await drainCollectingDone(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: { version: 1, kind: "idle" } }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "coach me on heredity",
      topics: [genderNeutralTopic],
      deps: {
        retrieveForRoom: async () => twoChunks,
        generateCoachQuestion: async () => ({
          question: "In your own words, how does heredity work?",
          expectedConcepts: [],
          sourceChunkIds: ["chunk-A"],
          sourceMarkers: []
        })
      }
    })
  );

  assert.equal(done.answer.grounded, false);
  assert.deepEqual(done.answer.citations, []);
});

test("a [n] marker in grading feedback resolves to the pending question's own source chunk n and reports grounded", async () => {
  const done = await drainCollectingDone(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: awaitingAnswerState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "The moon's gravity pulls the oceans.",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "answer", concepts: [{ id: "gravity", status: "demonstrated" }] }),
        generateCoachFeedback: async () => "Exactly — the moon's gravity drives the tides [1]."
      }
    })
  );

  assert.equal(done.answer.grounded, true);
  assert.deepEqual(done.answer.citations.map((c) => c.marker), [1]);
  assert.equal(done.answer.citations[0].chunkId, "chunk-1");
});

test("uncited grading feedback is grounded:false even when the answer is correct", async () => {
  const done = await drainCollectingDone(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: awaitingAnswerState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "The moon's gravity pulls the oceans.",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "answer", concepts: [{ id: "gravity", status: "demonstrated" }] }),
        generateCoachFeedback: async () => "Nice — that's exactly it."
      }
    })
  );

  assert.equal(done.answer.grounded, false);
  assert.deepEqual(done.answer.citations, []);
});

// ---------------------------------------------------------------------------
// Clarification intent (C): a genuine learner question mid-answer is answered
// from the material and the pending question is restored — never graded.
// ---------------------------------------------------------------------------

test("a clarification question mid-answer is answered from the material, is never graded, and preserves+returns to the pending question", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  let retrieveForRoomCalls = 0;
  let clarificationQuery: string | undefined;
  let evaluateCalled = false;
  let feedbackCalled = false;

  const done = await drainCollectingDone(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "Wait, what does gravitational pull actually mean?",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => {
          evaluateCalled = true;
          return { intent: "clarification", concepts: [] };
        },
        retrieveForRoom: async (args) => {
          retrieveForRoomCalls += 1;
          clarificationQuery = (args as { query: string }).query;
          return [fakeChunk];
        },
        answerFromRetrievedContext: async () => ({
          text: "Gravitational pull is the force the moon exerts on Earth's water [1].",
          citations: [{ marker: 1, chunkId: "chunk-1", documentId: "source-1", documentName: "Tides Reading", pageNumber: null, pageLabel: "page" } as never],
          grounded: true
        }),
        generateCoachFeedback: async () => {
          feedbackCalled = true;
          return "should not be called";
        }
      }
    })
  );

  // Answered with a fresh grounded retrieval keyed on the clarification text.
  assert.equal(retrieveForRoomCalls, 1);
  assert.equal(clarificationQuery, "Wait, what does gravitational pull actually mean?");
  // Never graded: the clarification branch runs before scoring/feedback.
  assert.equal(feedbackCalled, false);
  // The grounded answer is surfaced and the pending question is handed back.
  assert.match(done.answer.text, /Gravitational pull is the force/);
  assert.match(done.answer.text, /Now, back to the question: What causes tides\?/);
  assert.equal(done.answer.grounded, true);
  // evaluateCoachAnswer must run first (it is what classifies clarification).
  assert.equal(evaluateCalled, true);
});

test("a clarification turn stays in awaiting_answer (the pending question is never dropped)", async () => {
  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: awaitingAnswerState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "What does gravitational pull mean?",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "clarification", concepts: [] }),
        retrieveForRoom: async () => [fakeChunk],
        answerFromRetrievedContext: async () => ({ text: "It is the moon's force [1].", citations: [{ marker: 1 } as never], grounded: true }),
        generateCoachFeedback: async () => "should not be called"
      }
    })
  );

  assert.equal(log.turnIntent, "clarification");
  assert.equal(log.outcome, "clarification");
  assert.equal(log.stateBefore, "awaiting_answer");
  assert.equal(log.stateAfter, "awaiting_answer");
  assert.equal(log.semanticScore, null);
});

// ---------------------------------------------------------------------------
// Production regression sequence (D): the exact learner turns from the review
// that used to misbehave, each pinned to its correct outcome and next state.
// ---------------------------------------------------------------------------

const variationQuestionState = {
  version: 1,
  kind: "awaiting_answer",
  question: "What are some ways offspring can vary from their parents, and why does that variation happen?",
  topicId: "topic-1",
  expectedConcepts: [
    { id: "examples", description: "concrete examples of variation such as height, color, or patterns", weight: 0.5 },
    { id: "mechanism", description: "why variation happens (genetic recombination / mutation)", weight: 0.5 }
  ],
  sourceChunkIds: ["chunk-1"],
  askedAt: new Date().toISOString()
};

test("regression: a partially-correct answer ('height, color, or patterns') is graded partial, keeps the pending question, and never re-retrieves the raw reply", async () => {
  let retrieveForRoomCalls = 0;

  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: variationQuestionState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "Things like their height, color, or patterns",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        retrieveForRoom: async () => {
          retrieveForRoomCalls += 1;
          return [fakeChunk];
        },
        evaluateCoachAnswer: async () => ({
          intent: "answer",
          concepts: [
            { id: "examples", status: "demonstrated" },
            { id: "mechanism", status: "absent" }
          ]
        }),
        generateCoachFeedback: async () => "Good — those are real examples. Now, why does that variation actually happen?"
      }
    })
  );

  assert.equal(log.outcome, "partial");
  assert.equal(log.stateAfter, "awaiting_answer");
  assert.equal(retrieveForRoomCalls, 0);
});

test("regression: an off-topic answer ('pizza') is graded irrelevant and keeps the pending question", async () => {
  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: variationQuestionState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "pizza",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({ intent: "irrelevant", concepts: [] }),
        generateCoachFeedback: async () => "That doesn't address the question — want a hint?"
      }
    })
  );

  assert.equal(log.outcome, "irrelevant");
  assert.equal(log.stateAfter, "awaiting_answer");
});

test("regression: a complete natural paraphrase is graded correct and advances to awaiting_control", async () => {
  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: variationQuestionState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "Kids can look different in height or color, and it happens because they get a mix of genes from both parents plus the odd mutation.",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => ({
          intent: "answer",
          concepts: [
            { id: "examples", status: "demonstrated" },
            { id: "mechanism", status: "demonstrated" }
          ]
        }),
        generateCoachFeedback: async () => "That's exactly right."
      }
    })
  );

  assert.equal(log.outcome, "correct");
  assert.equal(log.stateAfter, "awaiting_control");
});

test("regression: 'I don't know' is a help request, not a wrong answer, and keeps the pending question", async () => {
  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: variationQuestionState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "I don't know, can you give me a hint?",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        // detectTurnIntent classifies this as help_request deterministically;
        // the evaluator result is ignored for intent in that case.
        evaluateCoachAnswer: async () => ({ intent: "answer", concepts: [] }),
        renderCoachSupport: async () => "Think about what parents pass down."
      }
    })
  );

  assert.equal(log.turnIntent, "help_request");
  assert.equal(log.outcome, "help");
  assert.equal(log.stateAfter, "awaiting_answer");
});

test("regression: 'next' while a question is pending exits to idle without grading", async () => {
  let evaluateCalled = false;

  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: variationQuestionState }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "next",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => {
          evaluateCalled = true;
          return { intent: "answer", concepts: [] };
        }
      }
    })
  );

  assert.equal(log.turnIntent, "conversation_control");
  assert.equal(log.outcome, "control");
  assert.equal(log.stateAfter, "idle");
  assert.equal(evaluateCalled, false);
});

// ---------------------------------------------------------------------------
// Acceptance gate (E): the two turns from the original gate that must not
// regress.
//
//   1. awaiting_control + "yes" -> execute the stored control action, open a
//      new grounded question, transition to awaiting_answer, and NEVER call
//      retrieval with "yes" as the query.
//   2. awaiting_answer + "show me the answer" -> classify show_answer, keep
//      the pending question, and return a complete source-grounded model
//      answer (NOT the hint-only help_request path).
// ---------------------------------------------------------------------------

const awaitingControlState = {
  version: 1,
  kind: "awaiting_control",
  action: "more_practice",
  topicId: "topic-1",
  sourceChunkIds: ["chunk-A"]
};

/** Drains a Coach turn while capturing BOTH the final `done` event and the
 *  generator's return value, for turns where a test must assert on the
 *  surfaced answer and on the telemetry log together. */
async function drainCollectingBoth<T>(
  generator: AsyncGenerator<unknown, T>
): Promise<{ done: DoneEvent; log: T }> {
  let doneEvent: DoneEvent | undefined;
  let result = await generator.next();
  while (!result.done) {
    const event = result.value as { type?: string };
    if (event?.type === "done") doneEvent = event as DoneEvent;
    result = await generator.next();
  }
  if (!doneEvent) throw new Error("Coach turn ended without emitting a done event");
  return { done: doneEvent, log: result.value };
}

test("acceptance: awaiting_control + 'yes' executes the stored more_practice action, opens a new grounded question in awaiting_answer, and never retrieves with 'yes'", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingControlState }, error: null }
  });

  const retrievedQueries: string[] = [];
  let generateCoachQuestionCalls = 0;

  const { done, log } = await drainCollectingBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "yes",
      // The stored action is pinned to topic-1; supply it so the replayed
      // action resolves to a real topic to build the retrieval query from.
      topics: [genderNeutralTopic],
      deps: {
        retrieveForRoom: async (args) => {
          retrievedQueries.push((args as { query: string }).query);
          return twoChunks;
        },
        generateCoachQuestion: async () => {
          generateCoachQuestionCalls += 1;
          return {
            question: "How do traits pass to offspring [1]?",
            expectedConcepts: [],
            sourceChunkIds: ["chunk-A"],
            sourceMarkers: [1]
          };
        }
      }
    })
  );

  // Routed as a control move that replayed the pending action into a new
  // question, landing back in awaiting_answer.
  assert.equal(log.turnIntent, "conversation_control");
  assert.equal(log.stateBefore, "awaiting_control");
  assert.equal(log.outcome, "new_question");
  assert.equal(log.stateAfter, "awaiting_answer");

  // A fresh grounded question was actually generated.
  assert.equal(generateCoachQuestionCalls, 1);
  assert.equal(done.answer.grounded, true);
  assert.deepEqual(done.answer.citations.map((c) => c.marker), [1]);
  assert.equal(done.answer.citations[0].chunkId, "chunk-A");

  // Retrieval ran exactly once and was keyed on the topic, never on the raw
  // "yes" discourse move.
  assert.equal(retrievedQueries.length, 1);
  assert.equal(retrievedQueries[0], "Heredity");
  assert.ok(!retrievedQueries.some((query) => /\byes\b/i.test(query)));
});

test("acceptance: awaiting_answer + 'show me the answer' returns a complete source-grounded model answer for the pending question — distinct from the hint-only help_request path", async () => {
  const supabase = fakeSupabase({
    loadResult: { data: { coach_state: awaitingAnswerState }, error: null }
  });

  let evaluateCalled = false;
  let feedbackCalled = false;
  let retrieveForRoomCalls = 0;
  let answeredQuestion: string | undefined;

  const { done, log } = await drainCollectingBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "conv-1",
      question: "show me the answer",
      topics,
      deps: {
        fetchChunksByIds: async () => [fakeChunk],
        // The hint path's model calls must NOT run for an explicit
        // show-the-answer request.
        evaluateCoachAnswer: async () => {
          evaluateCalled = true;
          return { intent: "answer", concepts: [] };
        },
        generateCoachFeedback: async () => {
          feedbackCalled = true;
          return "should not be called";
        },
        // The full answer must come from the pending question's own source
        // chunks, never a fresh retrieval keyed on "show me the answer".
        retrieveForRoom: async () => {
          retrieveForRoomCalls += 1;
          return [fakeChunk];
        },
        answerFromRetrievedContext: async (args) => {
          answeredQuestion = (args as { question: string }).question;
          return {
            text: "Tides are caused by the moon's gravitational pull on Earth's oceans [1].",
            citations: [
              { marker: 1, chunkId: "chunk-1", documentId: "source-1", documentName: "Tides Reading", pageNumber: null, pageLabel: "page" } as never
            ],
            grounded: true
          };
        }
      }
    })
  );

  // Deterministically classified as show_answer; the pending question is
  // preserved (still awaiting_answer).
  assert.equal(log.turnIntent, "show_answer");
  assert.equal(log.outcome, "show_answer");
  assert.equal(log.stateBefore, "awaiting_answer");
  assert.equal(log.stateAfter, "awaiting_answer");

  // A complete, source-grounded answer to the *pending* question with valid
  // citations resolving to the question's own source chunk.
  assert.equal(answeredQuestion, "What causes tides?");
  assert.match(done.answer.text, /moon's gravitational pull/);
  assert.equal(done.answer.grounded, true);
  assert.deepEqual(done.answer.citations.map((c) => c.marker), [1]);
  assert.equal(done.answer.citations[0].chunkId, "chunk-1");

  // Distinct from the hint-only help_request path: no semantic evaluation, no
  // scaffolded generateCoachFeedback nudge, and no retrieval on the raw reply.
  assert.equal(evaluateCalled, false);
  assert.equal(feedbackCalled, false);
  assert.equal(retrieveForRoomCalls, 0);
});

test("regression: partial source loss halts grading entirely (never grade against incomplete evidence)", async () => {
  let evaluateCalled = false;

  const log = await drain(
    runCoachTurn({
      supabase: fakeSupabase({ loadResult: { data: { coach_state: { ...variationQuestionState, sourceChunkIds: ["chunk-1", "chunk-2"] } }, error: null } }),
      roomId: "room-1",
      conversationId: "conv-1",
      question: "Things like height and color",
      topics,
      deps: {
        // Only one of the two original chunks still resolves.
        fetchChunksByIds: async () => [fakeChunk],
        evaluateCoachAnswer: async () => {
          evaluateCalled = true;
          return { intent: "answer", concepts: [] };
        }
      }
    })
  );

  assert.equal(evaluateCalled, false);
  assert.equal(log.outcome, "control");
  assert.equal(log.stateAfter, "idle");
});
