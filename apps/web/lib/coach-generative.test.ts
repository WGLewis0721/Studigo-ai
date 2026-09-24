import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LANGUAGE_FLOOR_RULES,
  SHOW_ANSWER_INSTRUCTIONS,
  assessLanguageFloor,
  buildCoachFeedbackSystem,
  buildCoachQuestionSystem,
  decideOutcome,
  detectTurnIntent,
  questionMeetsLanguageFloor,
  scoreConcepts,
  type CoachChallenge,
  type CoachState,
  type ExpectedConcept,
  type LearningRoute,
  type RetrievedChunk
} from "@studigo/ai";
import { runCoachTurn } from "./coach-router";
import { temporaryCoachDirector, type CoachDirector } from "./coach-challenge-adapter";
import { selectLearningRoute } from "./coach-route-selection";
import type { Topic } from "./rooms";

// Invariant tests for the generative Coach layer. Nothing here asserts exact
// model prose: prompts are checked for the rules they carry, and sample
// questions are checked with the deterministic language-floor lint.

function recordingSupabase(initial: CoachState | null) {
  const saved: CoachState[] = [];
  let current: unknown = initial;
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { coach_state: current }, error: null }) }) }),
      update: (row: { coach_state: CoachState }) => ({
        eq: async () => {
          saved.push(row.coach_state);
          current = row.coach_state;
          return { error: null };
        }
      })
    })
  } as unknown as SupabaseClient;
  return { supabase, saved };
}

async function drainBoth(generator: AsyncGenerator<unknown, unknown>) {
  let done: { answer: { text: string; citations: unknown[]; grounded: boolean } } | undefined;
  let result = await generator.next();
  while (!result.done) {
    const event = result.value as { type?: string };
    if (event.type === "done") done = event as typeof done;
    result = await generator.next();
  }
  return { log: result.value as Record<string, unknown>, done: done! };
}

const magnetTopic: Topic = {
  id: "topic-magnets",
  room_id: "room-1",
  title: "Magnetism",
  objective: "Explain how magnets attract and repel.",
  key_terms: ["pole"],
  priority: 1,
  order_index: 0,
  origin: "study_guide",
  mastery_score: 0,
  status: "learning",
  last_practiced_at: null,
  learner_edited: false
};

const magnetChunk: RetrievedChunk = {
  id: "chunk-m",
  documentId: "doc-1",
  documentName: "Magnets notes",
  content: "Opposite poles attract. Like poles push each other away.",
  similarity: 0.9
};

const concepts: ExpectedConcept[] = [
  { id: "opposites_attract", description: "Opposite poles pull together", weight: 0.5, critical: true },
  { id: "likes_repel", description: "Like poles push apart", weight: 0.5, critical: false }
];

function pending(challenge?: CoachChallenge): CoachState {
  return {
    version: 1,
    kind: "awaiting_answer",
    question: "What happens when two north poles meet?",
    topicId: magnetTopic.id,
    expectedConcepts: concepts,
    sourceChunkIds: [magnetChunk.id],
    askedAt: "2026-01-01T00:00:00.000Z",
    ...(challenge ? { challenge } : {})
  };
}

const initialSpec = temporaryCoachDirector.initial(magnetTopic, "studigo_default");

// --- 1-4: language floor, reasoning ceiling --------------------------------

test("1. the intro question is rendered for one concept in simple language", async () => {
  let seen: CoachChallenge | undefined;
  const { supabase } = recordingSupabase(null);
  const { log } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "Coach me on magnetism",
      topics: [magnetTopic],
      deps: {
        retrieveForRoom: async () => [magnetChunk],
        generateCoachQuestion: async (args) => {
          seen = args.challenge;
          return { question: "What happens when two magnets touch?", expectedConcepts: concepts, sourceChunkIds: [magnetChunk.id], sourceMarkers: [] };
        }
      }
    })
  );
  assert.equal(seen?.constraints.oneConceptAtATime, true);
  assert.equal(seen?.scaffoldLevel, 0);
  const system = buildCoachQuestionSystem({ challenge: seen });
  for (const rule of LANGUAGE_FLOOR_RULES) assert.ok(system.includes(rule));
  assert.ok(system.includes("single concept"));
  assert.ok(system.includes("1-3 underlying concepts"));
  const floor = log.languageFloor as ReturnType<typeof assessLanguageFloor>;
  assert.equal(floor.mainQuestionCount, 1);
});

test("2. melting can be asked in short form and passes the language floor", () => {
  assert.ok(questionMeetsLanguageFloor("What happens when ice melts?"));
  // The compound, academic register the old prompt produced fails the lint.
  assert.equal(
    questionMeetsLanguageFloor(
      "Explain the thermodynamic process by which a solid undergoes a phase transition to a liquid, including the role of energy absorption, intermolecular forces, and temperature, and give an example."
    ),
    false
  );
  assert.equal(questionMeetsLanguageFloor("What is melting? What is freezing?"), false);
});

