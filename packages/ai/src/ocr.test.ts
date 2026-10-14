import assert from "node:assert/strict";
import { test } from "node:test";
import { ocrPagePdf } from "./ocr";

test("C07 OCR rejects incomplete provider transcription without retrying or exposing text", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-offline-test-key";
  let requests = 0;
  globalThis.fetch = async (_input, init) => {
    requests += 1;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.input[0].content[1].type, "input_file");
    assert.match(body.input[0].content[1].file_data, /^data:application\/pdf;base64,/);
    return new Response(JSON.stringify({
      id: "synthetic-response", object: "response", status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" }, error: null,
      output: [{ type: "message", id: "synthetic-message", role: "assistant", status: "incomplete",
        content: [{ type: "output_text", text: "synthetic partial transcription", annotations: [] }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await assert.rejects(ocrPagePdf({
      pdf: new Uint8Array([37, 80, 68, 70]), filename: "synthetic-page.pdf"
    }), (error: Error & { reason?: string }) => {
      assert.equal(error.name, "OcrResponseError");
      assert.equal(error.reason, "output_limit");
      assert.doesNotMatch(error.message, /synthetic partial transcription/);
      return true;
    });
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});


test("admission rejects out-of-scope OCR before starting provider work", async () => {
  const previousAdmission = process.env.STUDIGO_AI_ADMISSION;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.OPENAI_API_KEY = "synthetic-offline-test-key";
  process.env.STUDIGO_AI_ADMISSION = "1";
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("Provider must never be reached without admission");
  };
  try {
    await assert.rejects(
      ocrPagePdf({ pdf: new Uint8Array([37, 80, 68, 70]), filename: "unadmitted.pdf" }),
      (error: Error) => {
        assert.equal(error.name, "ProviderWorkBudgetError");
        assert.match(error.message, /outside an admission scope/);
        return true;
      }
    );
    assert.equal(calls, 0, "Fail-closed denial must not cause a billable request");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAdmission === undefined) delete process.env.STUDIGO_AI_ADMISSION;
    else process.env.STUDIGO_AI_ADMISSION = previousAdmission;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
