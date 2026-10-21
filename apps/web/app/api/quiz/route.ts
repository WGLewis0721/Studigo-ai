import { guardAiRequest } from "@/lib/ai-admission";
import { QUESTION_KINDS, generateQuizQuestions, type QuestionKind } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, markersToCitations, retrieveForRoom } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_QUESTIONS = 10;

/**
 * Builds a quiz from this room's materials. When a topic is given, the quiz
 * targets it; otherwise it aims at the topics the learner is weakest on, so
 * practice goes where it is needed.
 */
async function guardedPost(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { roomId?: string; topicId?: string | null; count?: number; kinds?: unknown }
    | null;
  const roomId = body?.roomId?.trim();
  if (!roomId) return Response.json({ error: "roomId is required" }, { status: 400 });

  const room = await assertRoomAccess(supabase, roomId);
  if (!room) return Response.json({ error: "Study Room not found" }, { status: 404 });

  const count = Math.min(MAX_QUESTIONS, Math.max(1, Math.round(body?.count ?? 5)));

  // Preserve mixed sets for old clients, but never silently replace a learner's
  // explicit selection with an unwanted question type.
  const hasKinds = body?.kinds !== undefined;
  const validKinds = Array.isArray(body?.kinds)
    && body.kinds.length > 0
    && body.kinds.length <= QUESTION_KINDS.length
    && body.kinds.every((kind: unknown) => typeof kind === "string" && (QUESTION_KINDS as readonly string[]).includes(kind))
    && new Set(body.kinds).size === body.kinds.length;
  if (hasKinds && !validKinds) {
    return Response.json({ error: "Select one or more valid question types." }, { status: 400 });
  }
  const requestedKinds = validKinds ? body!.kinds as QuestionKind[] : undefined;

  type QuizTopic = { id: string; title: string; objective: string | null; key_terms: string[] };
  let topic: QuizTopic | null = null;

  if (body?.topicId) {
    const { data } = await supabase
      .from("topics")
      .select("id, title, objective, key_terms").eq("active", true)
      .eq("id", body.topicId)
      .eq("room_id", roomId)
      .maybeSingle();
    topic = (data as QuizTopic | null) ?? null;
  } else {
    const { data } = await supabase
      .from("topics")
      .select("id, title, objective, key_terms").eq("active", true)
      .eq("room_id", roomId)
      .order("mastery_score", { ascending: true })
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();
    topic = (data as QuizTopic | null) ?? null;
  }

  const query = topic
    ? [topic.title, topic.objective, topic.key_terms?.join(", ")].filter(Boolean).join(". ")
    : "the most important ideas, definitions, and processes in these materials";

  const chunks = await retrieveForRoom({
    supabase,
    roomId,
    query,
    matchCount: Math.min(16, count * 3)
  });

  if (!chunks.length) {
    return Response.json(
      { error: "There isn't enough processed material in this room to build a quiz yet." },
      { status: 400 }
    );
  }

  const generated = await generateQuizQuestions({
    chunks,
    topicTitle: topic?.title,
    objective: topic?.objective ?? undefined,
    count,
    kinds: requestedKinds
  });

  // Normalization may reject an AI-produced question. Top up once rather than
  // silently delivering fewer questions than the learner selected.
  if (generated.length < count) {
    const additional = await generateQuizQuestions({
      chunks,
      topicTitle: topic?.title,
      objective: topic?.objective ?? undefined,
      count: count - generated.length,
      kinds: requestedKinds,
      avoidPrompts: generated.map((question) => question.prompt)
    });
    generated.push(...additional);
  }
  if (generated.length < count) {
    return Response.json(
      { error: "Studigo couldn't build the full set of grounded questions. Try fewer questions or more study material." },
      { status: 422 }
    );
  }
  generated.length = count;

  const { data: inserted, error } = await createServiceSupabaseClient()
    .from("quiz_questions")
    .insert(
      generated.map((question) => ({
        room_id: roomId,
        owner_id: user.id,
        topic_id: topic?.id ?? null,
        kind: question.kind,
        prompt: question.prompt,
        choices: question.choices,
        correct_choice: question.correctChoice,
        expected_answer: question.expectedAnswer,
        accepted_answers: question.acceptedAnswers,
        explanation: question.explanation,
        difficulty: question.difficulty,
        citations: markersToCitations(question.sourceMarkers, chunks)
      }))
    )
    .select("id, kind, prompt, choices, difficulty, topic_id");

  if (error) {
    return Response.json({ error: "Saving the quiz failed" }, { status: 500 });
  }

  // The answer key stays server-side until the learner answers.
  return Response.json({
    topic: topic ? { id: topic.id, title: topic.title } : null,
    questions: inserted
  });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "quiz-generate", guardedPost);
}
