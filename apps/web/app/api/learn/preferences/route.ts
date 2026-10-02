import { requireApiUser } from "@/lib/auth";
import { isExplainLevel } from "@studigo/learning";
import { applyLearnPreferences } from "@/lib/coach-preferences-store";

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null);
  if (
    typeof body?.roomId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.roomId) ||
    !isExplainLevel(body?.explainLevel)
  ) {
    return Response.json({ error: "Choose a valid Learn explanation level." }, { status: 400 });
  }
  try {
    const result = await applyLearnPreferences(
      supabase,
      body.roomId,
      user.id,
      body.explainLevel,
      body.applyToBoth === true
    );
    return Response.json({ ...result, status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply your Learn settings.";
    return Response.json({ error: message }, { status: message === "Study Room not found." ? 404 : 503 });
  }
}
