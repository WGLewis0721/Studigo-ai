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
  type CoachState,
  type ExpectedConcept,
  type RetrievedChunk
} from "@studigo/ai";
import { runCoachTurn } from "./coach-router";
import type { CoachDirector } from "./coach-director";
import { renderChallengeGuidance, renderRouteGuidance } from "./coach-render";
import {
  REASONING_LADDER,
  initialLearningState,
  nextChallenge,
  type ChallengeKind,
  type ChallengeSpec,
  type LearningRoute,
  type ReasoningLevel,
  type ScaffoldLevel
} from "./learning";
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

const conceptKey = { userId: "user-1", roomId: "room-1", topicId: magnetTopic.id };

/** Specs come from Astra's own director, never hand-built: the Coach tests
 *  render whatever the control plane decides. */
function specFor(kind: ChallengeKind = "explain", route: LearningRoute = "studigo_default", scaffoldLevel: ScaffoldLevel = 0): ChallengeSpec {
  const learnerState = {
    ...initialLearningState(conceptKey),
    reasoningLevel: REASONING_LADDER.indexOf(kind) as ReasoningLevel,
    scaffoldLevel
  };
  return nextChallenge({
    concept: { ...conceptKey, objective: magnetTopic.objective! },
    learnerState,
    recentEvents: [],
    activity: "coach",
    route,
    now: "2026-09-24T00:00:00.000Z"
  });
}

function fixedDirector(spec: ChallengeSpec, calls: string[] = []): CoachDirector {
  return {
    async challengeFor(args) {
      calls.push(`${args.userId}:${args.topic.id}:${args.route}`);
      return { ...spec, route: args.route };
    }
  };
}

function pending(spec?: ChallengeSpec, scaffoldUsed: number | null = spec?.scaffoldLevel ?? null): CoachState {
  return {
    version: 1,
    kind: "awaiting_answer",
    question: "What happens when two north poles meet?",
    topicId: magnetTopic.id,
    expectedConcepts: concepts,
    sourceChunkIds: [magnetChunk.id],
    askedAt: "2026-01-01T00:00:00.000Z",
    ...(spec ? { issuedChallenge: { spec: spec as unknown as Record<string, unknown>, encounterId: "enc-1", scaffoldUsed } } : {})
  };
}

const initialSpec = specFor();

// --- 1-4: language floor, reasoning ceiling --------------------------------

test("1. the intro question is rendered for one concept in simple language", async () => {
  let seen: string[] | undefined;
  const { supabase, saved } = recordingSupabase(null);
  const { log } = await drainBoth(
    runCoachTurn({
      supabase,
      roomId: "room-1",
      conversationId: "c",
      question: "Coach me on magnetism",
      topics: [magnetTopic],
      userId: "user-1",
      deps: {
        director: fixedDirector(initialSpec),
        retrieveForRoom: async () => [magnetChunk],
        generateCoachQuestion: async (args) => {
          seen = args.challengeGuidance;
          return { question: "What happens when two magnets touch?", expectedConcepts: concepts, sourceChunkIds: [magnetChunk.id], sourceMarkers: [] };
        }
      }
    })
  );
  assert.deepEqual(seen, renderChallengeGuidance(initialSpec));
  const issued = (saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>).issuedChallenge;
  assert.deepEqual(issued?.spec, initialSpec);
  assert.equal(issued?.scaffoldUsed, initialSpec.scaffoldLevel);
  assert.ok(issued?.encounterId);
  const system = buildCoachQuestionSystem({ challengeGuidance: seen });
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
  const system = buildCoachQuestionSystem({ challengeGuidance: renderChallengeGuidance(specFor("transfer")) });
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
  const easy = buildCoachQuestionSystem({ challengeGuidance: renderChallengeGuidance(specFor("recall")) });
  const hard = buildCoachQuestionSystem({ challengeGuidance: renderChallengeGuidance(specFor("novel_problem")) });
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
  // Same question, same encounter; the hint is recorded as support used.
  const after = saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>;
  assert.equal(after.question, "What happens when two north poles meet?");
  assert.equal(after.issuedChallenge?.encounterId, "enc-1");
  assert.equal(after.issuedChallenge?.scaffoldUsed, 2);
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
  // Same pending question and encounter; the answer to the learner's own
  // question is recorded as assistance (hint level) on that encounter.
  assert.deepEqual(saved.at(-1), pending(initialSpec, 2));
  assert.ok(done.answer.text.includes("What happens when two north poles meet?"));
});

