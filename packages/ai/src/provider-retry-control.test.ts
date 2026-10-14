// Positive control: WITHOUT admission the SDK does retry a failing call, which is exactly
// why provider-envelope.test.ts asserting "one request" is meaningful and not vacuous.
process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
delete process.env.STUDIGO_AI_ADMISSION;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.OLLAMA_BASE_URL;

import assert from "node:assert/strict";
import test from "node:test";

let fetches = 0;
globalThis.fetch = (async () => {
  fetches++;
  return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } });
}) as typeof fetch;

test("control: with admission off the SDK retries a 500, multiplying provider requests", async () => {
  const { ocrImage } = await import("./ocr");
  await assert.rejects(ocrImage({ bytes: new Uint8Array(10), mimeType: "image/png" }));
  assert.ok(fetches > 1, `expected SDK retries, saw ${fetches} request(s)`);
});
