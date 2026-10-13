import assert from "node:assert/strict";
import test from "node:test";
import { dailyCaps, reindexCooldownElapsed, reserveAiBudget, withinBudget } from "./ai-budget";

function stubClient(result: { data: boolean | null; error: { message: string } | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    }
  };
  return { client, calls };
}

test("reserveAiBudget denies with the daily limit message when the rpc returns false", async () => {
  const { client } = stubClient({ data: false, error: null });
  const result = await reserveAiBudget(client, "owner-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /limit is reached/i);
  if (!result.ok) assert.match(result.error, /today/i);
});

test("reserveAiBudget fails closed with a could-not-check message on rpc error", async () => {
  const { client } = stubClient({ data: null, error: { message: "x" } });
  const result = await reserveAiBudget(client, "owner-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /could not check/i);
});

test("reserveAiBudget allows the call when the rpc returns true and sends the expected args", async () => {
  const { client, calls } = stubClient({ data: true, error: null });
  const result = await reserveAiBudget(client, "owner-1");
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  const caps = dailyCaps();
  assert.equal(calls[0].fn, "consume_ai_budget");
  assert.deepEqual(calls[0].args, {
    p_owner_id: "owner-1",
    p_calls: 1,
    p_tokens: 2000,
    p_max_calls: caps.calls,
    p_max_tokens: caps.tokens
  });
});

test("a budget denies the call that would pass the cap", () => {
  assert.equal(withinBudget({ calls: 200, tokens: 10 }, { calls: 200, tokens: 100 }), true);
  assert.equal(withinBudget({ calls: 201, tokens: 10 }, { calls: 200, tokens: 100 }), false);
  assert.equal(withinBudget({ calls: 1, tokens: 101 }, { calls: 200, tokens: 100 }), false);
});

test("a second reindex inside the cooldown does not start", () => {
  const now = 1_000_000;
  assert.equal(reindexCooldownElapsed(now - 60_000, now, 15 * 60 * 1000), false);
  assert.equal(reindexCooldownElapsed(now - 15 * 60 * 1000, now, 15 * 60 * 1000), true);
  assert.equal(reindexCooldownElapsed(now, now, 0), true);
});
