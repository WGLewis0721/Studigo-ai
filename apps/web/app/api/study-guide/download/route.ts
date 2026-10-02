import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess } from "@/lib/retrieval";
import { buildStudyGuidePdf, type StudyGuideTopic } from "@/lib/study-guide-pdf";
import { selectGuideSources } from "@/lib/study-guide-sources";

export const runtime = "nodejs";
export const maxDuration = 60;

type TopicRow = {
  id: string;
  title: string;
  objective: string | null;
  key_terms: string[] | null;
  source_document_ids: string[] | null;
  order_index: number;
};

type DocumentRow = {
  id: string;
  name: string;
  page_label: string | null;
};

type ChunkRow = {
  document_id: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
};

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

  const roomId = new URL(request.url).searchParams.get("roomId")?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const [roomResult, topicResult, documentResult] = await Promise.all([
    supabase
      .from("study_rooms")
      .select("title, subject, course_name, test_date")
      .eq("id", roomId)
      .maybeSingle(),
    supabase
      .from("topics")
      .select("id, title, objective, key_terms, source_document_ids, order_index")
      .eq("room_id", roomId)
      .eq("active", true)
      .order("order_index", { ascending: true }),
    supabase
      .from("documents")
      .select("id, name, page_label")
      .eq("room_id", roomId)
      .eq("status", "ready")
  ]);

  if (roomResult.error || !roomResult.data) {
    return Response.json({ error: "Could not load this Study Room." }, { status: 500 });
  }
  if (topicResult.error || documentResult.error) {
    return Response.json({ error: "Could not assemble the study guide from this room." }, { status: 500 });
  }

  const topics = (topicResult.data ?? []) as TopicRow[];
  const documents = (documentResult.data ?? []) as DocumentRow[];
  const readyIds = new Set(documents.map(d => d.id));
  const chunks: ChunkRow[] = [];
  // Bounded, paginated reads. Explicitly refuse an incomplete export.
  if (documents.length) for (let offset = 0; offset <= 10000; offset += 500) {
    const page = await supabase.from("document_chunks")
      .select("document_id, page_number, chunk_index, content")
      .eq("room_id", roomId).in("document_id", [...readyIds])
      .order("document_id", { ascending: true }).order("chunk_index", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 499);
    if (page.error) return Response.json({ error: "Could not read source material." }, { status: 503 });
    chunks.push(...(page.data ?? []) as ChunkRow[]);
    if (chunks.length > 10000) return Response.json({ error: "This room is too large for a complete PDF export. Narrow its source scope." }, { status: 413 });
    if ((page.data?.length ?? 0) < 500) break;
  }

  if (!topics.length) {
    return Response.json(
      { error: "Build or upload a study guide first so Studigo has a topic map to download." },
      { status: 400 }
    );
  }
  if (!chunks.length) {
    return Response.json(
      { error: "There is not enough processed source material to build a grounded study guide yet." },
      { status: 400 }
    );
  }

  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const pdfTopics: StudyGuideTopic[] = topics.map((topic) => {
    const useful = selectGuideSources(topic, chunks, readyIds);

    return {
      title: topic.title,
      objective: topic.objective,
      keyTerms: topic.key_terms ?? [],
      sourceNotes: useful.map((chunk) => {
        const document = documentMap.get(chunk.document_id);
        return {
          text: chunk.content,
          documentName: document?.name ?? "Uploaded source",
          pageNumber: chunk.page_number,
          pageLabel: document?.page_label ?? "page"
        };
      })
    };
  });

  const testDate = roomResult.data.test_date
    ? new Date(`${roomResult.data.test_date}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    : null;

  const pdf = buildStudyGuidePdf({
    title: roomResult.data.title,
    subject: roomResult.data.subject,
    courseName: roomResult.data.course_name,
    testDate,
    topics: pdfTopics
  });

  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(roomResult.data.title)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
