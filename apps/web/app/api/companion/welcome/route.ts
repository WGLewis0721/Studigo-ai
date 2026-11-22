import { companionWelcomeReply, parseCompanionWelcomeTurns } from "@studigo/ai";
import { guardAiRequest } from "@/lib/ai-admission";
import { reserveAiBudget } from "@/lib/ai-budget";
import { requireApiUser } from "@/lib/auth";
import { studigoRiveEnabled } from "@/lib/studigo-preview";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!studigoRiveEnabled) return Response.json({ error: "Companion preview is unavailable." }, { status: 404 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json({ error: "Studigo chat is unavailable here." }, { status: 503 });
  }
  return guardAiRequest(request, "chat", async (admitted) => {
    const { supabase, user, unauthorized } = await requireApiUser();
    if (!user) return unauthorized;
    const body: { turns?: unknown } | null = await admitted.json().catch(() => null);
    const turns = parseCompanionWelcomeTurns(body?.turns);
    if (!turns) return Response.json({ error: "Send a short message to Studigo." }, { status: 400 });
    const budget = await reserveAiBudget(supabase, user.id);
    if (!budget.ok) return Response.json({ error: budget.error }, { status: 429 });
    try {
      const reply = await companionWelcomeReply(turns);
      return Response.json({ reply }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "Studigo couldn't reply right now. You can try again or start with homework help." }, { status: 503 });
    }
  });
}
