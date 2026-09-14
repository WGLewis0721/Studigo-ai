import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Lets the learner fix a generated card. The review schedule is deliberately
 * preserved: correcting a typo should not cost the recall history behind it.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { cardId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { front?: string; back?: string }
    | null;

  const front = typeof body?.front === "string" ? body.front.trim() : "";
  const back = typeof body?.back === "string" ? body.back.trim() : "";
  if (!front || !back) {
    return Response.json({ error: "A card needs both a front and a back." }, { status: 400 });
  }

  const { data: owned } = await supabase
    .from("flashcards")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (!owned) return Response.json({ error: "Card not found." }, { status: 404 });

  const { data, error } = await createServiceSupabaseClient().rpc("update_flashcard", {
    p_card_id: owned.id,
    p_owner_id: user.id,
    p_front: front,
    p_back: back
  });

  if (error) {
    return Response.json({ error: error.message || "That card could not be saved." }, { status: 400 });
  }
  return Response.json({ card: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { cardId } = await params;
  const { data: owned } = await supabase
    .from("flashcards")
    .select("id")
    .eq("id", cardId)
    .maybeSingle();
  if (!owned) return Response.json({ error: "Card not found." }, { status: 404 });

  const { error } = await createServiceSupabaseClient().rpc("delete_flashcard", {
    p_card_id: owned.id,
    p_owner_id: user.id
  });

  if (error) {
    return Response.json({ error: "That card could not be deleted." }, { status: 400 });
  }
  return Response.json({ deleted: owned.id });
}
