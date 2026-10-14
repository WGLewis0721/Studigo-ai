import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { trackProviderCall } from "@studigo/ai";
import { guardAiRequestWith, type AdmissionDeps, type RpcResult } from "./ai-admission-core";

const OWNER = "11111111-1111-4111-8111-111111111111";
const LIMITS = {
  STUDIGO_AI_USER_PER_MINUTE: "8", STUDIGO_AI_IP_PER_MINUTE: "30", STUDIGO_AI_GLOBAL_PER_MINUTE: "120",
  STUDIGO_AI_USER_CONCURRENT: "2", STUDIGO_AI_IP_CONCURRENT: "8", STUDIGO_AI_GLOBAL_CONCURRENT: "20",
  STUDIGO_AI_USER_DAILY_MICRO_USD: "2000000", STUDIGO_AI_GLOBAL_DAILY_MICRO_USD: "20000000"
};
const ENV = {
  STUDIGO_AI_ADMISSION: "1", VERCEL: "1", NODE_ENV: "production",
  STUDIGO_AI_IP_HASH_SECRET: "s".repeat(40), ...LIMITS
};
type Call = { name: string; args: Record<string, unknown> };
type Handler = (args: Record<string, unknown>) => RpcResult | Promise<RpcResult>;

/** Like the real Supabase builder: a thenable WITHOUT .catch(). */
function fakeWriter(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const defaults: Record<string, Handler> = {
    claim_studigo_ai_receipt: () => ({ data: { claimed: true }, error: null }),
    admit_studigo_ai_resource: (a) => ({ data: { allowed: true, lease_id: a.p_lease_id }, error: null }),
    start_studigo_ai_receipt: () => ({ data: true, error: null }),
    finish_studigo_ai_resource: () => ({ data: true, error: null }),
    finish_studigo_ai_receipt: () => ({ data: true, error: null }),
    renew_studigo_ai_resource: () => ({ data: true, error: null })
  };
  return {
    calls,
    names: () => calls.map((call) => call.name),
    last: (name: string) => [...calls].reverse().find((call) => call.name === name),
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      const handler = overrides[name] ?? defaults[name];
      return {
        then: (resolve: (value: RpcResult) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve().then(() => handler(args)).then(resolve, reject)
      } as PromiseLike<RpcResult>;
    }
  };
}
const request = (headers: Record<string, string> = {}, body = JSON.stringify({ q: 1 })) =>
  new Request("https://studigo.test/api/chat", {
    method: "POST", body, headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers }
  });
const deps = (writer: ReturnType<typeof fakeWriter>, env: Record<string, string | undefined> = ENV, extra: Partial<AdmissionDeps> = {}): AdmissionDeps => ({
  env, requireUser: async () => ({ user: { id: OWNER } }), createWriter: () => writer, drainTimeoutMs: 40, ...extra
});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const ok = async () => Response.json({ ok: true });

test("admission disabled passes straight through with no database traffic", async () => {
  const writer = fakeWriter();
  let handled = 0;
  const response = await guardAiRequestWith(deps(writer, { ...ENV, STUDIGO_AI_ADMISSION: undefined }), request(), "chat", async () => { handled++; return new Response("x"); });
  assert.equal(handled, 1);
  assert.equal(await response.text(), "x");
  assert.equal(writer.calls.length, 0);
});

test("an unauthenticated caller is turned away before any database traffic", async () => {
  const writer = fakeWriter();
  const denied = new Response("no", { status: 401 });
  const response = await guardAiRequestWith({ ...deps(writer), requireUser: async () => ({ user: null, unauthorized: denied }) }, request(), "chat", ok);
  assert.equal(response, denied);
  assert.equal(writer.calls.length, 0);
});

test("misconfiguration and untrusted IP provenance fail closed without reaching the handler", async () => {
  const cases: Array<[string, Record<string, string | undefined>, Record<string, string>]> = [
    ["missing limit", { ...ENV, STUDIGO_AI_GLOBAL_PER_MINUTE: undefined }, {}],
    ["zero limit", { ...ENV, STUDIGO_AI_USER_CONCURRENT: "0" }, {}],
    ["missing hash secret", { ...ENV, STUDIGO_AI_IP_HASH_SECRET: undefined }, {}],
    ["weak hash secret", { ...ENV, STUDIGO_AI_IP_HASH_SECRET: "short" }, {}],
    ["multi-hop forwarded-for", ENV, { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }],
    ["garbage forwarded-for", ENV, { "x-forwarded-for": "not-an-ip" }],
    ["not on Vercel in production", { ...ENV, VERCEL: undefined }, {}]
  ];
  for (const [label, env, headers] of cases) {
    const writer = fakeWriter();
    let handled = 0;
    const response = await guardAiRequestWith(deps(writer, env), request(headers), "chat", async () => { handled++; return ok(); });
    assert.equal(response.status, 503, label);
    assert.equal(handled, 0, label);
    assert.equal(writer.names().includes("admit_studigo_ai_resource"), false, label);
  }
});

