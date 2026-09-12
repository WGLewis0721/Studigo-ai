import { gradeShortAnswer } from "@studigo/ai";
import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

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

  const { data: owned } = await supabase.from("quiz_questions").select("id").eq("id", questionId).maybeSingle();
  if (!owned) return Response.json({ error: "Question not found" }, { status: 404 });
  const service = createServiceSupabaseClient();
  const { data: question } = await service.from("quiz_questions").select("*")
    .eq("id", owned.id).eq("owner_id", user.id).maybeSingle();
  if (!question) return Response.json({ error: "Question not found" }, { status: 404 });

  let isCorrect = false;
  let score = 0;
  let feedback = question.explanation as string;

  if (question.kind === "multiple_choice") {
    const selected = typeof body?.selectedChoice === "number" ? body.selectedChoice : -1;
    if (!Number.isInteger(selected) || selected < 0 || selected >= question.choices.length) return Response.json({ error: "Choose a valid answer." }, { status: 400 });
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

  const { data: result, error: attemptError } = await service.rpc("record_quiz_attempt", {
    p_question_id: question.id, p_owner_id: user.id,
    p_response: typeof body?.response === "string" ? body.response.slice(0, 4000) : null,
    p_selected_choice: typeof body?.selectedChoice === "number" ? body.selectedChoice : null,
    p_score: score, p_is_correct: isCorrect, p_feedback: feedback
  });
  if (attemptError || !result) return Response.json({ error: "Saving your answer failed. Please retry." }, { status: 500 });

  return Response.json({
    ...result,
    correctChoice: question.correct_choice,
    expectedAnswer: question.expected_answer,
    explanation: question.explanation,
    citations: question.citations,
    topicId: question.topic_id
  });
}