test("3. the candle-wax transfer question uses simple language", () => {
  const transfer = "Candle wax turns liquid when it gets hot. Is that like melting ice? Why?";
  assert.ok(questionMeetsLanguageFloor(transfer));
  const system = buildCoachQuestionSystem({ challenge: { ...initialSpec, challengeKind: "transfer" } });
  assert.ok(system.includes("Reasoning task: transfer"));
  assert.ok(system.includes("never by making the English harder"));
});

test("4. magnetism can progress to a reasoning problem without vocabulary inflation", () => {
  const recall = "What happens when two north poles meet?";
  const novel = "A toy car has a magnet on its back. You push a magnet toward it, north side first. The car rolls away. Which side of the car's magnet faces you? Why?";
  const avgWordLength = (text: string) => {
    const words = text.match(/[a-z']+/gi) ?? [];
    return words.reduce((sum, word) => sum + word.length, 0) / words.length;
  };
  for (const q of [recall, novel]) assert.ok(questionMeetsLanguageFloor(q), q);
  assert.ok(avgWordLength(novel) <= avgWordLength(recall) + 0.5);
  assert.ok(assessLanguageFloor(novel).longestSentenceWords <= 20);
  // The harder rung changes the task instruction, while the language rules are identical.
  const easy = buildCoachQuestionSystem({ challenge: { ...initialSpec, challengeKind: "recall" } });
  const hard = buildCoachQuestionSystem({ challenge: { ...initialSpec, challengeKind: "novel_problem" } });
  assert.notEqual(easy, hard);
  for (const rule of LANGUAGE_FLOOR_RULES) assert.ok(easy.includes(rule) && hard.includes(rule));
});

// --- 5-6: help paths -------------------------------------------------------

test("5. 'I don't know' gets a concise hint without being evaluated", async () => {
  let evaluated = false;
  let outcome: string | undefined;
  const { supabase, saved } = recordingSupabase(pending(initialSpec));
  const { log } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "I don't know",
      topics: [magnetTopic],
      deps: {
        fetchChunksByIds: async () => [magnetChunk],
        evaluateCoachAnswer: async () => {
          evaluated = true;
          return { intent: "answer", concepts: [] };
        },
        generateCoachFeedback: async (args) => {
          outcome = args.outcome;
          return "Think about which sides are the same. Try again?";
        }
      }
    })
  );
  assert.equal(evaluated, false);
  assert.equal(outcome, "help");
  assert.equal(log.stateAfter, "awaiting_answer");
  // The pending question row is left untouched.
  assert.equal(saved.length, 0);
  const system = buildCoachFeedbackSystem({ outcome: "help" });
  assert.ok(system.includes("exactly one short clue"));
  assert.ok(system.includes("Do not give the answer"));
});

test("6. 'show me the answer' gives a concise grounded answer with citations", async () => {
  let instructions: string | undefined;
  const { supabase } = recordingSupabase(pending(initialSpec));
  const { done, log } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "show me the answer",
      topics: [magnetTopic],
      deps: {
        fetchChunksByIds: async () => [magnetChunk],
        answerFromRetrievedContext: async (args) => {
          instructions = args.instructions;
          return { text: "Like poles push apart [1].", citations: [{ marker: 1, chunkId: "chunk-m" } as never], grounded: true };
        }
      }
    })
  );
  assert.ok(instructions?.includes(SHOW_ANSWER_INSTRUCTIONS));
  assert.equal(done.answer.grounded, true);
  assert.equal(done.answer.citations.length, 1);
  assert.equal(log.stateAfter, "awaiting_answer");
});

// --- 7-9: grading is deterministic and unchanged ---------------------------

function grade(statuses: Record<string, "demonstrated" | "partial" | "absent" | "contradicted">, intent: "answer" | "irrelevant" = "answer") {
  const evaluated = Object.entries(statuses).map(([id, status]) => ({ id, status }));
  const score = scoreConcepts(concepts, evaluated);
  return decideOutcome({ intent, expectedConcepts: concepts, evaluated, score });
}

test("7. a correct paraphrase grades correct", () => {
  assert.equal(grade({ opposites_attract: "demonstrated", likes_repel: "demonstrated" }), "correct");
});

test("8. a partial answer grades partial", () => {
  assert.equal(grade({ opposites_attract: "demonstrated", likes_repel: "absent" }), "partial");
});

test("9. an irrelevant answer grades irrelevant", () => {
  assert.equal(grade({}, "irrelevant"), "irrelevant");
});

// --- 10-13: state preservation, routes, controls ---------------------------

test("10. a clarification preserves the pending question", async () => {
  const { supabase, saved } = recordingSupabase(pending(initialSpec));
  const { done } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "What is a pole?",
      topics: [magnetTopic],
      deps: {
        fetchChunksByIds: async () => [magnetChunk],
        retrieveForRoom: async () => [magnetChunk],
        evaluateCoachAnswer: async () => ({ intent: "clarification", concepts: [] }),
        answerFromRetrievedContext: async () => ({ text: "A pole is an end of a magnet [1].", citations: [], grounded: true })
      }
    })
  );
  assert.deepEqual(saved.at(-1), pending(initialSpec));
  assert.ok(done.answer.text.includes("What happens when two north poles meet?"));
});

