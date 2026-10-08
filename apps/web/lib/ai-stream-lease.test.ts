import assert from "node:assert/strict";
import test from "node:test";
import { protectAiStream, trackAiStreamProducer } from "./ai-stream-lease";

test("cancelled response does not release lease while its async producer is still running", async () => {
  let finish!: () => void;
  const active = new Promise<void>(resolve => { finish = resolve; });
  let released = 0;
  const source = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([42])); }
    // Intentionally no cancel handler: matches async-start Chat producer semantics.
  });
  const tracked = trackAiStreamProducer(new Response(source), active);
  const protectedResponse = protectAiStream(tracked, async () => { released++; });
  const reader = protectedResponse.body!.getReader();
  assert.equal((await reader.read()).value?.[0], 42);
  const cancellation = reader.cancel();
  await Promise.resolve();
  assert.equal(released, 0, "billable provider is still running");
  finish();
  await cancellation;
  assert.equal(released, 1);
});

test("real Request AbortSignal retains the lease until provider termination", async () => {
  const abort = new AbortController();
  const request = new Request("https://studigo.test/api/chat", { method: "POST", signal: abort.signal });
  let finish!: () => void;
  const producer = new Promise<void>(resolve => { finish = resolve; });
  let released = 0;
  const stream = trackAiStreamProducer(new Response(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); }
  })), producer);
  const protectedResponse = protectAiStream(stream, async () => { released++; }, request.signal);
  const reader = protectedResponse.body!.getReader();
  await reader.read();
  abort.abort();
  await Promise.resolve();
  assert.equal(released, 0);
  finish();
  for (let i = 0; i < 20 && released === 0; i++) await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(released, 1, "provider has terminated after abort");
});
