import { GradingError, gradeAnswer, readConfidence, readSelectedChoice } from "@/lib/grading";
import { requireApiUser } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Grades one answer, records it, and lets mastery move as a result. */
export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await requireApiUser();
  if (!user) return unauthorized;

  const body = (await request.json().catch(() => null)) as
    | {
        questionId?: string;
        selectedChoice?: number | null;
        response?: string | null;
        confidence?: number | null;
      }
    | null;
  const questionId = body?.questionId?.trim();
  if (!questionId) return Response.json({ error: "questionId is required" }, { status: 400 });

  // Confidence is optional: an older client, or a learner who skipped it.
  const confidence = readConfidence(body?.confidence);

  const { data: owned } = await supabase.from("quiz_questions").select("id").eq("id", questionId).maybeSingle();
  if (!owned) return Response.json({ error: "Question not found" }, { status: 404 });
  const service = createServiceSupabaseClient();
  const { data: question } = await service.from("quiz_questions").select("*")
    .eq("id", owned.id).eq("owner_id", user.id).maybeSingle();
  if (!question) return Response.json({ error: "Question not found" }, { status: 404 });

  if (question.practice_test_id) return Response.json({ error: "Submit the complete practice test to receive your answers." }, { status: 409 });

  const selectedChoice = readSelectedChoice(body?.selectedChoice, question);
  const response = typeof body?.response === "string" ? body.response : "";

  let graded;
  try {
    graded = await gradeAnswer({ question, response, selectedChoice });
  } catch (error) {
    if (error instanceof GradingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const { data: result, error: attemptError } = await service.rpc("record_quiz_attempt", {
    p_question_id: question.id, p_owner_id: user.id,
    p_response: response ? response.slice(0, 4000) : null,
    p_selected_choice: selectedChoice,
    p_score: graded.score, p_is_correct: graded.isCorrect, p_feedback: graded.feedback,
    p_confidence: confidence
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
