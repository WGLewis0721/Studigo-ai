import { gradeShortAnswer } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { recalculateTopicMastery } from "@/lib/mastery";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Grades one answer, records it, and lets mastery move as a result. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | { questionId?: string; selectedChoice?: number | null; response?: string | null }
    | null;
  const questionId = body?.questionId?.trim();
  if (!questionId) return Response.json({ error: "questionId is required" }, { status: 400 });

  const { data: question } = await supabase
    .from("quiz_questions")
    .select(
      "id, room_id, topic_id, kind, prompt, choices, correct_choice, expected_answer, explanation, citations"
    )
    .eq("id", questionId)
    .maybeSingle();

  if (!question) return Response.json({ error: "Question not found" }, { status: 404 });

  let isCorrect = false;
  let score = 0;
  let feedback = question.explanation as string;

  if (question.kind === "multiple_choice") {
    const selected = typeof body?.selectedChoice === "number" ? body.selectedChoice : -1;
    isCorrect = selected === question.correct_choice;
    score = isCorrect ? 100 : 0;
  } else {
    const answer = String(body?.response || "").trim();
    if (!answer) {
      return Response.json({ error: "Write an answer first." }, { status: 400 });
    }
    const grade = await gradeShortAnswer({
      question: question.prompt as string,
      expectedAnswer: (question.expected_answer as string) ?? "",
      learnerAnswer: answer
    });
    isCorrect = grade.isCorrect;
    score = grade.score;
    feedback = grade.feedback;
  }

  const { error: attemptError } = await supabase.from("quiz_attempts").insert({
    question_id: question.id,
    room_id: question.room_id,
    owner_id: user.id,
    topic_id: question.topic_id,
    response: body?.response ?? null,
    selected_choice: typeof body?.selectedChoice === "number" ? body.selectedChoice : null,
    is_correct: isCorrect,
    score,
    feedback
  });

  if (attemptError) {
    return Response.json(
      { error: "Saving your answer failed", detail: attemptError.message },
      { status: 500 }
    );
  }

  let mastery: number | null = null;
  if (question.topic_id) {
    mastery = await recalculateTopicMastery({ supabase, topicId: question.topic_id as string });
  }

  return Response.json({
    isCorrect,
    score,
    feedback,
    correctChoice: question.correct_choice,
    expectedAnswer: question.expected_answer,
    explanation: question.explanation,
    citations: question.citations,
    topicId: question.topic_id,
    mastery
  });
}
