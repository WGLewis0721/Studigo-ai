import {
  UNTRUSTED_MATERIAL_RULE,
  asUntrustedMaterial,
  chatModel,
  client
} from "./client";
import { buildContextBlock, type RetrievedChunk } from "./grounding";

async function structured<T>(args: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const response = await client().responses.create({
    model: chatModel(),
    input: [
      { role: "system", content: args.system },
      { role: "user", content: args.user }
    ],
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        strict: true,
        schema: args.schema
      }
    }
  });

  const raw = response.output_text?.trim();
  if (!raw) throw new Error(`${args.schemaName}: model returned no output`);

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${args.schemaName}: model returned unparsable JSON`);
  }
}

// ---------------------------------------------------------------------------
// Study-guide intelligence: what does the teacher say the learner must know?
// ---------------------------------------------------------------------------

export type ExtractedTopic = {
  title: string;
  objective: string;
  keyTerms: string[];
  priority: number;
};

const TOPIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "objective", "key_terms", "priority"],
        properties: {
          title: { type: "string" },
          objective: { type: "string" },
          key_terms: { type: "array", items: { type: "string" } },
          priority: { type: "integer", minimum: 0, maximum: 100 }
        }
      }
    }
  }
};

/**
 * Reads what the teacher actually asked for. The topic map is only as
 * authoritative as its source, so nothing is invented to round out a list.
 */
export async function extractTopicMap(args: {
  materialText: string;
  sourceLabel: string;
  isTeacherStudyGuide: boolean;
}): Promise<ExtractedTopic[]> {
  if (args.materialText.length > 60_000) throw new Error("Study guide exceeds the supported topic-analysis limit. Split the guide into smaller files.");
  const system = [
    "You build a study topic map from one course document.",
    "Extract only what the document states the learner must know: stated objectives, listed questions, bolded terms, review checklists, 'you should be able to' statements, and section headings that carry testable content.",
    "Never invent a topic, a term, or a requirement that is not in the document. An eight-item study guide yields eight topics, not twelve.",
    "Each objective is one sentence describing what the learner must be able to do, phrased the way the document phrases it.",
    "priority 90-100: the document explicitly flags it as tested or required. 60-89: it is a stated objective or a review question. 0-59: it is supporting background.",
    "Order topics the way the document orders them.",
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");

  const user = [
    args.isTeacherStudyGuide
      ? "This is a teacher-provided study guide. It defines the scope of the test."
      : "This is course material. Extract only topics it clearly presents as things to know.",
    asUntrustedMaterial({ sourceLabel: args.sourceLabel, materialText: args.materialText })
  ].join("\n\n");

  const result = await structured<{
    topics: Array<{ title: string; objective: string; key_terms: string[]; priority: number }>;
  }>({ system, user, schemaName: "studigo_topic_map", schema: TOPIC_SCHEMA });

  return result.topics
    .filter((topic) => topic.title.trim().length > 0)
    .slice(0, 60)
    .map((topic) => ({
      title: topic.title.trim().slice(0, 160),
      objective: topic.objective.trim(),
      keyTerms: topic.key_terms.map((term) => term.trim()).filter(Boolean).slice(0, 12),
      priority: Math.min(100, Math.max(0, Math.round(topic.priority)))
    }));
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export type GeneratedQuestion = {
  kind: "multiple_choice" | "short_answer";
  prompt: string;
  choices: string[];
  correctChoice: number | null;
  expectedAnswer: string | null;
  explanation: string;
  difficulty: "recall" | "core" | "stretch";
  sourceMarkers: number[];
};

const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "prompt",
          "choices",
          "correct_choice",
          "expected_answer",
          "explanation",
          "difficulty",
          "source_markers"
        ],
        properties: {
          kind: { type: "string", enum: ["multiple_choice", "short_answer"] },
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          correct_choice: { type: ["integer", "null"] },
          expected_answer: { type: ["string", "null"] },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["recall", "core", "stretch"] },
          source_markers: { type: "array", items: { type: "integer" } }
        }
      }
    }
  }
};

export async function generateQuizQuestions(args: {
  chunks: RetrievedChunk[];
  topicTitle?: string;
  objective?: string;
  count: number;
  kind?: "multiple_choice" | "short_answer";
}): Promise<GeneratedQuestion[]> {
  if (!args.chunks.length) return [];

  const system = [
    "You write practice questions for one specific course, using only the numbered excerpts supplied.",
    "Every question, every option, and every explanation must be answerable from those excerpts. Never test something they do not cover.",
    "Multiple-choice questions have exactly four options, one correct, with distractors that are plausible to someone who half-remembers the material — never joke options or 'all of the above'.",
    "Short-answer questions expect one or two sentences; expected_answer is the model answer.",
    "Set correct_choice (0-based) for multiple choice and null for short answer; set expected_answer for short answer and null for multiple choice.",
    "The explanation says why the answer is right and points at what the material says.",
    "source_markers lists the excerpt numbers the question comes from. Never cite a number that was not supplied.",
    "Prefer what a teacher study guide emphasizes. Do not repeat the same fact twice.",
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");

  const focus = args.topicTitle
    ? `Focus this set on the topic "${args.topicTitle}".${args.objective ? ` The learner must be able to: ${args.objective}` : ""}`
    : "Cover the most testable material in these excerpts.";

  const user = [
    `Write ${args.count} questions.${args.kind ? ` All questions must use kind ${args.kind}.` : ""}`,
    asUntrustedMaterial({ focus }),
    `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
  ].join("\n\n");

  const result = await structured<{ questions: Array<Record<string, unknown>> }>({
    system,
    user,
    schemaName: "studigo_quiz",
    schema: QUIZ_SCHEMA
  });

  return result.questions
    .map((raw) => {
      const kind = raw.kind === "short_answer" ? "short_answer" : "multiple_choice";
      const choices = Array.isArray(raw.choices) ? (raw.choices as string[]).map(String) : [];
      const correctChoice = typeof raw.correct_choice === "number" ? raw.correct_choice : null;

      return {
        kind,
        prompt: String(raw.prompt ?? "").trim(),
        choices: kind === "multiple_choice" ? choices : [],
        correctChoice: kind === "multiple_choice" ? correctChoice : null,
        expectedAnswer:
          kind === "short_answer" && raw.expected_answer ? String(raw.expected_answer).trim() : null,
        explanation: String(raw.explanation ?? "").trim(),
        difficulty: (["recall", "core", "stretch"] as const).includes(raw.difficulty as never)
          ? (raw.difficulty as GeneratedQuestion["difficulty"])
          : "core",
        sourceMarkers: Array.isArray(raw.source_markers)
          ? (raw.source_markers as number[]).map(Number).filter((marker) =>
              Number.isInteger(marker) && marker >= 1 && marker <= args.chunks.length
            )
          : []
      } satisfies GeneratedQuestion;
    })
    .filter((question) => {
      if (!question.prompt) return false;
      if (question.kind === "multiple_choice") {
        return (
          question.choices.length === 4 &&
          question.correctChoice !== null &&
          question.correctChoice >= 0 &&
          question.correctChoice < 4
        );
      }
      return Boolean(question.expectedAnswer);
    });
}

