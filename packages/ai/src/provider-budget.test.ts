import assert from "node:assert/strict";
import test from "node:test";
import {
  withProviderWorkBudget, debitResponseWork, debitEmbeddingWork, providerAbortSignal,
  trackProviderCall, abortAndDrainProviderWork
} from "./provider-budget";

const chat = (input = "short") => ({
  model: "gpt-4.1-mini", input, max_output_tokens: 1200
});

test("request budget blocks a runaway response fanout before the seventeenth provider call", async () => {
  await withProviderWorkBudget("chat", new AbortController().signal, async () => {
    for (let i = 0; i < 16; i++) debitResponseWork(chat());
    assert.throws(() => debitResponseWork(chat()), /allowance exhausted/);
  });
});

test("provider work budget requires approved models and bounded output", async () => {
  await withProviderWorkBudget("learn", new AbortController().signal, async () => {
    assert.throws(() => debitResponseWork({ ...chat(), model: "gpt-4.1" }), /no approved/);
    assert.throws(() => debitResponseWork({ ...chat(), max_output_tokens: 999999 }), /hard cap/);
    assert.throws(() => debitResponseWork(chat("z".repeat(4_000_001))), /allowance exhausted/);
    assert.throws(() => debitEmbeddingWork("text-embedding-3-large", ["ok"]), /no approved/);
  });
});

test("maximal document embedding fanout is bounded even across batches", async () => {
  await withProviderWorkBudget("document-reindex", new AbortController().signal, async () => {
    for (let i = 0; i < 42; i++) debitEmbeddingWork("text-embedding-3-small", Array(96).fill("x".repeat(1000)));
    assert.throws(() => debitEmbeddingWork("text-embedding-3-small", Array(96).fill("x".repeat(100_000))), /allowance exhausted/);
    for (let i = 0; i < 40; i++) debitResponseWork(chat("scan"));
    for (let i = 40; i < 64; i++) debitResponseWork(chat("scan"));
    assert.throws(() => debitResponseWork(chat()), /allowance exhausted/);
  });
});

test("aborting a real request prevents further provider work and aborts SDK signal", async () => {
  const controller = new AbortController();
  const req = new Request("https://studigo.example/api/chat", { method: "POST", signal: controller.signal });
  await withProviderWorkBudget("chat", req.signal, async () => {
    assert.equal(providerAbortSignal()?.aborted, false);
    controller.abort();
    assert.equal(providerAbortSignal()?.aborted, true);
    assert.throws(() => debitResponseWork(chat()), /deadline exceeded/);
  });
});

test("independent admitted requests never share a work counter", async () => {
  await Promise.all([1, 2].map(() =>
    withProviderWorkBudget("chat", new AbortController().signal, async () => {
      for (let i = 0; i < 16; i++) debitResponseWork(chat());
    })
  ));
});

test("a 20-question practice test fits its response envelope and the 21st call does not", async () => {
  for (const operation of ["practice-test-generate", "practice-test-grade"]) {
    await withProviderWorkBudget(operation, new AbortController().signal, async () => {
      for (let i = 0; i < 20; i++) debitResponseWork(chat());
      assert.throws(() => debitResponseWork(chat()), /allowance exhausted/);
    });
  }
});

test("admission refuses provider work that never entered a budget scope", async () => {
  const previous = process.env.STUDIGO_AI_ADMISSION;
  process.env.STUDIGO_AI_ADMISSION = "1";
  try {
    let started = false;
    assert.throws(() => trackProviderCall(async () => { started = true; }), /outside an admission scope/);
    assert.equal(started, false);
    assert.throws(() => debitResponseWork(chat()), /outside an admission scope/);
  } finally {
    if (previous === undefined) delete process.env.STUDIGO_AI_ADMISSION;
    else process.env.STUDIGO_AI_ADMISSION = previous;
  }
});

test("drain waits for a registered provider call and aborts its budget signal", async () => {
  await withProviderWorkBudget("chat", new AbortController().signal, async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const tracked = trackProviderCall(() => hold);
    let drained = false;
    const draining = abortAndDrainProviderWork().then(() => { drained = true; });
    await Promise.resolve();
    assert.equal(drained, false);
    assert.equal(providerAbortSignal()?.aborted, true);
    release();
    await tracked;
    await draining;
    assert.equal(drained, true);
  });
});
