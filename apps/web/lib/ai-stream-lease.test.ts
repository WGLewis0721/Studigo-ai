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


test("actual HTTP client disconnect cannot free an active provider's lease", async () => {
  const { createServer } = await import("node:http");
  let completeProvider!: () => void;
  const producer = new Promise<void>(resolve => { completeProvider = resolve; });
  let release!: () => void;
  const leaseReleased = new Promise<void>(resolve => { release = resolve; });
  let disconnected!: () => void;
  const socketClosed = new Promise<void>(resolve => { disconnected = resolve; });
  let releases = 0;
  const server = createServer((req, res) => {
    const stream = trackAiStreamProducer(new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("data: start\\n\\n")); }
    })), producer);
    const guarded = protectAiStream(stream, async () => { releases++; release(); });
    const reader = guarded.body!.getReader();
    res.setHeader("Content-Type", "text/event-stream");
    res.on("close", () => { disconnected(); void reader.cancel().catch(() => {}); });
    void (async () => {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          res.write(part.value);
        }
      } catch { /* genuine disconnect */ }
      finally { if (!res.destroyed) res.end(); }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    const client = new AbortController();
    const response = await fetch(`http://127.0.0.1:${addr.port}/api/chat`, { signal: client.signal });
    assert.equal(response.status, 200);
    const first = await response.body!.getReader().read();
    assert.equal(first.done, false);
    client.abort();
    await socketClosed;
    assert.equal(releases, 0, "socket closed but provider still running");
    completeProvider();
    await leaseReleased;
    assert.equal(releases, 1);
  } finally {
    completeProvider();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
