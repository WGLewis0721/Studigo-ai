import { requireApiUser } from "@/lib/auth";
import { loadReadingGuideEdition } from "@/lib/guide-reading";
import { assertRoomAccess } from "@/lib/retrieval";
import { currentBlockKeySet, filterGuideEditionExport, revisionStamp } from "@/lib/source-freshness";
import { buildEditionDocx, DOCX_MIME, guideFileFormat } from "@/lib/study-guide-docx";
import { buildEditionPdf, guideDownloadDecision } from "@/lib/study-guide-pdf";
import type { StudyGuideContent } from "@studigo/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

function filename(title: string, extension: "pdf" | "docx"): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "Studigo";
  return `${slug}-Study-Guide.${extension}`;
}

export async function GET(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId")?.trim();
  const format = guideFileFormat(url.searchParams.get("format"));
  const page = url.searchParams.get("page") === "a4" ? "a4" : "letter";
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });
  if (!format) return Response.json({ error: "format must be pdf or docx.", code: "bad_format" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  const roomResult = room
    ? await supabase.from("study_rooms").select("title, subject, course_name, test_date").eq("id", roomId).maybeSingle()
    : { data: null, error: null };
  const loaded = room ? await loadReadingGuideEdition(supabase, roomId) : { content: null, updateAvailable: false };
  if ("error" in loaded) return Response.json({ error: "Could not load this Study Room.", code: "no_valid_edition" }, { status: 409 });
  let edition: unknown = loaded.content;
  if (room && edition) {
    const [{ data: blocks, error: blockError }, { data: documents, error: documentError }] = await Promise.all([
      supabase.from("source_blocks").select("block_key, document_id, revision").eq("room_id", roomId),
      supabase.from("documents").select("id, active_revision").eq("room_id", roomId)
    ]);
    if (blockError || documentError) {
      return Response.json({ error: "Could not verify guide sources.", code: "source_unavailable" }, { status: 409 });
    }
    const currentKeys = currentBlockKeySet(
      (documents ?? []).map((document) => ({ id: String(document.id), revision: revisionStamp(document.active_revision) })),
      (blocks ?? []).map((block) => ({
        documentId: String(block.document_id),
        revision: revisionStamp(block.revision) ?? -1,
        blockKey: String(block.block_key)
      }))
    );
    edition = filterGuideEditionExport(edition as StudyGuideContent, currentKeys);
  }
  const decision = guideDownloadDecision({ room, edition });
  if (!decision.pdf) {
    const error = decision.code === "room_not_found"
      ? "Study Room not found"
      : "No validated guide edition is ready to download.";
    return Response.json({ error, code: decision.code }, { status: decision.status });
  }

  if (roomResult.error || !roomResult.data) {
    return Response.json({ error: "Could not load this Study Room.", code: "no_valid_edition" }, { status: 409 });
  }

  const file = format === "docx"
    ? await buildEditionDocx(decision.edition, {
      title: roomResult.data.title,
      subject: roomResult.data.subject,
      courseName: roomResult.data.course_name,
      testDate: roomResult.data.test_date
    })
    : await buildEditionPdf(decision.edition, {
      title: roomResult.data.title,
      subject: roomResult.data.subject,
      courseName: roomResult.data.course_name,
      testDate: roomResult.data.test_date,
      page
    });

  return new Response(Buffer.from(file), {
    headers: {
      "Content-Type": format === "docx" ? DOCX_MIME : "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(roomResult.data.title, format)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
