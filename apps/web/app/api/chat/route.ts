import { guardAiRequest } from "@/lib/ai-admission";
import { trackAiStreamProducer } from "@/lib/ai-stream-lease";
import { compileCoachPreferences, directivesForTurn } from "@/lib/coach-preferences";
import { readCoachPreferences, readLearnPreferences } from "@/lib/coach-preferences-store";
import { InteractionConflictError, isInteractionId, persistUserInteraction, recoverCoachConversation } from "@/lib/coach-interaction";
import type { CoachInteraction } from "@/lib/coach-learning-events";
import { requireApiUser } from "@/lib/auth";
import { reserveAiBudget } from "@/lib/ai-budget";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { MIN_SIMILARITY } from "@/lib/retrieval";
import { InvalidTopicScopeError, LearnStageError, runStudigoEngine } from "@/lib/engine";
import { classifyLearnOutcome, learnStreamDone, learnStreamError, type LearnOutcome } from "@/lib/learn-outcome";
import { isUuid } from "@/lib/ids";
import { surfaceForRequest, admitThread, type ConversationRow } from "@/lib/conversation-surface";
import { writeStudyTrace } from "@/lib/study-trace";
import { clampGauge } from "@/lib/accuracy-bar";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequest = {
  roomId?: string;
  question?: string;
  conversationId?: string | null;
  /** "coach" routes the turn through the Coach state machine instead of
   *  free-form grounded Q&A. Defaults to "ask". */
  mode?: "ask" | "coach";
  surface?: "learn" | "coach" | "ask";
  /** Client-generated UUID, once per submitted turn. Becomes the user
   *  message's ID and the stable identity of any learning evidence. */
  interactionId?: string;
  /** Optional learner-selected study scope. Server intersects with active room topics. */
  topicIds?: string[];
  /** 50 (cold) to 100 (hot). How much of the idea counts as an answer. */
  gauge?: number;
  accuracy?: "low" | "high";
  firstPass?: boolean;
};

/**
 * Ask Studigo: retrieve inside this room only, answer from what came back, and
 * stream the answer followed by the citations the answer actually used.
 */
