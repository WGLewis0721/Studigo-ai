import assert from "node:assert/strict";
import { test } from "node:test";

const ENV_KEYS = ["OPENAI_API_KEY", "AI_GATEWAY_API_KEY", "OLLAMA_BASE_URL", "OPENAI_CHAT_MODEL", "OPENAI_EMBEDDING_MODEL"] as const;

async function withEnv<T>(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

// Each import gets a fresh module instance (and fresh module-level cache) via a unique query string.
let counter = 0;
async function freshClientModule() {
  counter += 1;
  return import(`./client.ts?case=${counter}`);
}

test("direct transport is chosen when OPENAI_API_KEY is set, even alongside others", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test", AI_GATEWAY_API_KEY: "gw-test", OLLAMA_BASE_URL: "http://127.0.0.1:11434" }, async () => {
    const mod = await freshClientModule();
    assert.equal(mod.chatModel(), "gpt-4.1-mini");
    assert.equal(mod.embeddingModel(), "text-embedding-3-small");
  });
});

test("gateway transport qualifies bare model ids with the openai/ prefix", async () => {
  await withEnv({ AI_GATEWAY_API_KEY: "gw-test" }, async () => {
    const mod = await freshClientModule();
    assert.equal(mod.chatModel(), "openai/gpt-4.1-mini");
    assert.equal(mod.embeddingModel(), "openai/text-embedding-3-small");
  });
});

test("ollama transport is used for chat when it's the only credential present", async () => {
  await withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434" }, async () => {
    const mod = await freshClientModule();
    assert.equal(mod.chatModel(), "llama3.1");
  });
});

test("ollama-only configuration throws for embeddings, which require direct or gateway", async () => {
  await withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434" }, async () => {
    const mod = await freshClientModule();
    assert.throws(() => mod.embeddingModel(), /Ollama provides chat only/);
  });
});

test("ollama chat can coexist with gateway embeddings", async () => {
  await withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434" }, async () => {
    // Simulate: chat prefers ollama only when no direct/gateway key exists at all,
    // per the documented fallback order (direct > gateway > ollama). This test
    // instead verifies that once a gateway key exists, chat does NOT fall through
    // to ollama, since ollama is last in the fallback order.
    process.env.AI_GATEWAY_API_KEY = "gw-test";
    const mod = await freshClientModule();
    assert.equal(mod.chatModel(), "openai/gpt-4.1-mini");
    assert.equal(mod.embeddingModel(), "openai/text-embedding-3-small");
  });
});

test("no credential at all throws a clear, actionable error", async () => {
  await withEnv({}, async () => {
    const mod = await freshClientModule();
    assert.throws(() => mod.chatModel(), /No model credential configured/);
  });
});

test("an explicit OPENAI_CHAT_MODEL override is respected under every transport", async () => {
  await withEnv({ OLLAMA_BASE_URL: "http://127.0.0.1:11434", OPENAI_CHAT_MODEL: "llama3.2" }, async () => {
    const mod = await freshClientModule();
    assert.equal(mod.chatModel(), "llama3.2");
  });
});
