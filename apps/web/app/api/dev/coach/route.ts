import { runFixtureEngine } from "@/lib/fixture-engine";
import type { Topic } from "@/lib/rooms";
import type { PracticeEvidence } from "@/lib/study-planning";

export const runtime = "nodejs";
export const maxDuration = 60;

type FixtureChatRequest = {
  question?: string;
  topics?: Topic[];
  evidence?: PracticeEvidence[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  directives?: Array<{ name: string; instruction: string }>;
};

/**
 * Backs the coach panel's local dev fixture (`roomId === "fixture"`, see
 * app/dev/study/page.tsx). Same request/response contract as /api/chat so
 * the client uses one code path for both. Production always 404s: there is
 * no room, no auth, and no persistence here — only the shared recommendation
 * engine running over synthetic chunks.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as FixtureChatRequest | null;
  const question = body?.question?.trim();
  const topics = Array.isArray(body?.topics) ? body!.topics : [];

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 4000) {
    return Response.json({ error: "That question is too long." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", conversationId: null });

      try {
        for await (const event of runFixtureEngine({
          question,
          topics,
          evidence: body?.evidence ?? [],
          history: body?.history ?? [],
          directives: body?.directives ?? []
        })) {
          if (event.type === "delta") {
            send({ type: "delta", text: event.text });
            continue;
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