async function guardedPost(request: Request) {
  const started = Date.now();
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const roomId = typeof body?.roomId==='string'?body.roomId.trim():'';
  const question = typeof body?.question==='string'?body.question.trim():'';
  const mode = body?.mode === "coach" ? "coach" : "ask";
  const learnFailure = (failure: "invalid_topic_scope" | "retrieval_error", status: number) => {
    const outcome = classifyLearnOutcome({ documentStatuses: [], failure });
    return Response.json({ error: learnStreamError(outcome).error, outcome }, { status });
  };
  const fromBody = typeof body?.gauge === "number" ? body.gauge : body?.accuracy === "high" ? 95 : body?.accuracy === "low" || body?.firstPass === true ? 50 : null;
  const gauge = fromBody == null ? undefined : clampGauge(fromBody);
  const topicIds = Array.isArray(body?.topicIds)
    ? [...new Set(body.topicIds.filter((value): value is string => typeof value === "string"))]
    : [];
  if (topicIds.length > 80 || topicIds.some((value) => !isInteractionId(value))) {
    return mode === "ask"
      ? learnFailure("invalid_topic_scope", 400)
      : Response.json({ error: "Choose valid Study Room topics." }, { status: 400 });
  }

  if (!isUuid(roomId) || !question) {
    return Response.json({ error: "roomId and question are required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "That question is too long." }, { status: 400 });
  }
  if(body?.conversationId!=null&&!isInteractionId(body.conversationId))return Response.json({error:'Invalid conversationId.'},{status:400});
  if(mode==='coach'&&!isInteractionId(body?.interactionId))return Response.json({error:'A valid interactionId is required for Coach turns.'},{status:400});

  const surface = surfaceForRequest({ mode, surface: body?.surface });
  if (!surface) return Response.json({ error: "Choose Learn, Coach, or Ask." }, { status: 400 });
  let existingConversation: ConversationRow | null = null;
  if (body?.conversationId) {
    const loaded = await supabase
      .from("conversations")
      .select("id, owner_id, room_id, surface, archived_at")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (loaded.error) return Response.json({ error: "Could not load that chat." }, { status: 503 });
    existingConversation = loaded.data as ConversationRow | null;
  }
  const admission = admitThread({
    conversationId: body?.conversationId ?? null,
    row: existingConversation,
    ownerId: user.id,
    roomId,
    surface
  });
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status });

  const budget = await reserveAiBudget(supabase, user.id);
  if (!budget.ok) return Response.json({ error: budget.error }, { status: 429 });

  const { data: room, error: roomError } = await supabase
    .from("study_rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) return mode === "ask"
    ? learnFailure("retrieval_error", 503)
    : Response.json({ error: "Could not load the Study Room. Please retry." }, { status: 503 });
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });
  // All conversation-state and message mutations are server-owned. The
  // user-scoped client above proves ownership; the service writer performs
  // the mutation so browsers do not need privileges on trusted state.
  const service = createServiceSupabaseClient();
  let teaching;
  let preferences;
  let learnPreferences;
  try {
    preferences = await readCoachPreferences(supabase, roomId);
    learnPreferences = mode === "ask" ? await readLearnPreferences(supabase, roomId) : undefined;
    teaching = compileCoachPreferences(preferences);
  } catch {
    return mode === "ask"
      ? learnFailure("retrieval_error", 503)
      : Response.json({ error: "Could not load your Study Room settings. Please retry." }, { status: 503 });
  }

  let conversationId = admission.reuse ? existingConversation?.id ?? null : null;
  if(mode==='coach'&&!conversationId) {
    try {conversationId=await recoverCoachConversation({supabase,interactionId:body!.interactionId!,roomId,content:question});}
    catch(error) {return Response.json({error:'Could not recover your Coach submission.'},{status:error instanceof InteractionConflictError?409:503});}
  }

  if (!conversationId) {
    const { data: created, error } = await service
      .from("conversations")
      .insert({ room_id: roomId, owner_id: user.id, title: question.slice(0, 120), surface })
      .select("id")
      .single();
    if (error) {
      return Response.json({ error: "Could not start a conversation" }, { status: 500 });
    }
    conversationId = created.id as string;
  }

  const { data: priorMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  const history = ((priorMessages ?? []) as Array<{ role: string; content: string }>)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));

  // Stored preferences are authoritative, including after a reload or tab change.
  // No browser-supplied directive text reaches the system prompt: the engine
  // builds the Ask topic scope from the validated topicIds.
  const directives = directivesForTurn(mode, preferences, [], learnPreferences);

  // Coach turns can produce learning evidence, so they require a stable
  // interaction ID: the persisted user message's own ID. Exact retries reuse
  // the row; conflicting reuse fails closed.
  let interaction: CoachInteraction | undefined;
  if (mode === "coach") {
    if (!isInteractionId(body?.interactionId)) {
      return Response.json({ error: "A valid interactionId is required for Coach turns." }, { status: 400 });
    }
    try {
      interaction = await persistUserInteraction({ supabase, writer: service, interactionId: body.interactionId, conversationId, content: question });
    } catch (error) {
      if (error instanceof InteractionConflictError) {
        return Response.json({ error: "That message ID was already used for a different message." }, { status: 409 });
      }
      return Response.json({ error: "Could not save your message. Please retry." }, { status: 503 });
    }
  } else {
    await service
      .from("messages")
      .insert({ conversation_id: conversationId, role: "user", content: question });
  }
  const route = mode === "coach" ? teaching.route : undefined;

  const encoder = new TextEncoder();
  let terminalOutcome: LearnOutcome | undefined;
  // Real request cancellation must not make the lease outlive its producer
  // without tracking it; provider requests receive the same abort signal.
  const abort = new AbortController();
  let cancelled = request.signal.aborted;
  if (cancelled) abort.abort();
  const onAbort = () => { cancelled = true; abort.abort(); };
  request.signal.addEventListener("abort", onAbort, { once: true });
  let finished!: () => void;
  const producerDone = new Promise<void>((resolve) => { finished = resolve; });
  const stream = new ReadableStream({
    cancel() { cancelled = true; abort.abort(); },

    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId });

      try {
        for await (const event of runStudigoEngine({ supabase, serviceSupabase: service, roomId, question, history, directives, mode, route, userId: user.id, interaction, conversationId, selectedTopicIds: topicIds, signal: abort.signal, gauge: mode === "coach" ? gauge : undefined })) {
          if (event.type === "delta") {
            send({ type: "delta", text: event.text });
            continue;
          }

          if(!('responseStored' in event && event.responseStored===true)) {
            const saved=await service.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: event.answer.text,
              citations: event.answer.citations
            });
            if(saved.error)throw new Error('Could not save the reply. Please retry.');
          }

          terminalOutcome = event.outcome;
          send(event.outcome
            ? learnStreamDone(event.answer, event.outcome)
            : {
                type: "done",
                text: event.answer.text,
                citations: event.answer.citations,
                grounded: event.answer.grounded
              });
        }
      } catch (error) {
        if (mode === "ask") {
          const failure = error instanceof InvalidTopicScopeError
            ? "invalid_topic_scope"
            : error instanceof LearnStageError ? error.stage : "generation_error";
          terminalOutcome = error instanceof LearnStageError && error.outcome
            ? error.outcome
            : classifyLearnOutcome({ documentStatuses: [], failure });
          send(learnStreamError(terminalOutcome));
        } else {
          send({ type: "error", error: "Studigo could not finish that coaching session. Please retry." });
        }
      } finally {
        writeStudyTrace({
          route: "api/chat",
          ownerId: user.id,
          chunkIds: [],
          cutoff: MIN_SIMILARITY,
          tokenEstimate: 0,
          latencyMs: Date.now() - started,
          outcome: terminalOutcome?.kind,
          readyDocumentCount: terminalOutcome?.counts.readyMaterials,
          processingDocumentCount: terminalOutcome?.counts.processingMaterials,
          evidenceChunkCount: terminalOutcome?.counts.relevantChunks,
          coverageTopicIds: []
        });
        request.signal.removeEventListener("abort", onAbort);
        if (!cancelled) controller.close();
        finished();
      }
    }
  });

  return trackAiStreamProducer(new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  }), producerDone);
}

export async function POST(request: Request) {
  return guardAiRequest(request, "chat", guardedPost);
}