test("11. a route change alters teaching but not correctness", async () => {
  const outcomes: string[] = [];
  const systems = new Set<string>();
  for (const route of ["studigo_default", "socratic", "japanese_inspired"] as LearningRoute[]) {
    const { supabase } = recordingSupabase(pending({ ...initialSpec, route }));
    const { log } = await drainBoth(
      runCoachTurn({
        supabase,
        roomId: "room-1",
        conversationId: "c",
        question: "The two north ends push away from each other",
        topics: [magnetTopic],
        route,
        deps: {
          fetchChunksByIds: async () => [magnetChunk],
          evaluateCoachAnswer: async () => ({
            intent: "answer",
            concepts: [
              { id: "opposites_attract", status: "demonstrated" },
              { id: "likes_repel", status: "partial" }
            ]
          }),
          generateCoachFeedback: async (args) => {
            systems.add(buildCoachFeedbackSystem({ outcome: args.outcome, challenge: args.challenge }));
            return "Good start.";
          }
        }
      })
    );
    outcomes.push(`${log.outcome}:${log.semanticScore}`);
  }
  assert.equal(new Set(outcomes).size, 1);
  assert.equal(systems.size, 3);
  assert.equal(selectLearningRoute("socratic", "tradition-default"), "socratic");
  assert.equal(selectLearningRoute("socratic", "tradition-japanese"), "japanese_inspired");
});

test("12. 'make it simpler' keeps the expected concept, sources, and reasoning task", async () => {
  let evaluated = false;
  let seenChallenge: CoachChallenge | undefined;
  const spec: CoachChallenge = { ...initialSpec, challengeKind: "predict" };
  const { supabase, saved } = recordingSupabase(pending(spec));
  assert.equal(detectTurnIntent("Make it simpler", pending(spec)), "simplify");
  const { log } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "Make it simpler",
      topics: [magnetTopic],
      deps: {
        fetchChunksByIds: async () => [magnetChunk],
        evaluateCoachAnswer: async () => {
          evaluated = true;
          return { intent: "answer", concepts: [] };
        },
        generateCoachQuestion: async (args) => {
          seenChallenge = args.challenge;
          return { question: "Two north ends meet. What do they do?", expectedConcepts: [], sourceChunkIds: ["other"], sourceMarkers: [] };
        }
      }
    })
  );
  const after = saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>;
  assert.equal(evaluated, false);
  assert.equal(log.outcome, "simplified");
  assert.deepEqual(after.expectedConcepts, concepts);
  assert.deepEqual(after.sourceChunkIds, [magnetChunk.id]);
  assert.equal(seenChallenge?.challengeKind, "predict");
  assert.equal(after.question, "Two north ends meet. What do they do?");
});

test("13. 'Challenge me' goes through the control plane, and practice never auto-advances", async () => {
  const requests: string[] = [];
  const director: CoachDirector = {
    initial: temporaryCoachDirector.initial,
    request: (current, request) => {
      requests.push(`${current.challengeKind}->${request}`);
      return { ...current, challengeKind: "defend" };
    }
  };
  const rendered: Array<CoachChallenge | undefined> = [];
  const deps = {
    director,
    retrieveForRoom: async () => [magnetChunk],
    fetchChunksByIds: async () => [magnetChunk],
    generateCoachQuestion: async (args: { challenge?: CoachChallenge }) => {
      rendered.push(args.challenge);
      return { question: "Is it true that any two magnets pull together? Why?", expectedConcepts: concepts, sourceChunkIds: [magnetChunk.id], sourceMarkers: [] };
    },
    evaluateCoachAnswer: async () => ({
      intent: "answer" as const,
      concepts: [
        { id: "opposites_attract", status: "demonstrated" as const },
        { id: "likes_repel", status: "demonstrated" as const }
      ]
    }),
    generateCoachFeedback: async () => "Yes."
  };
  const { supabase, saved } = recordingSupabase(pending(initialSpec));
  const run = (question: string) =>
    drainBoth(runCoachTurn({ supabase, roomId: "room-1", conversationId: "c", question, topics: [magnetTopic], deps }));

  await run("Challenge me");
  assert.deepEqual(requests, ["explain->harder"]);
  assert.equal(rendered.at(-1)?.challengeKind, "defend");

  // Answer correctly, then "yes" to another one: same spec, no hidden ladder.
  await run("No, only opposite ends pull; same ends push apart");
  assert.equal(saved.at(-1)?.kind, "awaiting_control");
  await run("yes");
  assert.equal(rendered.at(-1)?.challengeKind, "defend");
  assert.equal(requests.length, 1);

  // The temporary adapter steps exactly one rung and resets support.
  const harder = temporaryCoachDirector.request({ ...initialSpec, scaffoldLevel: 3 }, "harder");
  assert.equal(harder.challengeKind, "compare");
  assert.equal(harder.scaffoldLevel, 0);
});
