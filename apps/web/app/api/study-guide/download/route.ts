import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess } from "@/lib/retrieval";
import { buildStudyGuidePdf, type StudyGuideTopic } from "@/lib/study-guide-pdf";

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

function termsForTopic(topic: TopicRow): string[] {
  return [
    topic.title,
    topic.objective ?? "",
    ...(topic.key_terms ?? [])
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 4);
}

function chunkScore(topic: TopicRow, chunk: ChunkRow): number {
  const content = chunk.content.toLowerCase();
  const terms = termsForTopic(topic);
  let score = 0;
  for (const term of new Set(terms)) {
    if (content.includes(term)) score += (topic.key_terms ?? []).some((key) => key.toLowerCase().includes(term)) ? 3 : 1;
  }
  if ((topic.source_document_ids ?? []).includes(chunk.document_id)) score += 3;
  return score;
}

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

  const [roomResult, topicResult, documentResult, chunkResult] = await Promise.all([
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
      .eq("status", "ready"),
    supabase
      .from("document_chunks")
      .select("document_id, page_number, chunk_index, content")
      .eq("room_id", roomId)
      .order("chunk_index", { ascending: true })
      .limit(1200)
  ]);

  if (roomResult.error || !roomResult.data) {
    return Response.json({ error: "Could not load this Study Room." }, { status: 500 });
  }
  if (topicResult.error || documentResult.error || chunkResult.error) {
    return Response.json({ error: "Could not assemble the study guide from this room." }, { status: 500 });
  }

  const topics = (topicResult.data ?? []) as TopicRow[];
  const documents = (documentResult.data ?? []) as DocumentRow[];
  const chunks = (chunkResult.data ?? []) as ChunkRow[];

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
    const ranked = chunks
      .filter((chunk) => {
        const linked = topic.source_document_ids ?? [];
        return linked.length === 0 || linked.includes(chunk.document_id);
      })
      .map((chunk) => ({ chunk, score: chunkScore(topic, chunk) }))
      .sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index);

    const useful = ranked.filter((item) => item.score > 0).slice(0, 2);
    const fallback = useful.length ? useful : ranked.slice(0, 1);

    return {
      title: topic.title,
      objective: topic.objective,
      keyTerms: topic.key_terms ?? [],
      sourceNotes: fallback.map(({ chunk }) => {
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

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename(roomResult.data.title)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
