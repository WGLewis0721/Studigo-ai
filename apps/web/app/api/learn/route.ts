import { guardAiRequest } from "@/lib/ai-admission";
import { explainTopic, toCitations, citationsUsedIn, type ExplainLevel, type RetrievedChunk } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { retrieveForRoom, MIN_SIMILARITY } from "@/lib/retrieval";
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
    .select("id, status, page_coverage")
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

export async function POST(request: Request) {
  return guardAiRequest(request, "learn", guardedPost);
}
