import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { client } from "./client";
import { StructuredOutputError } from "./structured-output";
import { generateQuizQuestions, structured } from "./study";

process.env.OPENAI_API_KEY = "sk-test";
delete process.env.STUDIGO_MAX_OUTPUT_TOKENS;

type Call = { max_output_tokens?: number; input: Array<{ role: string; content: string }> };

function textReply(text: string) {
  return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }], output_text: text };
}

const refusalReply = {
  status: "completed",
  output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help with that." }] }],
  output_text: ""
};

const truncatedReply = {
  status: "incomplete",
  incomplete_details: { reason: "max_output_tokens" },
  output: [{ type: "message", content: [{ type: "output_text", text: '{"answer":"cut o' }] }],
  output_text: '{"answer":"cut o'
};

function stubProvider(t: TestContext, replies: unknown[]) {
  const calls: Call[] = [];
  t.mock.method(client().responses, "create", (async (params: Call) => {
    calls.push(params);
    return replies[calls.length - 1] ?? textReply('{"answer":"third call"}');
  }) as never);
  return calls;
}

const base = { system: "Answer.", user: "Question.", schemaName: "test_schema", schema: { type: "object" } };

test("a refusal makes one provider call and is never retried", async (t) => {
  const calls = stubProvider(t, [refusalReply, textReply('{"answer":"ok"}')]);

  await assert.rejects(structured<{ answer: string }>(base), (error: unknown) => {
    assert.ok(error instanceof StructuredOutputError);
    assert.equal(error.kind, "refusal");
    assert.equal(error.schemaName, "test_schema");
    return true;
  });
  assert.equal(calls.length, 1);
});

test("a truncated reply is retried once with a larger output budget", async (t) => {
  const calls = stubProvider(t, [truncatedReply, textReply('{"answer":"ok"}')]);

  assert.deepEqual(await structured<{ answer: string }>(base), { answer: "ok" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.max_output_tokens, 1200);
  assert.ok(calls[1]!.max_output_tokens! > 1200);
});

test("a quiz item with a bad answer key is retried instead of silently dropped", async (t) => {
  const quiz = (correctChoice: number) =>
    textReply(
      JSON.stringify({
        questions: [
          {
            kind: "multiple_choice",
            prompt: "Which layer holds the weather?",
            choices: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"],
            correct_choice: correctChoice,
            expected_answer: null,
            accepted_answers: [],
            explanation: "The troposphere holds most weather.",
            difficulty: "core",
            source_markers: [1]
          }
        ]
      })
    );
  const calls = stubProvider(t, [quiz(7), quiz(0)]);

  const questions = await generateQuizQuestions({
    chunks: [{ id: "c1", documentId: "d1", documentName: "Notes", content: "The troposphere holds most weather.", similarity: 0.9 }],
    count: 1
  });

  assert.equal(calls.length, 2);
  assert.equal(questions.length, 1);
  assert.equal(questions[0]!.correctChoice, 0);
  const note = calls[1]!.input.at(-1)!;
  assert.equal(note.role, "system");
  assert.match(note.content, /question 1/);
});

test("two consecutive failures make exactly two provider calls and throw the last kind", async (t) => {
  const calls = stubProvider(t, [textReply("not json"), textReply("   "), textReply('{"answer":"ok"}')]);

  await assert.rejects(structured<{ answer: string }>(base), (error: unknown) => {
    assert.ok(error instanceof StructuredOutputError);
    assert.equal(error.kind, "empty");
    return true;
  });
  assert.equal(calls.length, 2);
});

test("the error and the retry never carry the model's output", async (t) => {
  const leak = "LEAK-MARKER-9f3a";
  const calls = stubProvider(t, [textReply(`${leak} is not json`), textReply(`${leak} still not json`)]);

  await assert.rejects(structured<{ answer: string }>({ ...base, user: "private learner text" }), (error: unknown) => {
    assert.ok(error instanceof StructuredOutputError);
    assert.equal(error.kind, "unparsable");
    assert.equal(error.message.includes(leak), false);
    assert.equal(error.message.includes("private learner text"), false);
    return true;
  });
  assert.equal(JSON.stringify(calls[1]!.input).includes(leak), false);
});
