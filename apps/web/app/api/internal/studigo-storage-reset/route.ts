export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HASH = "2c9ee0cc7a2dc4145fb76b4f23dc07f7e355e0cdba03f7025d199e7ca96738a2";
const functionUrl = "https://blltmplsbabnklmnhmwv.supabase.co/functions/v1/studigo-reset-storage-once";

async function isAllowed(input: string): Promise<boolean> {
  if (!input || input.length < 45 || input.length > 200) return false;
  const data = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
  const hashed = Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let d = 0;
  for (let i = 0; i < HASH.length; i++) d |= HASH.charCodeAt(i) ^ hashed.charCodeAt(i);
  return hashed.length === HASH.length && d === 0;
}
export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "maintenance/one-time-storage-reset-bridge") {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const nonce = url.searchParams.get("nonce") || "";
  const action = url.searchParams.get("action");
  if (!(await isAllowed(nonce)) || !["preview", "delete"].includes(action ?? "")) {
    return new Response("Not found", { status: 404 });
  }
  const target = new URL(functionUrl);
  target.searchParams.set("action", action!);
  target.searchParams.set("nonce", nonce);
  // Fetch server-to-server; do not expose the nonce in a redirect URL.
  // This temporary preview route is removed after the one-time reset.
  const upstream = await fetch(target, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(20000) });
  const result = await upstream.text();
  return new Response(result, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}