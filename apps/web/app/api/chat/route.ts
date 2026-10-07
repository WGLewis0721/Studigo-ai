import { compileCoachPreferences, directivesForTurn } from "@/lib/coach-preferences";
import { readCoachPreferences, readLearnPreferences } from "@/lib/coach-preferences-store";
import { InteractionConflictError, isInteractionId, persistUserInteraction, recoverCoachConversation } from "@/lib/coach-interaction";
import type { CoachInteraction } from "@/lib/coach-learning-events";
import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { assertRoomAccess } from "@/lib/retrieval";
import { runStudigoEngine } from "@/lib/engine";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequest = {
  roomId?: string;
  question?: string;
  conversationId?: string | null;
  /** "coach" routes the turn through the Coach state machine instead of
   *  free-form grounded Q&A. Defaults to "ask". */
  mode?: "ask" | "coach";
  /** Client-generated UUID, once per submitted turn. Becomes the user
   *  message's ID and the stable identity of any learning evidence. */
  interactionId?: string;
  /** Optional learner-selected study scope. Server intersects with active room topics. */
  topicIds?: string[];
};

/**
 * Ask Studigo: retrieve inside this room only, answer from what came back, and
 * stream the answer followed by the citations the answer actually used.
 */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const roomId = typeof body?.roomId==='string'?body.roomId.trim():'';
  const question = typeof body?.question==='string'?body.question.trim():'';
  const mode = body?.mode === "coach" ? "coach" : "ask";
  const topicIds = Array.isArray(body?.topicIds)
    ? [...new Set(body.topicIds.filter((value): value is string => typeof value === "string"))]
    : [];
  if (topicIds.length > 80 || topicIds.some((value) => !isInteractionId(value))) {
    return Response.json({ error: "Choose valid Study Room topics." }, { status: 400 });
  }

  if (!roomId || !question) {
    return Response.json({ error: "roomId and question are required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "That question is too long." }, { status: 400 });
  }
  if(body?.conversationId!=null&&!isInteractionId(body.conversationId))return Response.json({error:'Invalid conversationId.'},{status:400});
  if(mode==='coach'&&!isInteractionId(body?.interactionId))return Response.json({error:'A valid interactionId is required for Coach turns.'},{status:400});

  const room = await assertRoomAccess(supabase, roomId);
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
    return Response.json({ error: "Could not load your Study Room settings. Please retry." }, { status: 503 });
  }

  let conversationId = body?.conversationId ?? null;
  if(mode==='coach'&&!conversationId) {
    try {conversationId=await recoverCoachConversation({supabase,interactionId:body!.interactionId!,roomId,content:question});}
    catch(error) {return Response.json({error:'Could not recover your Coach submission.'},{status:error instanceof InteractionConflictError?409:503});}
  }
  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("room_id", roomId)
      .maybeSingle();
    conversationId = existing?.id ?? null;
  }

  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ room_id: roomId, owner_id: user.id, title: question.slice(0, 120) })
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
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId });

      try {
        for await (const event of runStudigoEngine({ supabase, serviceSupabase: service, roomId, question, history, directives, mode, route, userId: user.id, interaction, conversationId, selectedTopicIds: topicIds })) {
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

          send({
            type: "done",
            text: event.answer.text,
            citations: event.answer.citations,
            grounded: event.answer.grounded
          });
        }
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Studigo could not finish that answer."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
