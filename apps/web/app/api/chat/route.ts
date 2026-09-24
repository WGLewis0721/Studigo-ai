import { LEARNING_ROUTES, type LearningRoute } from "@/lib/learning";
import { InteractionConflictError, isInteractionId, persistUserInteraction } from "@/lib/coach-interaction";
import type { CoachInteraction } from "@/lib/coach-learning-events";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess } from "@/lib/retrieval";
import { runStudigoEngine, type EngineDirective } from "@/lib/engine";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequest = {
  roomId?: string;
  question?: string;
  conversationId?: string | null;
  /** Pedagogy choices from the UI (coaching style, learning tradition,
   *  practice protocol). Kept separate from `question` so they only ever
   *  shape the system prompt and never the retrieval query. */
  directives?: EngineDirective[];
  /** "coach" routes the turn through the Coach state machine instead of
   *  free-form grounded Q&A. Defaults to "ask". */
  mode?: "ask" | "coach";
  /** Learning route id; anything unrecognized falls back to the default. */
  route?: string;
  /** Client-generated UUID, once per submitted turn. Becomes the user
   *  message's ID and the stable identity of any learning evidence. */
  interactionId?: string;
};

function sanitizeDirectives(input: unknown): EngineDirective[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const cleaned = input
    .filter((item): item is EngineDirective => Boolean(item) && typeof item === "object" && typeof (item as EngineDirective).name === "string" && typeof (item as EngineDirective).instruction === "string")
    .map((item) => ({ name: item.name.slice(0, 60), instruction: item.instruction.slice(0, 600) }))
    .slice(0, 8);
  return cleaned.length ? cleaned : undefined;
}

/**
 * Ask Studigo: retrieve inside this room only, answer from what came back, and
 * stream the answer followed by the citations the answer actually used.
 */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const roomId = body?.roomId?.trim();
  const question = body?.question?.trim();

  if (!roomId || !question) {
    return Response.json({ error: "roomId and question are required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "That question is too long." }, { status: 400 });
  }

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  let conversationId = body?.conversationId ?? null;
  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ room_id: roomId, owner_id: user.id, title: question.slice(0, 120) })
      .select("id")
      .single();
    if (error) {
      return Response.json({ error: "Could not start a conversation", detail: error.message }, { status: 500 });
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

  const directives = sanitizeDirectives(body?.directives);
  const mode = body?.mode === "coach" ? "coach" : "ask";

  // Coach turns can produce learning evidence, so they require a stable
  // interaction ID: the persisted user message's own ID. Exact retries reuse
  // the row; conflicting reuse fails closed.
  let interaction: CoachInteraction | undefined;
  if (mode === "coach") {
    if (!isInteractionId(body?.interactionId)) {
      return Response.json({ error: "A valid interactionId is required for Coach turns." }, { status: 400 });
    }
    try {
      interaction = await persistUserInteraction({ supabase, interactionId: body.interactionId, conversationId, content: question });
    } catch (error) {
      if (error instanceof InteractionConflictError) {
        return Response.json({ error: "That message ID was already used for a different message." }, { status: 409 });
      }
      return Response.json({ error: "Could not save your message. Please retry." }, { status: 503 });
    }
  } else {
    await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, role: "user", content: question });
  }
  const route = LEARNING_ROUTES.includes(body?.route as LearningRoute) ? (body?.route as LearningRoute) : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId });

      try {
        for await (const event of runStudigoEngine({ supabase, roomId, question, history, directives, mode, route, userId: user.id, interaction, conversationId })) {
          if (event.type === "delta") {
            send({ type: "delta", text: event.text });
            continue;
          }

          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: event.answer.text,
            citations: event.answer.citations
          });

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
