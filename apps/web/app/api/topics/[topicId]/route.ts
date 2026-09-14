import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * The learner's corrections to the generated topic map. Studigo extracted the
 * scope from the teacher's guide; the learner is the one who knows when it read
 * something wrong, so their wording wins and survives re-ingestion.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { topicId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { title?: string; objective?: string | null; priority?: number }
    | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return Response.json({ error: "A topic needs a title." }, { status: 400 });

  // RLS confirms ownership before the trusted writer touches the row.
  const { data: owned } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .maybeSingle();
  if (!owned) return Response.json({ error: "Topic not found." }, { status: 404 });

  const { data, error } = await createServiceSupabaseClient().rpc("update_topic", {
    p_topic_id: owned.id,
    p_owner_id: user.id,
    p_title: title,
    p_objective: typeof body?.objective === "string" ? body.objective : null,
    p_priority: typeof body?.priority === "number" ? Math.round(body.priority) : null
  });

  if (error) {
    return Response.json({ error: error.message || "That change could not be saved." }, { status: 400 });
  }
  return Response.json({ topic: data });
}

/** Takes a topic out of the study scope without discarding its practice history. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const { topicId } = await params;
  const { data: owned } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .maybeSingle();
  if (!owned) return Response.json({ error: "Topic not found." }, { status: 404 });

  const { error } = await createServiceSupabaseClient().rpc("set_topic_active", {
    p_topic_id: owned.id,
    p_owner_id: user.id,
    p_active: false
  });

  if (error) {
    return Response.json({ error: "That topic could not be removed." }, { status: 400 });
  }
  return Response.json({ removed: owned.id });
}