test("a malformed operation id is rejected, never silently replaced with a fresh one", async () => {
  const writer = fakeWriter();
  let handled = 0;
  const response = await guardAiRequestWith(deps(writer), request({ "x-studigo-operation-id": "retry-me" }), "chat", async () => { handled++; return ok(); });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_operation_id");
  assert.equal(handled, 0);
  assert.equal(writer.calls.length, 0);
});

test("a supplied operation id keys the receipt and lease, and an absent one is generated", async () => {
  const id = "123E4567-E89B-42D3-A456-426614174000";
  const writer = fakeWriter();
  await guardAiRequestWith(deps(writer), request({ "x-studigo-operation-id": id }), "chat", ok);
  assert.equal(writer.last("claim_studigo_ai_receipt")!.args.p_request_key, id.toLowerCase());
  assert.equal(writer.last("admit_studigo_ai_resource")!.args.p_request_key, id.toLowerCase());
  const other = fakeWriter();
  await guardAiRequestWith(deps(other), request(), "chat", ok);
  assert.match(String(other.last("claim_studigo_ai_receipt")!.args.p_request_key), /^[0-9a-f-]{36}$/);
});

test("IP limits key on the /64 for IPv6, so address rotation inside a subnet cannot dodge them", async () => {
  const hash = async (ip: string) => {
    const writer = fakeWriter();
    await guardAiRequestWith(deps(writer), request({ "x-forwarded-for": ip }), "chat", ok);
    return writer.last("admit_studigo_ai_resource")!.args.p_ip_hash;
  };
  const a = await hash("2001:db8:aaaa:bbbb::1");
  assert.equal(await hash("2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff"), a);
  assert.notEqual(await hash("2001:db8:aaaa:cccc::1"), a);
  assert.equal(await hash("::ffff:203.0.113.9"), await hash("203.0.113.9"));
  assert.notEqual(await hash("203.0.113.10"), await hash("203.0.113.9"));
});

test("every receipt refusal maps to a distinct, honest status and never starts work", async () => {
  const expected: Record<string, number> = {
    completed: 202, idempotency_conflict: 409, ambiguous: 409, running: 429, duplicate: 429, invalid: 503
  };
  for (const [reason, status] of Object.entries(expected)) {
    const writer = fakeWriter({ claim_studigo_ai_receipt: () => ({ data: { claimed: false, reason }, error: null }) });
    let handled = 0;
    const response = await guardAiRequestWith(deps(writer), request(), "chat", async () => { handled++; return ok(); });
    assert.equal(response.status, status, reason);
    assert.equal((await response.json()).code, reason);
    assert.equal(handled, 0, reason);
    assert.deepEqual(writer.names(), ["claim_studigo_ai_receipt"], reason);
    assert.equal(response.headers.has("Retry-After"), status === 429 || status === 503, reason);
  }
});

test("an admission refusal releases the claimed receipt and never runs the handler", async () => {
  const writer = fakeWriter({ admit_studigo_ai_resource: () => ({ data: { allowed: false, reason: "rate" }, error: null }) });
  let handled = 0;
  const response = await guardAiRequestWith(deps(writer), request(), "chat", async () => { handled++; return ok(); });
  assert.equal(response.status, 429);
  assert.equal(handled, 0);
  assert.deepEqual(writer.names(), ["claim_studigo_ai_receipt", "admit_studigo_ai_resource", "finish_studigo_ai_receipt"]);
  assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, false);
});

test("a database error during admission fails closed and releases the receipt", async () => {
  const writer = fakeWriter({ admit_studigo_ai_resource: () => ({ data: null, error: { message: "db down" } }) });
  const response = await guardAiRequestWith(deps(writer), request(), "chat", ok);
  assert.equal(response.status, 503);
  assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, false);
});

test("a receipt that cannot be started releases the lease and receipt and refuses", async () => {
  const writer = fakeWriter({ start_studigo_ai_receipt: () => ({ data: false, error: null }) });
  let handled = 0;
  const response = await guardAiRequestWith(deps(writer), request(), "chat", async () => { handled++; return ok(); });
  assert.equal(response.status, 503);
  assert.equal(handled, 0);
  assert.ok(writer.names().includes("finish_studigo_ai_resource"));
  assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, false);
});

test("a successful request claims, admits, starts, runs, releases the lease then completes the receipt", async () => {
  const writer = fakeWriter();
  const response = await guardAiRequestWith(deps(writer), request(), "chat", ok);
  assert.equal(response.status, 200);
  assert.deepEqual(writer.names(), [
    "claim_studigo_ai_receipt", "admit_studigo_ai_resource", "start_studigo_ai_receipt",
    "finish_studigo_ai_resource", "finish_studigo_ai_receipt"
  ]);
  assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, true);
  assert.equal(writer.last("admit_studigo_ai_resource")!.args.p_reserved_micro_usd, 20_000);
});

