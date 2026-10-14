import { guardAiRequest } from "@/lib/ai-admission";
import { explainTopic, toCitations, citationsUsedIn, type ExplainLevel, type RetrievedChunk } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { retrieveForRoom, MIN_SIMILARITY } from "@/lib/retrieval";
import { selectFreshChunks } from "@/lib/source-freshness";
import { passagesForLesson, planContextualSearch } from "@/lib/contextual-retrieval";
import { readExplainLevel } from "@/lib/explain-level";
import {
  buildLearnSuccess,
  classifyLearnOutcome,
  learnOutcomeMessage,
  learnOutcomeStatus,
  type LearnDocumentStatus,
  type LearnOutcome
} from "@/lib/learn-outcome";
import { writeStudyTrace } from "@/lib/study-trace";
import { composeUnitOverview, compactExcerpt } from "@/lib/unit-overview";
import { coverageLimitation, type PageCoverageEntry } from "@studigo/documents";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Learn mode: teach one topic from this room's own materials, with citations. */
async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const started = Date.now();
  let documentStatuses: LearnDocumentStatus[] = [];
  let evidenceDocumentIds: string[] = [];
  let evidenceChunkCount = 0;
  let selectedTopicId: string | null = null;
  let retrievedChunkIds: string[] = [];
  const outcomeFor = (failure?: "invalid_topic_scope" | "retrieval_error" | "generation_error") =>
    classifyLearnOutcome({ documentStatuses, evidenceDocumentIds, evidenceChunkCount, failure });
  const trace = (outcome: LearnOutcome) => writeStudyTrace({
    route: "api/learn",
    ownerId: user.id,
    chunkIds: retrievedChunkIds,
    cutoff: MIN_SIMILARITY,
    tokenEstimate: 0,
    latencyMs: Date.now() - started,
    outcome: outcome.kind,
    readyDocumentCount: outcome.counts.readyMaterials,
    processingDocumentCount: outcome.counts.processingMaterials,
    evidenceChunkCount: outcome.counts.relevantChunks,
    coverageTopicIds: selectedTopicId && outcome.coverageIds.length ? [selectedTopicId] : []
  });
  let coverageNote: string | null = null;
  const withNote = <T extends Record<string, unknown>>(payload: T) =>
    coverageNote ? { ...payload, coverageLimitation: coverageNote } : payload;
  const fail = (outcome: LearnOutcome) => {
    trace(outcome);
    return Response.json(withNote({
      ...(selectedTopicId ? { topicId: selectedTopicId } : {}),
      error: learnOutcomeMessage(outcome.kind),
      outcome
    }), { status: learnOutcomeStatus(outcome.kind) });
  };

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string }
    | null;
  const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
  const topicId = typeof body?.topicId === "string" ? body.topicId.trim() : "";

  if (!roomId || !topicId) {
    const outcome = outcomeFor("invalid_topic_scope");
    trace(outcome);
    return Response.json({ error: "roomId and topicId are required", outcome }, { status: 400 });
  }

  const { data: room, error: roomError } = await supabase
    .from("study_rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) return fail(outcomeFor("retrieval_error"));
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, title, objective, key_terms").eq("active", true)
    .eq("id", topicId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (topicError) return fail(outcomeFor("retrieval_error"));
  if (!topic) return fail(outcomeFor("invalid_topic_scope"));
  selectedTopicId = topicId;

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, status, page_coverage, active_revision")
    .eq("room_id", roomId);
  if (documentsError) return fail(outcomeFor("retrieval_error"));
  documentStatuses = (documents ?? []) as LearnDocumentStatus[];
  coverageNote = ((documents ?? []) as Array<{ page_coverage?: PageCoverageEntry[] | null }>)
    .map((document) => coverageLimitation(Array.isArray(document.page_coverage) ? document.page_coverage : []))
    .filter((text): text is string => Boolean(text))
    .join(" ") || null;

  const materials = outcomeFor();
  if (materials.kind === "materials_processing" || materials.kind === "no_ready_materials") {
    return fail(materials);
  }

  const search = planContextualSearch({
    topics: [{
      id: topic.id as string,
      title: topic.title as string,
      objective: (topic.objective as string | null) ?? null,
      keyTerms: (topic.key_terms as string[] | null) ?? []
    }],
    question: `Explain ${topic.title as string}`
  });
  const query = search.kind === "search" ? search.query : `${topic.title as string}. ${topic.objective ?? ""}`;

  let chunks: RetrievedChunk[];
  let level: ExplainLevel;
  try {
    level = await readExplainLevel(supabase, roomId);
    chunks = await retrieveForRoom({
      supabase, roomId, query, matchCount: 10, ownerId: user.id, traceRoute: "api/learn/retrieval"
    });
  } catch {
    return fail(outcomeFor("retrieval_error"));
  }
  chunks = selectFreshChunks(
    ((documents ?? []) as Array<{ id: string; active_revision?: number | null }>).map((document) => ({
      id: document.id,
      revision: typeof document.active_revision === "number" ? document.active_revision : null
    })),
    chunks
  );
  if (search.kind === "search" && search.topic) {
    chunks = [...new Map(passagesForLesson({
      topic: search.topic,
      substantive: search.substantive,
      chunks
    }).map((passage) => [passage.chunk.id, passage.chunk])).values()];
  }
  retrievedChunkIds = chunks.map((chunk) => chunk.id);
  evidenceDocumentIds = chunks.map((chunk) => chunk.documentId);
  evidenceChunkCount = chunks.length;
  const evidence = outcomeFor();
  if (evidence.kind === "no_relevant_evidence") return fail(evidence);

  let explanation;
  try {
    explanation = await explainTopic({
      topicTitle: topic.title as string,
      objective: (topic.objective as string | null) ?? null,
      chunks,
      level
    });
  } catch {
    return fail(outcomeFor("generation_error"));
  }

  const citations = citationsUsedIn(explanation, toCitations(chunks));
  if (!explanation.trim() || !citations.length) return fail(outcomeFor("generation_error"));

  // Only the two success kinds can carry a cited lesson.
  if (evidence.kind !== "ready" && evidence.kind !== "partial_coverage") {
    return fail(outcomeFor("generation_error"));
  }
  trace(evidence);

  return Response.json(withNote(buildLearnSuccess({
    topicId,
    level,
    explanation,
    citations,
    outcome: evidence as LearnOutcome & { kind: "ready" | "partial_coverage" }
  })));
}

async function overviewPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;
  const body = await request.json().catch(() => null) as { roomId?: string; topicIds?: string[] } | null;
  const roomId = body?.roomId?.trim() ?? "";
  const requestedIds = [...new Set((body?.topicIds ?? []).filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });
  const room = await supabase.from("study_rooms").select("id").eq("id", roomId).maybeSingle();
  if (room.error) return Response.json({ error: "Could not load the Study Room." }, { status: 503 });
  if (!room.data) return Response.json({ error: "Study Room not found" }, { status: 404 });
  const topics = await supabase.from("topics").select("id, title").eq("room_id", roomId).eq("active", true);
  if (topics.error) return Response.json({ error: "Could not load topics." }, { status: 503 });
  const roomTopics = (topics.data ?? []) as Array<{ id: string; title: string }>;
  const gate = composeUnitOverview({
    requestedIds,
    roomTopics,
    retrieve: () => ({ text: "pending", citation: "pending" })
  });
  if (!gate.ok) return Response.json({ error: gate.error, providerCalls: 0 }, { status: 400 });
  const sections = [];
  for (const id of requestedIds) {
    const topic = roomTopics.find((item) => item.id === id)!;
    let found: { text: string; citation: string } | null = null;
    try {
      const chunks = await retrieveForRoom({
        supabase, roomId, query: topic.title, matchCount: 3, ownerId: user.id, traceRoute: "api/learn/overview"
      });
      const first = chunks[0];
      found = first?.content ? { text: compactExcerpt(first.content), citation: `${first.documentName}, p. ${first.pageNumber ?? "source"}` } : null;
    } catch {
      found = null;
    }
    sections.push(found
      ? { topicId: id, title: topic.title, status: "supported" as const, text: found.text, citation: found.citation }
      : { topicId: id, title: topic.title, status: "gap" as const, text: `${topic.title} needs a source in this room.`, citation: null });
  }
  return Response.json({ overview: true, providerCalls: 0, sections });
}

export async function POST(request: Request) {
  const peeked = await request.clone().json().catch(() => null) as { overview?: boolean; topicIds?: string[] } | null;
  if (peeked?.overview === true && (peeked.topicIds?.length ?? 0) !== 1) return overviewPost(request);
  return guardAiRequest(request, "learn", guardedPost);
}