// ---------------------------------------------------------------------------
// Short-answer grading
// ---------------------------------------------------------------------------

export type ShortAnswerGrade = {
  score: number;
  isCorrect: boolean;
  feedback: string;
};

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "feedback"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    feedback: { type: "string" }
  }
};

export async function gradeShortAnswer(args: {
  question: string;
  expectedAnswer: string;
  learnerAnswer: string;
  supportingContext?: string;
}): Promise<ShortAnswerGrade> {
  const system = [
    "You grade one short answer from a learner against the course's model answer.",
    "Score the understanding, not the wording: a correct idea in the learner's own words scores high; a right-sounding phrase with the wrong idea does not.",
    "score 85-100: correct and complete. 60-84: the core idea with a gap. 30-59: partly right. 0-29: incorrect or empty.",
    "Feedback is two sentences at most, addressed to the learner: what they got, then the one thing to fix. Never invent material beyond the model answer and context.",
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");

  const user = [
    asUntrustedMaterial({ question: args.question, expectedAnswer: args.expectedAnswer }),
    args.supportingContext ? `Course context:\n${asUntrustedMaterial(args.supportingContext)}` : "",
    `Learner's answer: ${asUntrustedMaterial(args.learnerAnswer.slice(0, 4000))}`
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await structured<{ score: number; feedback: string }>({
    system,
    user,
    schemaName: "studigo_short_answer_grade",
    schema: GRADE_SCHEMA
  });

  const score = Math.min(100, Math.max(0, Math.round(result.score)));
  return { score, isCorrect: score >= 60, feedback: result.feedback.trim() };
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

export type GeneratedFlashcard = {
  front: string;
  back: string;
  sourceMarkers: number[];
};

const FLASHCARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["front", "back", "source_markers"],
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          source_markers: { type: "array", items: { type: "integer" } }
        }
      }
    }
  }
};

