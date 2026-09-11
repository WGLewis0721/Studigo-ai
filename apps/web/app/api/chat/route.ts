import { streamGroundedAnswer } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, retrieveForRoom } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequest = {
  roomId?: string;
  question?: string;
  conversationId?: string | null;
};

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

  await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content: question });

  let chunks;
  try {
    chunks = await retrieveForRoom({ supabase, roomId, query: question });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId });

      try {
        for await (const event of streamGroundedAnswer({ question, chunks, history })) {
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
