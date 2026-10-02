import { requireApiUser } from "@/lib/auth";
import { applyLearnPreferences } from "@/lib/coach-preferences-store";
import { validLearnPreferences } from "@/lib/learn-preferences";

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null);
  if (
    typeof body?.roomId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.roomId) ||
    !validLearnPreferences(body?.preferences)
  ) {
    return Response.json({ error: "Choose valid Learn settings." }, { status: 400 });
  }
  try {
    const preferences = await applyLearnPreferences(
      supabase,
      body.roomId,
      user.id,
      body.preferences
    );
    return Response.json({ preferences, status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply your Learn settings.";
    return Response.json({ error: message }, { status: message === "Study Room not found." ? 404 : 503 });
  }
}
