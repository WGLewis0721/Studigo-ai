import { requireApiUser } from "@/lib/auth";
import { buildTopicMap } from "@/lib/ingest";
import { assertRoomAccess } from "@/lib/retrieval";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Rebuilds the topic map for a room. Ingestion does this automatically when a
 * study guide lands; this is the manual "rebuild" path, and the fallback for a
 * room whose only materials are notes and textbook pages.
 */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; intent?: string; title?: string; objective?: string | null; priority?: number }
    | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  // A learner adding a topic the guide missed, rather than a full rebuild.
  if (body?.intent === "create") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return Response.json({ error: "Give the topic a title." }, { status: 400 });

    const { data, error } = await createServiceSupabaseClient().rpc("create_topic", {
      p_room_id: roomId,
      p_owner_id: user.id,
      p_title: title,
      p_objective: typeof body.objective === "string" ? body.objective : null,
      p_priority: typeof body.priority === "number" ? Math.round(body.priority) : null
    });

    if (error) {
      return Response.json({ error: error.message || "That topic could not be added." }, { status: 400 });
    }
    return Response.json({ topic: data }, { status: 201 });
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, source_type, status")
    .eq("room_id", roomId)
    .eq("status", "ready")
    .order("source_priority", { ascending: false }).order("created_at", { ascending: false });

  const ready = (documents ?? []) as Array<{ id: string; name: string; source_type: string }>;
  if (!ready.length) {
    return Response.json(
      { error: "Add a document and let it finish processing first." },
      { status: 400 }
    );
  }

  // The teacher's own material defines the test; fall back to everything else
  // only when there is no teacher material in the room.
  const teacherDocuments = ready.filter((document) =>
    ["study_guide", "teacher_material", "worksheet"].includes(document.source_type)
  );
  const latestGuide = ready.find((document) => document.source_type === "study_guide");
  const sources = latestGuide ? [latestGuide] : teacherDocuments.length ? teacherDocuments : ready.slice(0, 3);

  const service = createServiceSupabaseClient();
  let created = 0;

  for (const document of sources) {
    const { data: chunks } = await service
      .from("document_chunks")
      .select("content, page_number")
      .eq("document_id", document.id)
      .eq("owner_id", user.id)
      .order("chunk_index", { ascending: true })
      .limit(4001);

    const pages = ((chunks ?? []) as Array<{ content: string; page_number: number | null }>).map(
      (chunk, index) => ({
        pageNumber: chunk.page_number ?? index + 1,
        text: chunk.content
      })
    );
    if (!pages.length) continue;

    created += await buildTopicMap({
      roomId,
      ownerId: user.id,
      documentId: document.id,
      documentName: document.name,
      isTeacherStudyGuide: document.source_type === "study_guide",
      pages
    });
  }

  return Response.json({ topicsCreated: created });
}
