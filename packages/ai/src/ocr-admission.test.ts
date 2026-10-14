import assert from "node:assert/strict";
import test from "node:test";
import { executeAdmittedOcrRequest } from "./ocr-admission";
import { withProviderWorkBudget, debitResponseWork } from "./provider-budget";

const meter = {
  model: "gpt-4.1-mini",
  maxOutputTokens: 1200,
  meteredInput: "page-bytes"
};

test("admitted OCR debits one response, composes cancellation, and does not select pages", async () => {
  const caller = new AbortController();
  let seen: AbortSignal | undefined;
  await withProviderWorkBudget("document-process", new AbortController().signal, async () => {
    const text = await executeAdmittedOcrRequest({
      ...meter,
      requestSignal: caller.signal,
      timeoutMs: 60_000,
      start: async (signal) => {
        seen = signal;
        assert.equal(signal.aborted, false);
        return "transcribed";
      }
    });
    assert.equal(text, "transcribed");
    assert.ok(seen);
    for (let i = 0; i < 63; i++) debitResponseWork({ model: meter.model, input: "x", max_output_tokens: meter.maxOutputTokens });
    assert.throws(() => debitResponseWork({ model: meter.model, input: "x", max_output_tokens: meter.maxOutputTokens }), /allowance exhausted/);
    caller.abort();
    assert.equal(seen!.aborted, true);
  });
});

test("OCR outside an enabled admission scope does not start the provider call", async () => {
  const previous = process.env.STUDIGO_AI_ADMISSION;
  process.env.STUDIGO_AI_ADMISSION = "1";
  try {
    let started = false;
    await assert.rejects(() => executeAdmittedOcrRequest({
      ...meter,
      start: async () => { started = true; return "nope"; }
    }), /outside an admission scope/);
    assert.equal(started, false);
  } finally {
    if (previous === undefined) delete process.env.STUDIGO_AI_ADMISSION;
    else process.env.STUDIGO_AI_ADMISSION = previous;
  }
});

test("an OCR timeout outside 1s..180s is rejected before provider work", async () => {
  await withProviderWorkBudget("document-reindex", new AbortController().signal, async () => {
    let started = false;
    await assert.rejects(() => executeAdmittedOcrRequest({
      ...meter,
      timeoutMs: 180_001,
      start: async () => { started = true; return ""; }
    }), /outside the admission envelope/);
    assert.equal(started, false);
  });
});