test("an error response is never recorded as a replayable completed result", async () => {
  const writer = fakeWriter();
  const response = await guardAiRequestWith(deps(writer), request(), "chat", async () => new Response("fail", { status: 500 }));
  assert.equal(response.status, 500);
  assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, false);
  assert.ok(writer.names().includes("finish_studigo_ai_resource"));
});

test("a throwing handler releases the lease, keeps its own error even if receipt cleanup also fails", async () => {
  const writer = fakeWriter({ finish_studigo_ai_receipt: () => { throw new Error("receipt rpc exploded"); } });
  await assert.rejects(
    guardAiRequestWith(deps(writer), request(), "chat", async () => { throw new Error("handler boom"); }),
    /handler boom/
  );
  assert.ok(writer.names().includes("finish_studigo_ai_resource"));
});

test("fail-closed cleanup survives a rejecting receipt RPC instead of throwing a TypeError", async () => {
  // Regression: .catch() on the Supabase builder is not a function, so the old cleanup threw TypeError.
  const writer = fakeWriter({
    admit_studigo_ai_resource: () => { throw new Error("connection reset"); },
    finish_studigo_ai_receipt: () => { throw new Error("also down"); }
  });
  const response = await guardAiRequestWith(deps(writer), request(), "chat", ok);
  assert.equal(response.status, 503);
});

test("the lease keeps renewing while aborted provider work drains and is released only after it stops", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    const writer = fakeWriter();
    let stop!: () => void;
    const provider = new Promise<void>((resolve) => { stop = resolve; });
    const finished = guardAiRequestWith(deps(writer, ENV, { drainTimeoutMs: 60_000 }), request(), "chat", async () => {
      void trackProviderCall(() => provider);
      return Response.json({ ok: true });
    });
    await tick(); await tick();
    for (let i = 0; i < 3; i++) { mock.timers.tick(60_000); await tick(); }
    assert.equal(writer.calls.filter((c) => c.name === "renew_studigo_ai_resource").length, 3, "renewed through the drain");
    assert.equal(writer.names().includes("finish_studigo_ai_resource"), false, "lease is held while provider work runs");
    stop();
    await finished;
    assert.ok(writer.names().includes("finish_studigo_ai_resource"));
    assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, true);
    const renewals = writer.calls.filter((c) => c.name === "renew_studigo_ai_resource").length;
    mock.timers.tick(180_000); await tick();
    assert.equal(writer.calls.filter((c) => c.name === "renew_studigo_ai_resource").length, renewals, "renewal stops once settled");
  } finally { mock.timers.reset(); }
});

test("provider work that never stops leaves the lease to expire and the receipt ambiguous", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    const writer = fakeWriter();
    const response = await guardAiRequestWith(deps(writer, ENV, { drainTimeoutMs: 30 }), request(), "chat", async () => {
      void trackProviderCall(() => new Promise<void>(() => { /* ignores abort forever */ }));
      return Response.json({ ok: true });
    });
    assert.equal(response.status, 200, "the learner is not held hostage by a stuck provider call");
    assert.equal(writer.names().includes("finish_studigo_ai_resource"), false, "never release while work may still run");
    assert.equal(writer.last("finish_studigo_ai_receipt")!.args.p_completed, false);
    const before = writer.calls.length;
    mock.timers.tick(300_000); await tick();
    assert.equal(writer.calls.length, before, "no renewals after giving up, so the lease expires");
  } finally { mock.timers.reset(); }
});

test("a stream that ends on its own completes the receipt; a cancelled one does not", async () => {
  const sse = (close: boolean) => async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode("data: hi\n\n")); if (close) controller.close(); }
  }), { headers: { "content-type": "text/event-stream" } });

  const natural = fakeWriter();
  const done = await guardAiRequestWith(deps(natural), request(), "chat", sse(true));
  await done.text();
  await tick(); await tick();
  assert.equal(natural.last("finish_studigo_ai_receipt")!.args.p_completed, true);
  assert.ok(natural.names().includes("finish_studigo_ai_resource"));

  const cancelled = fakeWriter();
  const open = await guardAiRequestWith(deps(cancelled), request(), "chat", sse(false));
  const reader = open.body!.getReader();
  await reader.read();
  await reader.cancel();
  await tick(); await tick();
  assert.equal(cancelled.last("finish_studigo_ai_receipt")!.args.p_completed, false);
  assert.ok(cancelled.names().includes("finish_studigo_ai_resource"), "released once the producer stopped");
});