export async function generateFlashcards(args: {
  chunks: RetrievedChunk[];
  topicTitle?: string;
  count: number;
}): Promise<GeneratedFlashcard[]> {
  if (!args.chunks.length) return [];

  const system = [
    "You write flashcards from the numbered course excerpts supplied, and from nothing else.",
    "One idea per card. The front is a term or a direct question; the back is the answer in one or two sentences, in the course's own language.",
    "Never write a card whose answer is not in the excerpts. source_markers lists the excerpt numbers the card comes from.",
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");

  const user = [
    `Write ${args.count} flashcards.`,
    args.topicTitle ? asUntrustedMaterial({ topicTitle: args.topicTitle }) : "Cover the most testable ideas here.",
    `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
  ].join("\n\n");

  const result = await structured<{
    cards: Array<{ front: string; back: string; source_markers: number[] }>;
  }>({ system, user, schemaName: "studigo_flashcards", schema: FLASHCARD_SCHEMA });

  return result.cards
    .map((card) => ({
      front: card.front.trim(),
      back: card.back.trim(),
      sourceMarkers: (card.source_markers ?? []).filter(
        (marker) => Number.isInteger(marker) && marker >= 1 && marker <= args.chunks.length
      )
    }))
    .filter((card) => card.front && card.back);
}

// ---------------------------------------------------------------------------
// Learn mode
// ---------------------------------------------------------------------------

export async function explainTopic(args: {
  topicTitle: string;
  objective: string | null;
  chunks: RetrievedChunk[];
}): Promise<string> {
  if (!args.chunks.length) {
    return "There is nothing in this Study Room's materials covering that topic yet.";
  }

  const response = await client().responses.create({
    model: chatModel(),
    input: [
      {
        role: "system",
        content: [
          "You are Studigo, teaching one topic from one course's own materials.",
          "Use only the numbered excerpts supplied. Cite inline with [n] for every substantive claim.",
          "Structure: what this topic is, the parts that matter for the test, a worked example or concrete case from the material, and the one thing learners most often get wrong about it (only if the material shows it).",
          "Keep it under 400 words, in plain language. Never add material the excerpts do not contain.",
          UNTRUSTED_MATERIAL_RULE
        ].join(" ")
      },
      {
        role: "user",
        content: [
          asUntrustedMaterial({ topicTitle: args.topicTitle, objective: args.objective }),
          `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
        ]
          .filter(Boolean)
          .join("\n\n")
      }
    ]
  });

  return response.output_text?.trim() || "I couldn't build a grounded explanation for that topic.";
}
