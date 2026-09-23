import { notFound } from "next/navigation";
import type { SourceType } from "@studigo/documents";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StudyRoom = {
  id: string;
  title: string;
  subject: string | null;
  course_name: string | null;
  test_date: string | null;
  /** How Studigo pitches explanations in this room. Never changes the facts. */
  explain_level: "simpler" | "standard" | "deeper";
  created_at: string;
  updated_at: string;
};

export type StudyDocument = {
  id: string;
  room_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  source_type: SourceType;
  status: "uploaded" | "queued" | "processing" | "ready" | "failed";
  error_message: string | null;
  page_count: number | null;
  page_label: string;
  ocr_page_count: number;
  chunk_count: number;
  created_at: string;
};

export type Topic = {
  id: string;
  room_id: string;
  title: string;
  objective: string | null;
  key_terms: string[];
  priority: number;
  order_index: number;
  origin: string;
  mastery_score: number;
  status: "not_started" | "learning" | "mastered";
  last_practiced_at: string | null;
  learner_edited: boolean;
};

export const DOCUMENT_COLUMNS =
  "id, room_id, name, mime_type, size_bytes, source_type, status, error_message, page_count, page_label, ocr_page_count, chunk_count, created_at";

export const TOPIC_COLUMNS =
  "id, room_id, title, objective, key_terms, priority, order_index, origin, mastery_score, status, last_practiced_at, learner_edited";

export async function listRooms(): Promise<Array<StudyRoom & { document_count: number }>> {
  // Guest/testing shell: with no Supabase session (or when browser-safe env is
  // absent, as in the sandbox preview) there are no rooms to show. Degrade to
  // an empty list instead of crashing the /app shell.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_rooms")
    .select(
      "id, title, subject, course_name, test_date, created_at, updated_at, documents!documents_room_id_fkey(count)"
    )
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((room) => {
    const { documents, ...rest } = room as typeof room & {
      documents: Array<{ count: number }> | null;
    };
    return { ...(rest as StudyRoom), document_count: documents?.[0]?.count ?? 0 };
  });
}

export async function getRoom(roomId: string): Promise<StudyRoom> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_rooms")
    .select("id, title, subject, course_name, test_date, explain_level, created_at, updated_at")
    .eq("id", roomId)
    .maybeSingle();

  // RLS makes another learner's room indistinguishable from a missing one.
  if (error || !data) notFound();
  return data as StudyRoom;
}

export async function listDocuments(roomId: string): Promise<StudyDocument[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudyDocument[];
}

export async function listTopics(roomId: string): Promise<Topic[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("topics")
    .select(TOPIC_COLUMNS).eq("active", true)
    .eq("room_id", roomId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Topic[];
}

export type RoomReadiness = {
  readiness: number;
  averageMastery: number;
  topicCount: number;
  practicedTopicCount: number;
  masteredCount: number;
  questionsAnswered: number;
  correctAnswers: number;
  cardsDue: number;
};

/**
 * Readiness is derived from what the learner has actually done: unpracticed
 * topics count as zero, because "ready" means ready for the whole test.
 */
export async function getRoomReadiness(roomId: string): Promise<RoomReadiness> {
  const supabase = await createServerSupabaseClient();

  const [topicsResult, attemptsResult, dueResult] = await Promise.all([
    supabase.from("topics").select("mastery_score, status, last_practiced_at").eq("room_id", roomId).eq("active", true),
    supabase.from("quiz_attempts").select("is_correct").eq("room_id", roomId),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .lte("due_at", new Date().toISOString())
  ]);

  const topics = (topicsResult.data ?? []) as Array<{
    mastery_score: number;
    status: string;
    last_practiced_at: string | null;
  }>;
  const attempts = (attemptsResult.data ?? []) as Array<{ is_correct: boolean }>;

  const totalMastery = topics.reduce((sum, topic) => sum + Number(topic.mastery_score), 0);
  const practiced = topics.filter((topic) => topic.last_practiced_at !== null);

  return {
    readiness: topics.length ? Math.round(totalMastery / topics.length) : 0,
    averageMastery: practiced.length
      ? Math.round(
          practiced.reduce((sum, topic) => sum + Number(topic.mastery_score), 0) / practiced.length
        )
      : 0,
    topicCount: topics.length,
    practicedTopicCount: practiced.length,
    masteredCount: topics.filter((topic) => topic.status === "mastered").length,
    questionsAnswered: attempts.length,
    correctAnswers: attempts.filter((attempt) => attempt.is_correct).length,
    cardsDue: dueResult.count ?? 0
  };
}
