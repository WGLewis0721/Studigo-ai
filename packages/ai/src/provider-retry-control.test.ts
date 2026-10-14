// Control the raw SDK retry behavior independently from the C07 OCR path,
// which deliberately forbids automatic retries with or without admission.
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

test("control: without admission, a raw SDK request retries a 500", async () => {
  const { client, chatModel } = await import("./client");
  await assert.rejects(client().responses.create({
    model: chatModel(), input: "Synthetic request, no user data"
  }));
  assert.ok(fetches > 1, `expected SDK retries for raw calls, saw ${fetches} request(s)`);
});

test("OCR is always no-retry even if admission is disabled", async () => {
  const { ocrImage } = await import("./ocr");
  const before = fetches;
  await assert.rejects(ocrImage({ bytes: new Uint8Array(10), mimeType: "image/png" }));
  assert.equal(fetches - before, 1, "OCR must never replay a paid provider request");
});
