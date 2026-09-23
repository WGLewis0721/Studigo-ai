import { streamGroundedAnswer, type GroundedStreamEvent } from "@studigo/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveForRoom } from "@/lib/retrieval";
import { rankWeakAreas, summarizeCalibration, type PracticeEvidence } from "@/lib/study-planning";
import { TOPIC_COLUMNS, type Topic } from "@/lib/rooms";

export type EngineDirective = { name: string; instruction: string };

export type EngineRequest = {
  supabase: SupabaseClient;
  roomId: string;
  /** The learner's raw question. Never mixed with directives — this is the
   *  only text that gets embedded for retrieval, so pedagogy choices can never
   *  dilute the search that finds the source material. */
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** How to teach: coaching style, learning tradition, practice protocol.
   *  Chosen in the UI, applied only to the system prompt. */
  directives?: EngineDirective[];
};

const EVIDENCE_WINDOW = 300;

/**
 * One entry point that fuses the two halves of Studigo into a single request:
 *
 *  1. Deterministic layer (classical CS, no model calls): recency-weighted
 *     mastery, weak-area ranking, and confidence calibration over the
 *     learner's actual attempt history. This is the "brain" that knows what
 *     the learner does and does not know.
 *  2. RAG layer (packages/ai): vector retrieval scoped to this room, then a
 *     grounded, cited generation constrained to only what was retrieved.
 *
 * The deterministic layer's output becomes one more coaching directive for
 * the generation step — it never touches the retrieval query and never
 * fabricates content on its own. Route handlers and UI call this instead of
 * composing retrieval + generation + analytics themselves.
 */
export async function* runStudigoEngine(args: EngineRequest): AsyncGenerator<GroundedStreamEvent> {
  const [topics, evidence] = await Promise.all([
    fetchActiveTopics(args.supabase, args.roomId),
    fetchRecentEvidence(args.supabase, args.roomId)
  ]);

  const learnerStateDirective = buildLearnerStateDirective(topics, evidence);

  const instructions = [...(args.directives ?? []).map((directive) => `[${directive.name.toUpperCase()}] ${directive.instruction}`), learnerStateDirective]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  const chunks = await retrieveForRoom({
    supabase: args.supabase,
    roomId: args.roomId,
    query: args.question
  });

  yield* streamGroundedAnswer({
    question: args.question,
    instructions: instructions || undefined,
    chunks,
    history: args.history
  });
}

async function fetchActiveTopics(supabase: SupabaseClient, roomId: string): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select(TOPIC_COLUMNS)
    .eq("room_id", roomId)
    .eq("active", true)
    .order("order_index", { ascending: true });

  if (error) return [];
  return (data ?? []) as Topic[];
}

async function fetchRecentEvidence(supabase: SupabaseClient, roomId: string): Promise<PracticeEvidence[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("topic_id, source, score, is_correct, created_at, confidence")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(EVIDENCE_WINDOW);

  if (error) return [];
  return (data ?? []) as PracticeEvidence[];
}

/**
 * Turns the deterministic mastery/weak-area/calibration signal into a short,
 * factual directive for the model. It names topics and priorities the
 * learner's own attempt history already earned — the model is told to use
 * this as a coaching priority, never to present it as a source fact.
 */
function buildLearnerStateDirective(topics: Topic[], evidence: PracticeEvidence[]): string | null {
  if (!topics.length) return null;

  const weakAreas = rankWeakAreas(topics, evidence).slice(0, 3);
  const calibration = summarizeCalibration(evidence);

  const lines: string[] = [];
  if (weakAreas.length) {
    lines.push(
      `Learner priority (from this learner's actual practice history, not a fact to cite): ${weakAreas
        .map((area) => `${area.topic.title} (${area.label.toLowerCase()}${area.reasons[0] ? ` — ${area.reasons[0]}` : ""})`)
        .join("; ")}.`
    );
  }
  if (calibration.label !== "Not enough data") {
    lines.push(`Confidence calibration: ${calibration.label.toLowerCase()}. ${calibration.summary}`);
  }
  if (!lines.length) return null;

  return `[LEARNER STATE] ${lines.join(" ")} Use this only to decide what to practice next and how much to scaffold — never state it as course content.`;
}
