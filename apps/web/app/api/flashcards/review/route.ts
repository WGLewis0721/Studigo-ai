import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/** A single transaction commits schedule, attempt and mastery together. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null);
  if (typeof body?.cardId !== "string" || ![1, 2, 3].includes(body?.rating)
    || typeof body?.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return Response.json({ error: "A card, rating and review ID are required." }, { status: 400 });
  }
  const { data: owned } = await supabase.from("flashcards").select("id").eq("id", body.cardId).maybeSingle();
  if (!owned) return Response.json({ error: "Card not found" }, { status: 404 });
  const { data, error } = await createServiceSupabaseClient().rpc("review_flashcard", {
    p_card_id: owned.id, p_owner_id: user.id, p_rating: body.rating, p_request_id: body.requestId
  });
  if (error || !data) return Response.json({ error: "That review could not be saved. Retry or reload your deck." }, { status: 409 });
  return Response.json(data);
}
