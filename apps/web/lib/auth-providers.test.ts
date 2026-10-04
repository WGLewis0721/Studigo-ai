import assert from "node:assert/strict";
import test from "node:test";
import { googleSignInEnabled } from "./auth-providers";

const realFetch = globalThis.fetch;
const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };

function setup(respond: () => Promise<Response>) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "publishable";
  globalThis.fetch = (async () => respond()) as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
  if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
  if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("Google button shows only when Supabase reports Google enabled", async () => {
  setup(async () => json({ external: { google: true, email: true } }));
  assert.equal(await googleSignInEnabled(), true);
});

test("Google button is hidden while the provider is switched off", async () => {
  setup(async () => json({ external: { google: false, email: true } }));
  assert.equal(await googleSignInEnabled(), false);
});

test("Google button is hidden when the settings call fails or is malformed", async () => {
  setup(async () => json({ msg: "nope" }, 500));
  assert.equal(await googleSignInEnabled(), false);
  setup(async () => { throw new Error("network down"); });
  assert.equal(await googleSignInEnabled(), false);
  setup(async () => json({}));
  assert.equal(await googleSignInEnabled(), false);
});

test("Google button is hidden when Supabase is not configured", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(await googleSignInEnabled(), false);
});