test("11. a route change alters teaching but not correctness", async () => {
  const outcomes: string[] = [];
  const systems = new Set<string>();
  for (const route of ["studigo_default", "socratic", "japanese_inspired"] as LearningRoute[]) {
    const { supabase } = recordingSupabase(pending(specFor("explain", route)));
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
            systems.add(buildCoachFeedbackSystem({ outcome: args.outcome, routeGuidance: args.routeGuidance }));
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
  let seenGuidance: string[] | undefined;
  const spec = specFor("predict");
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
          seenGuidance = args.challengeGuidance;
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
  assert.deepEqual(seenGuidance, renderChallengeGuidance(spec));
  assert.deepEqual(after.issuedChallenge?.spec, spec);
  assert.equal(after.question, "Two north ends meet. What do they do?");
});

test("13. 'Challenge me' asks the control plane; the Coach has no difficulty ladder of its own", async () => {
  const calls: string[] = [];
  const directorSpec = specFor("defend");
  const rendered: Array<string[] | undefined> = [];
  const deps = {
    director: fixedDirector(directorSpec, calls),
    retrieveForRoom: async () => [magnetChunk],
    fetchChunksByIds: async () => [magnetChunk],
    generateCoachQuestion: async (args: { challengeGuidance?: string[] }) => {
      rendered.push(args.challengeGuidance);
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
    drainBoth(runCoachTurn({ supabase, roomId: "room-1", conversationId: "c", question, topics: [magnetTopic], userId: "user-1", deps }));

  await run("Challenge me");
  assert.deepEqual(calls, ["user-1:topic-magnets:studigo_default"]);
  // Exactly the director's spec is rendered and stored — nothing stepped or edited.
  assert.deepEqual(rendered.at(-1), renderChallengeGuidance(directorSpec));
  const issued = (saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>).issuedChallenge;
  assert.deepEqual(issued?.spec, directorSpec);
  assert.notEqual(issued?.encounterId, "enc-1");

  // Correct answer, then "yes": the next question is again the director's call.
  await run("No, only opposite ends pull; same ends push apart");
  assert.equal(saved.at(-1)?.kind, "awaiting_control");
  await run("yes");
  assert.equal(calls.length, 2);
  assert.deepEqual(rendered.at(-1), renderChallengeGuidance(directorSpec));
});

test("a control-plane read failure renders without a target and claims no progression", async () => {
  const { supabase, saved } = recordingSupabase(null);
  let guidance: string[] | undefined = ["sentinel"];
  const { log } = await drainBoth(runCoachTurn({
    supabase, roomId: "room-1", conversationId: "c", question: "Coach me on magnetism", topics: [magnetTopic], userId: "user-1",
    deps: {
      director: { challengeFor: async () => { throw new Error("Could not load learning history"); } },
      retrieveForRoom: async () => [magnetChunk],
      generateCoachQuestion: async (args) => {
        guidance = args.challengeGuidance;
        return { question: "What happens when two magnets touch?", expectedConcepts: concepts, sourceChunkIds: [magnetChunk.id], sourceMarkers: [] };
      }
    }
  }));
  assert.equal(guidance, undefined);
  assert.equal(log.stateAfter, "awaiting_answer");
  assert.equal((saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>).issuedChallenge, undefined);
});

test("rendering is a pure function of the spec: route only changes route lines", () => {
  const socratic = renderChallengeGuidance(specFor("compare", "socratic", 2));
  const direct = renderChallengeGuidance(specFor("compare", "direct_instruction", 2));
  const route = (spec: ChallengeSpec) => new Set(renderRouteGuidance(spec));
  const socraticRoute = route(specFor("compare", "socratic"));
  const directRoute = route(specFor("compare", "direct_instruction"));
  assert.deepEqual(
    socratic.filter((line) => !socraticRoute.has(line)),
    direct.filter((line) => !directRoute.has(line))
  );
  assert.ok(socratic.some((line) => line.includes("Support level 2 (hint)")));
});

// ===========================================================================
// Review fix 1: language-floor ENFORCEMENT (not just guidance + telemetry)
// ===========================================================================

const burdened = "Explain the process by which magnets attract and describe why like poles repel?";

function openWith(question: string, rewrite: (args: { question: string; violations: string[] }) => Promise<string>, calls: string[][]) {
  const { supabase, saved } = recordingSupabase(null);
  const spec = specFor("predict");
  const run = drainBoth(runCoachTurn({
    supabase, roomId: "room-1", conversationId: "c", question: "Coach me on magnetism", topics: [magnetTopic], userId: "user-1",
    deps: {
      director: fixedDirector(spec),
      retrieveForRoom: async () => [magnetChunk],
      generateCoachQuestion: async () => ({ question, expectedConcepts: concepts, sourceChunkIds: [magnetChunk.id], sourceMarkers: [] }),
      rewriteCoachQuestion: async (args) => {
        calls.push(args.violations);
        return rewrite(args);
      }
    }
  }));
  return { run, saved, spec };
}

test("floor: a failing question is rewritten once; concepts, sources and spec are untouched", async () => {
  const calls: string[][] = [];
  const { run, saved, spec } = openWith(burdened, async () => "You push two north ends together. What will happen? Why?", calls);
  const { log, done } = await run;
  assert.equal(calls.length, 1);
  const after = saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>;
  assert.equal(after.question, "You push two north ends together. What will happen? Why?");
  assert.equal(done.answer.text, after.question);
  assert.deepEqual(after.expectedConcepts, concepts);
  assert.deepEqual(after.sourceChunkIds, [magnetChunk.id]);
  assert.deepEqual(after.issuedChallenge?.spec, spec);
  assert.equal((log.languageFloorEnforcement as { rewriteAccepted: boolean }).rewriteAccepted, true);
});

test("floor: a rewrite that lowers the reasoning demand is rejected and the original stands", async () => {
  const calls: string[][] = [];
  const { run, saved } = openWith(burdened, async () => "What is a magnet?", calls);
  const { log } = await run;
  assert.equal(calls.length, 1);
  assert.equal((saved.at(-1) as { question: string }).question, burdened);
  assert.equal((log.languageFloorEnforcement as { rejectedReason: string }).rejectedReason, "dropped the reasoning demand");
});

test("floor: at most one rewrite, even when the rewrite also fails", async () => {
  const calls: string[][] = [];
  const { run, saved } = openWith(burdened, async () => "Explain and describe, whereby magnets act?", calls);
  await run;
  assert.equal(calls.length, 1);
  assert.equal((saved.at(-1) as { question: string }).question, burdened);
});

test("floor: a passing question never calls the rewrite", async () => {
  const calls: string[][] = [];
  const { run } = openWith("You push two north ends together. What will happen? Why?", async () => "x", calls);
  await run;
  assert.equal(calls.length, 0);
});

test("floor: 'make it simpler' output is enforced too, keeping the encounter", async () => {
  const calls: string[][] = [];
  const spec = specFor("explain");
  const { supabase, saved } = recordingSupabase(pending(spec));
  await drainBoth(runCoachTurn({
    supabase, roomId: "room-1", conversationId: "c", question: "Make it simpler", topics: [magnetTopic],
    deps: {
      fetchChunksByIds: async () => [magnetChunk],
      generateCoachQuestion: async () => ({ question: burdened, expectedConcepts: [], sourceChunkIds: [], sourceMarkers: [] }),
      rewriteCoachQuestion: async (args) => { calls.push(args.violations); return "Two north ends meet. Why do they push apart?"; }
    }
  }));
  const after = saved.at(-1) as Extract<CoachState, { kind: "awaiting_answer" }>;
  assert.equal(calls.length, 1);
  assert.equal(after.question, "Two north ends meet. Why do they push apart?");
  assert.equal(after.issuedChallenge?.encounterId, "enc-1");
  assert.deepEqual(after.expectedConcepts, concepts);
});

// ===========================================================================
// Review fix 2: ONE canonical source per teaching route
// ===========================================================================

test("routes: the committed projection is exactly what the KB records generate (drift check)", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { ROUTE_RECORDS } = await import("./learning/director");
  const { projectRoutePolicy } = await import("./route-policy-projection");
  const committed = JSON.parse(readFileSync(join(__dirname, "generated", "route-policies.json"), "utf8"));
  const regenerated = Object.fromEntries(Object.values(ROUTE_RECORDS).map((name) => {
    const record = `knowledge/teaching-coaching/${name}.md`;
    return [record, projectRoutePolicy(record, readFileSync(join(__dirname, "..", "..", "..", record), "utf8"))];
  }));
  assert.deepEqual(committed, regenerated, "Run `pnpm --filter @studigo/web generate:routes` after editing a KB record.");
});

test("routes: every route's spec.routeRecord resolves, and its rules come verbatim from that record", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { LEARNING_ROUTES } = await import("./learning");
  for (const route of LEARNING_ROUTES) {
    const spec = specFor("explain", route);
    const markdown = readFileSync(join(__dirname, "..", "..", "..", spec.routeRecord), "utf8");
    const guidance = renderRouteGuidance(spec);
    const ruleLines = guidance.filter((line) => markdown.includes(`- ${line}`));
    assert.ok(ruleLines.length >= 2, `${route}: rules must come from ${spec.routeRecord}`);
  }
});

test("routes: coach-render.ts holds no hand-maintained route policy", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(join(__dirname, "coach-render.ts"), "utf8");
  assert.doesNotMatch(source, /sequence:\s*\[/);
  assert.doesNotMatch(source, /rules:\s*\[/);
});

// ===========================================================================
// Review fix 3: support/reveal tracked from the RESOLVED intent, monotonic,
// on the SAME encounter
// ===========================================================================

type Pending = Extract<CoachState, { kind: "awaiting_answer" }>;

function answerTurn(state: CoachState, question: string, evaluation: { intent: "answer" | "help_request" | "show_answer" | "irrelevant"; concepts: Array<{ id: string; status: "demonstrated" | "partial" | "absent" | "contradicted" }> }) {
  const { supabase, saved } = recordingSupabase(state);
  let revealed = false;
  let feedbackCalled = false;
  const run = drainBoth(runCoachTurn({
    supabase, roomId: "room-1", conversationId: "c", question, topics: [magnetTopic],
    deps: {
      fetchChunksByIds: async () => [magnetChunk],
      evaluateCoachAnswer: async () => evaluation,
      generateCoachFeedback: async () => { feedbackCalled = true; return "Think about the ends."; },
      answerFromRetrievedContext: async () => { revealed = true; return { text: "Like poles push apart [1].", citations: [], grounded: true }; }
    }
  }));
  return { run, saved, flags: () => ({ revealed, feedbackCalled }) };
}

test("support: an apparent answer the evaluator resolves to help_request records a hint", async () => {
  const { run, saved } = answerTurn(pending(initialSpec), "hmm can you nudge me a little on the ends thing", { intent: "help_request", concepts: [] });
  await run;
  assert.equal((saved.at(-1) as Pending).issuedChallenge?.scaffoldUsed, 2);
  assert.equal((saved.at(-1) as Pending).issuedChallenge?.encounterId, "enc-1");
});

test("support: an apparent answer the evaluator resolves to show_answer takes the reveal path and records a reveal", async () => {
  const { run, saved, flags } = answerTurn(pending(initialSpec), "just tell me what it is please, I give up on this one", { intent: "show_answer", concepts: [] });
  const { log } = await run;
  assert.deepEqual(flags(), { revealed: true, feedbackCalled: false });
  assert.equal(log.outcome, "show_answer");
  assert.equal((saved.at(-1) as Pending).issuedChallenge?.scaffoldUsed, 5);
});

test("support: incorrect feedback (a stated correction) and irrelevant redirects (a clue) are recorded", async () => {
  const wrong = answerTurn(pending(initialSpec), "All magnets always pull together", {
    intent: "answer", concepts: [{ id: "opposites_attract", status: "demonstrated" }, { id: "likes_repel", status: "contradicted" }]
  });
  await wrong.run;
  const afterWrong = wrong.saved.at(-1) as Pending;
  assert.equal(afterWrong.issuedChallenge?.scaffoldUsed, 5);

  const offTopic = answerTurn(pending(initialSpec), "pizza", { intent: "irrelevant", concepts: [] });
  await offTopic.run;
  assert.equal((offTopic.saved.at(-1) as Pending).issuedChallenge?.scaffoldUsed, 2);
});

test("support is monotonic on one encounter: example then simplify never lowers it", async () => {
  const spec = specFor("explain");
  const { supabase, saved } = recordingSupabase(pending(spec));
  const deps = {
    fetchChunksByIds: async () => [magnetChunk],
    renderCoachSupport: async () => "A fridge magnet sticks to the door.",
    generateCoachQuestion: async () => ({ question: "Two north ends meet. Why do they push apart?", expectedConcepts: [], sourceChunkIds: [], sourceMarkers: [] })
  };
  const run = (question: string) => drainBoth(runCoachTurn({ supabase, roomId: "room-1", conversationId: "c", question, topics: [magnetTopic], deps }));
  await run("Show me an example");
  assert.equal((saved.at(-1) as Pending).issuedChallenge?.scaffoldUsed, 3);
  await run("Make it simpler");
  const after = saved.at(-1) as Pending;
  assert.equal(after.issuedChallenge?.scaffoldUsed, 3);
  assert.equal(after.issuedChallenge?.encounterId, "enc-1");
});

test("support: a correct answer after a hint still carries the hint, so it can never look independent", async () => {
  const { supabase, saved } = recordingSupabase(pending(initialSpec));
  const deps = {
    fetchChunksByIds: async () => [magnetChunk],
    generateCoachFeedback: async () => "That's it.",
    evaluateCoachAnswer: async () => ({
      intent: "answer" as const,
      concepts: [{ id: "opposites_attract", status: "demonstrated" as const }, { id: "likes_repel", status: "demonstrated" as const }]
    })
  };
  const run = (question: string) => drainBoth(runCoachTurn({ supabase, roomId: "room-1", conversationId: "c", question, topics: [magnetTopic], deps }));
  await run("I don't know");
  await run("Opposite ends pull together and the same ends push apart");
  const after = saved.at(-1) as Extract<CoachState, { kind: "awaiting_control" }>;
  assert.equal(after.kind, "awaiting_control");
  assert.equal(after.issuedChallenge?.encounterId, "enc-1");
  assert.equal(after.issuedChallenge?.scaffoldUsed, 2);
});

test("support: unknown support stays unknown (null) and is never upgraded to a number", async () => {
  const { run, saved } = answerTurn(pending(initialSpec, null), "I'm stuck", { intent: "help_request", concepts: [] });
  await run;
  assert.equal((saved.at(-1) as Pending).issuedChallenge?.scaffoldUsed, null);
});
