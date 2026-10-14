// End-to-end proof, through the real OpenAI SDK, that admitted provider work is bounded.
// A counting fake fetch stands in for the network, so "reached the provider" is observable.
process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
process.env.STUDIGO_AI_ADMISSION = "1";
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.OLLAMA_BASE_URL;

import assert from "node:assert/strict";
import test from "node:test";

let fetches = 0;
let mode: "ok" | "fail" = "ok";
const EMBED_DIM = 1536;
globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
  fetches++;
  if (mode === "fail") return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } });
  const body = JSON.parse(String(init?.body ?? "{}"));
  if (Array.isArray(body.input) && body.model?.startsWith("text-embedding")) {
    return Response.json({
      object: "list", model: body.model, usage: { prompt_tokens: 1, total_tokens: 1 },
      data: body.input.map((_: unknown, index: number) => ({ object: "embedding", index, embedding: new Array(EMBED_DIM).fill(0) }))
    });
  }
  return Response.json({
    id: "resp_1", object: "response", created_at: 0, status: "completed", model: "gpt-4.1-mini",
    output: [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text: "ok", annotations: [] }] }],
    parallel_tool_calls: false, tool_choice: "auto", tools: []
  });
}) as typeof fetch;

const png = (bytes: number) => ({ bytes: new Uint8Array(bytes), mimeType: "image/png" });
const scope = async <T>(operation: string, run: () => Promise<T>) => {
  const { withProviderWorkBudget } = await import("./provider-budget");
  return withProviderWorkBudget(operation, new AbortController().signal, run);
};

test("with admission on, the SDK never retries: one billed request per debited call", async () => {
  const { ocrImage } = await import("./ocr");
  mode = "fail"; fetches = 0;
  await scope("document-process", async () => {
    await assert.rejects(ocrImage(png(10)));
  });
  assert.equal(fetches, 1, "a failing provider call must not be silently repeated by the SDK");
  mode = "ok";
});

test("OCR is metered: the 65th document page is refused before it reaches the provider", async () => {
  const { ocrImage } = await import("./ocr");
  mode = "ok"; fetches = 0;
  await scope("document-process", async () => {
    for (let page = 0; page < 64; page++) await ocrImage(png(10));
    await assert.rejects(ocrImage(png(10)), /allowance exhausted/);
  });
  assert.equal(fetches, 64);
});

test("a non-document operation is capped at 16 provider responses", async () => {
  const { ocrImage } = await import("./ocr");
  mode = "ok"; fetches = 0;
  await scope("chat", async () => {
    for (let call = 0; call < 16; call++) await ocrImage(png(10));
    await assert.rejects(ocrImage(png(10)), /allowance exhausted/);
  });
  assert.equal(fetches, 16);
});

test("OCR input bytes are metered, so one huge page cannot bypass the envelope", async () => {
  const { ocrImage } = await import("./ocr");
  mode = "ok"; fetches = 0;
  await scope("document-process", async () => {
    await assert.rejects(ocrImage(png(3_100_000)), /allowance exhausted/);
  });
  assert.equal(fetches, 0, "refused before any network request");
});

test("embedding fan-out is capped at 32 provider calls for a non-document operation", async () => {
  const { embedTexts } = await import("./embeddings");
  mode = "ok"; fetches = 0;
  await scope("topic-regenerate", async () => {
    await assert.rejects(embedTexts(Array.from({ length: 96 * 33 }, () => "x")), /allowance exhausted/);
  });
  assert.equal(fetches, 32);
});

test("embedding fan-out is capped at 128 provider calls for a document operation", async () => {
  const { embedTexts } = await import("./embeddings");
  mode = "ok"; fetches = 0;
  await scope("document-process", async () => {
    await assert.rejects(embedTexts(Array.from({ length: 96 * 129 }, () => "x")), /allowance exhausted/);
  });
  assert.equal(fetches, 128);
});

test("outside any admission scope no provider request is ever sent", async () => {
  const { ocrImage } = await import("./ocr");
  const { embedTexts } = await import("./embeddings");
  mode = "ok"; fetches = 0;
  await assert.rejects(ocrImage(png(10)), /outside an admission scope/);
  await assert.rejects(embedTexts(["x"]), /outside an admission scope/);
  assert.equal(fetches, 0);
});
