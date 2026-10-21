import { guardAiRequest } from "@/lib/ai-admission";
import { QUESTION_KINDS, generateQuizQuestions, type QuestionKind } from "@studigo/ai";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireApiUser } from "@/lib/auth";
import { assertRoomAccess, markersToCitations, retrieveForRoom } from "@/lib/retrieval";
import { selectPracticeTopics } from "@/lib/practice-topic-selection";
import { allocateTestQuestions } from "@/lib/study-planning";
import { TOPIC_COLUMNS, type Topic } from "@/lib/rooms";

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
    | { roomId?: string; topicId?: string | null; topicIds?: unknown; count?: number; kinds?: unknown }
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

  const { data: rows, error: topicError } = await supabase.from("topics")
    .select(TOPIC_COLUMNS).eq("active", true).eq("room_id", roomId);
  if (topicError) return Response.json({ error: "Could not load the current study scope." }, { status: 500 });
  const available = (rows ?? []) as Topic[];
  const selected = body?.topicIds === undefined ? null : selectPracticeTopics(available, body.topicIds);
  if (body?.topicIds !== undefined && !selected) return Response.json({ error: "Select one or more current topics in this room." }, { status: 400 });
  // Existing clients still target one topic or the weakest one.
  const legacy = body?.topicId
    ? available.find((topic) => topic.id === body.topicId)
    : [...available].sort((a, b) => a.mastery_score - b.mastery_score || b.priority - a.priority)[0];
  if (body?.topicId && !legacy) return Response.json({ error: "That topic is no longer in this room." }, { status: 400 });
  const allocation = allocateTestQuestions(selected ?? (legacy ? [legacy] : []), count);
  if (!allocation.length) return Response.json({ error: "Add a study topic before building a quiz." }, { status: 400 });

  const questions: Array<Record<string, unknown>> = [];
  try {
    // Bound concurrent generation while covering each selected topic separately.
    for (let offset = 0; offset < allocation.length; offset += 2) {
      const batches = await Promise.all(allocation.slice(offset, offset + 2).map(async ({ topic, count: topicCount }) => {
        const chunks = await retrieveForRoom({
          supabase, roomId,
          query: [topic.title, topic.objective, topic.key_terms?.join(", ")].filter(Boolean).join(". "),
          matchCount: Math.min(16, Math.max(6, topicCount * 3))
        });
        if (!chunks.length) throw new Error(`Add supporting material for “${topic.title}” before quizzing it.`);
        const generated = await generateQuizQuestions({ chunks, topicTitle: topic.title, objective: topic.objective ?? undefined, count: topicCount, kinds: requestedKinds });
        if (generated.length < topicCount) generated.push(...await generateQuizQuestions({
          chunks, topicTitle: topic.title, objective: topic.objective ?? undefined,
          count: topicCount - generated.length, kinds: requestedKinds,
          avoidPrompts: generated.map((question) => question.prompt)
        }));
        if (generated.length < topicCount) throw new Error(`Studigo couldn't build enough grounded questions for “${topic.title}”. Try fewer questions or more material.`);
        return generated.slice(0, topicCount).map((question) => ({
          room_id: roomId, owner_id: user.id, topic_id: topic.id,
          kind: question.kind, prompt: question.prompt, choices: question.choices,
          correct_choice: question.correctChoice, expected_answer: question.expectedAnswer,
          accepted_answers: question.acceptedAnswers, explanation: question.explanation,
          difficulty: question.difficulty, citations: markersToCitations(question.sourceMarkers, chunks)
        }));
      }));
      questions.push(...batches.flat());
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not build this quiz." }, { status: 422 });
  }

  const { data: inserted, error } = await createServiceSupabaseClient()
    .from("quiz_questions")
    .insert(questions)
    .select("id, kind, prompt, choices, difficulty, topic_id");

  if (error) {
    return Response.json({ error: "Saving the quiz failed" }, { status: 500 });
  }

  // The answer key stays server-side until the learner answers.
  return Response.json({
    topic: allocation.length === 1 ? { id: allocation[0].topic.id, title: allocation[0].topic.title } : null,
    questions: inserted
  });
}

export async function POST(request: Request) {
  return guardAiRequest(request, "quiz-generate", guardedPost);
}
