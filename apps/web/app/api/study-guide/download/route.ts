import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess } from "@/lib/retrieval";
import { buildEditionPdf, guideDownloadDecision } from "@/lib/study-guide-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

function filename(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "Studigo";
  return `${slug}-Study-Guide.pdf`;
}

export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId")?.trim();
  const page = url.searchParams.get("page") === "a4" ? "a4" : "letter";
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  const roomResult = room
    ? await supabase.from("study_rooms").select("title, subject, course_name, test_date").eq("id", roomId).maybeSingle()
    : { data: null, error: null };
  const editionResult = room
    ? await supabase.from("guide_editions").select("content").eq("room_id", roomId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null, error: null };
  const decision = guideDownloadDecision({ room, edition: editionResult.data?.content ?? null });
  if (!decision.pdf) {
    const error = decision.code === "room_not_found"
      ? "Study Room not found"
      : "No validated guide edition is ready to download.";
    return Response.json({ error, code: decision.code }, { status: decision.status });
  }

  if (roomResult.error || !roomResult.data) {
    return Response.json({ error: "Could not load this Study Room.", code: "no_valid_edition" }, { status: 409 });
  }

  const pdf = await buildEditionPdf(decision.edition, {
    title: roomResult.data.title,
    subject: roomResult.data.subject,
    courseName: roomResult.data.course_name,
    testDate: roomResult.data.test_date,
    page
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(roomResult.data.title)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
