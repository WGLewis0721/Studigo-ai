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
