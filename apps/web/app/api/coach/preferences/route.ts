import { requireApiUser } from "@/lib/auth";
import { validCoachPreferences } from "@/lib/coach-preferences";
import { applyCoachPreferences } from "@/lib/coach-preferences-store";

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null);
  if (typeof body?.roomId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.roomId) || !validCoachPreferences(body.preferences)) {
    return Response.json({ error: "Choose valid coaching settings." }, { status: 400 });
  }
  try {
    const preferences = await applyCoachPreferences(supabase, body.roomId, user.id, body.preferences);
    return Response.json({ preferences, status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply your settings.";
    return Response.json({ error: message }, { status: message === "Study Room not found." ? 404 : 503 });
  }
}
