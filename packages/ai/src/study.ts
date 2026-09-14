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

export const QUESTION_KINDS = [
  "multiple_choice",
  "short_answer",
  "true_false",
  "fill_blank"
] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** The placeholder a fill-in-the-blank stem must contain. */
export const BLANK_MARKER = "____";

export type GeneratedQuestion = {
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  correctChoice: number | null;
  expectedAnswer: string | null;
  /** Fill-in only: every spelling that should be marked correct. */
  acceptedAnswers: string[];
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
          "accepted_answers",
          "explanation",
          "difficulty",
          "source_markers"
        ],
        properties: {
          kind: { type: "string", enum: [...QUESTION_KINDS] },
          prompt: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          correct_choice: { type: ["integer", "null"] },
          expected_answer: { type: ["string", "null"] },
          accepted_answers: { type: "array", items: { type: "string" } },
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
  kind?: QuestionKind;
  /** Leave unset for a mixed set; pass a subset to bias the question types. */
  kinds?: QuestionKind[];
}): Promise<GeneratedQuestion[]> {
  if (!args.chunks.length) return [];

  const system = [
    "You write practice questions for one specific course, using only the numbered excerpts supplied.",
    "Every question, every option, and every explanation must be answerable from those excerpts. Never test something they do not cover.",
    "multiple_choice: exactly four options, one correct, with distractors that are plausible to someone who half-remembers the material — never joke options or 'all of the above'. Set correct_choice (0-based).",
    "short_answer: expects one or two sentences. Set expected_answer to the model answer.",
    `true_false: choices are exactly ["True","False"] and correct_choice is 0 for True or 1 for False. The statement must be decidable from the excerpts alone. Make roughly half of them false, and build a false statement by changing a specific claim — a number, a direction, a cause, an order — never by inserting 'always' or 'never' as a giveaway.`,
    `fill_blank: the prompt is one sentence from the material with exactly one blank written as ${BLANK_MARKER}. The blank must hide a term or value worth knowing, never an article or a preposition. Set expected_answer to the single best answer and accepted_answers to every spelling that should be marked correct — the exact term, common abbreviations, and singular/plural forms.`,
    "Set fields that do not apply to null or an empty array.",
    "Never leak the answer in the stem: the wording must not contain the answer, its definition, or a one-to-one paraphrase of it.",
    "The explanation says why the answer is right and points at what the material says.",
    "source_markers lists the excerpt numbers the question comes from. Never cite a number that was not supplied.",
    "Prefer what a teacher study guide emphasizes. Do not repeat the same fact twice.",
    UNTRUSTED_MATERIAL_RULE
  ].join(" ");

  const focus = args.topicTitle
    ? `Focus this set on the topic "${args.topicTitle}".${args.objective ? ` The learner must be able to: ${args.objective}` : ""}`
    : "Cover the most testable material in these excerpts.";

  const allowed = args.kind ? [args.kind] : (args.kinds?.length ? args.kinds : null);
  const mix = allowed
    ? allowed.length === 1
      ? ` All questions must use kind ${allowed[0]}.`
      : ` Use only these kinds, spread evenly across the set: ${allowed.join(", ")}.`
    : " Mix the kinds across the set so the learner is tested by recognition, recall, and explanation.";

  const user = [
    `Write ${args.count} questions.${mix}`,
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
    .map((raw) => normalizeGeneratedQuestion(raw, args.chunks.length))
    .filter((question): question is GeneratedQuestion => question !== null)
    .filter((question) => !allowed || allowed.includes(question.kind));
}

/**
 * Shapes one generated question and rejects anything that would reach a learner
 * as an ungradable or self-answering item.
 */
export function normalizeGeneratedQuestion(
  raw: Record<string, unknown>,
  chunkCount: number
): GeneratedQuestion | null {
  const kind = (QUESTION_KINDS as readonly string[]).includes(raw.kind as string)
    ? (raw.kind as QuestionKind)
    : "multiple_choice";

  const prompt = String(raw.prompt ?? "").trim();
  if (!prompt) return null;

  const rawChoices = Array.isArray(raw.choices) ? (raw.choices as unknown[]).map(String) : [];
  const correctChoice = typeof raw.correct_choice === "number" ? raw.correct_choice : null;
  const expectedAnswer = raw.expected_answer ? String(raw.expected_answer).trim() : null;
  const acceptedAnswers = Array.isArray(raw.accepted_answers)
    ? [...new Set((raw.accepted_answers as unknown[]).map((value) => String(value).trim()).filter(Boolean))].slice(0, 8)
    : [];

  const question: GeneratedQuestion = {
    kind,
    prompt,
    choices: kind === "multiple_choice" ? rawChoices : kind === "true_false" ? ["True", "False"] : [],
    correctChoice: kind === "multiple_choice" || kind === "true_false" ? correctChoice : null,
    expectedAnswer: kind === "short_answer" || kind === "fill_blank" ? expectedAnswer : null,
    acceptedAnswers: kind === "fill_blank" ? acceptedAnswers : [],
    explanation: String(raw.explanation ?? "").trim(),
    difficulty: (["recall", "core", "stretch"] as const).includes(raw.difficulty as never)
      ? (raw.difficulty as GeneratedQuestion["difficulty"])
      : "core",
    sourceMarkers: Array.isArray(raw.source_markers)
      ? (raw.source_markers as unknown[])
          .map(Number)
          .filter((marker) => Number.isInteger(marker) && marker >= 1 && marker <= chunkCount)
      : []
  };

  switch (question.kind) {
    case "multiple_choice": {
      const distinct = new Set(question.choices.map((choice) => choice.trim().toLowerCase()));
      const valid =
        question.choices.length === 4 &&
        distinct.size === 4 &&
        question.correctChoice !== null &&
        question.correctChoice >= 0 &&
        question.correctChoice < 4;
      return valid ? question : null;
    }
    case "true_false":
      return question.correctChoice === 0 || question.correctChoice === 1 ? question : null;
    case "fill_blank": {
      // One blank exactly: zero is unanswerable, several are ambiguous to grade.
      const blanks = question.prompt.split(BLANK_MARKER).length - 1;
      if (blanks !== 1 || !question.expectedAnswer) return null;
      // The model sometimes omits the obvious spelling from accepted_answers.
      const accepted = new Set(question.acceptedAnswers.map((value) => value.toLowerCase()));
      if (!accepted.has(question.expectedAnswer.toLowerCase())) {
        question.acceptedAnswers = [question.expectedAnswer, ...question.acceptedAnswers];
      }
      // A stem that already contains its own answer tests nothing.
      const stem = question.prompt.replace(BLANK_MARKER, " ").toLowerCase();
      if (question.expectedAnswer.length > 3 && stem.includes(question.expectedAnswer.toLowerCase())) {
        return null;
      }
      return question;
    }
    default:
      return question.expectedAnswer ? question : null;
  }
}

/** Comparable form of a typed answer: case, accents, padding and articles removed. */
export function normalizeBlankAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Grades a fill-in-the-blank answer without a model call. Exact after
 * normalization, or a near-miss within one edit — a learner who typed
 * "photosynthesis" as "photosynthisis" knows the term.
 */
export function gradeBlankAnswer(args: {
  learnerAnswer: string;
  acceptedAnswers: string[];
}): { isCorrect: boolean; score: number; matched: string | null } {
  const answer = normalizeBlankAnswer(args.learnerAnswer);
  if (!answer) return { isCorrect: false, score: 0, matched: null };

  for (const accepted of args.acceptedAnswers) {
    const target = normalizeBlankAnswer(accepted);
    if (!target) continue;
    if (answer === target) return { isCorrect: true, score: 100, matched: accepted };
    // Tolerate one typo, and only on terms long enough for that to be a typo.
    if (target.length >= 5 && editDistanceWithin(answer, target, 1)) {
      return { isCorrect: true, score: 85, matched: accepted };
    }
  }

  return { isCorrect: false, score: 0, matched: null };
}

/** True when `a` can be turned into `b` with at most `max` edits. */
function editDistanceWithin(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowBest = Math.min(rowBest, current[j]);
    }
    if (rowBest > max) return false;
    previous = current;
  }

  return previous[b.length] <= max;
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

export type ExplainLevel = "simpler" | "standard" | "deeper";

/**
 * Changes how an idea is pitched, never which facts are true. Every variant is
 * still bound to the same excerpts and the same citation rule.
 */
const LEVEL_RULES: Record<ExplainLevel, string> = {
  simpler:
    "Pitch this for a learner who finds the material hard: short sentences, everyday words, and a concrete comparison for each abstract idea. Keep every technical term the course uses, but define it the first time in plain language. Do not simplify a fact into something inaccurate, and do not omit anything the excerpts mark as testable.",
  standard: "Pitch this at the level the material itself is written for.",
  deeper:
    "Pitch this for a learner who already has the basics: be precise, use the course's technical vocabulary directly, and spend the space on mechanism, edge cases and why it works rather than on restating definitions. Add nothing the excerpts do not support."
};

export async function explainTopic(args: {
  topicTitle: string;
  objective: string | null;
  chunks: RetrievedChunk[];
  level?: ExplainLevel;
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
          "Keep it under 400 words. Never add material the excerpts do not contain.",
          LEVEL_RULES[args.level ?? "standard"],
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

// ---------------------------------------------------------------------------
// Socratic checks
// ---------------------------------------------------------------------------

export type SocraticQuestion = { question: string };

export type SocraticResponse = {
  /** Did the learner's answer show they understand it? */
  understood: boolean;
  /** Addressed to the learner, grounded in the excerpts. */
  feedback: string;
  /** The next question to push on, or null when the idea is secure. */
  followUp: string | null;
};

const SOCRATIC_QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question"],
  properties: { question: { type: "string" } }
};

const SOCRATIC_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["understood", "feedback", "follow_up"],
  properties: {
    understood: { type: "boolean" },
    feedback: { type: "string" },
    follow_up: { type: ["string", "null"] }
  }
};

/**
 * Asks the learner to explain the idea back. This is formative: it is never
 * scored and never moves mastery, because a teaching conversation should not
 * punish the thinking-out-loud it is trying to encourage.
 */
export async function askSocraticQuestion(args: {
  topicTitle: string;
  objective: string | null;
  chunks: RetrievedChunk[];
  level?: ExplainLevel;
}): Promise<SocraticQuestion> {
  if (!args.chunks.length) {
    return { question: "There is nothing in this room's materials covering that topic yet." };
  }

  const result = await structured<{ question: string }>({
    system: [
      "You are Studigo, checking whether a learner understands one topic from their own course materials.",
      "Ask exactly one open question that makes them explain the idea in their own words — why, how, what would happen if.",
      "Never ask something answerable with yes, no, or a single term, and never ask for a definition they could copy straight from the page.",
      "The question must be answerable from the supplied excerpts alone.",
      LEVEL_RULES[args.level ?? "standard"],
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
    user: [
      asUntrustedMaterial({ topicTitle: args.topicTitle, objective: args.objective }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_socratic_question",
    schema: SOCRATIC_QUESTION_SCHEMA
  });

  return { question: result.question.trim() };
}

/** Responds to the learner's explanation, and decides whether to push further. */
export async function respondToSocraticAnswer(args: {
  topicTitle: string;
  question: string;
  learnerAnswer: string;
  chunks: RetrievedChunk[];
  level?: ExplainLevel;
}): Promise<SocraticResponse> {
  const result = await structured<{ understood: boolean; feedback: string; follow_up: string | null }>({
    system: [
      "You are Studigo, responding to a learner who has just explained an idea back to you in their own words.",
      "Judge the understanding, not the wording or the spelling.",
      "Feedback is at most three sentences, addressed to the learner: name what they got right first, then the one thing that is missing or wrong, grounded in the excerpts. Cite with [n] when you correct a fact.",
      "If they have the idea, set understood to true and follow_up to null. If something important is missing, set understood to false and make follow_up one question that points at the gap without giving the answer away.",
      "Never invent material beyond the excerpts. If their answer is off-topic or empty, say so plainly and re-ask.",
      LEVEL_RULES[args.level ?? "standard"],
      UNTRUSTED_MATERIAL_RULE
    ].join(" "),
    user: [
      asUntrustedMaterial({
        topicTitle: args.topicTitle,
        question: args.question,
        learnerAnswer: args.learnerAnswer.slice(0, 4000)
      }),
      `Numbered source excerpts:\n${asUntrustedMaterial(buildContextBlock(args.chunks))}`
    ].join("\n\n"),
    schemaName: "studigo_socratic_response",
    schema: SOCRATIC_RESPONSE_SCHEMA
  });

  const followUp = result.follow_up ? String(result.follow_up).trim() : "";
  return {
    understood: Boolean(result.understood),
    feedback: result.feedback.trim(),
    followUp: result.understood || !followUp ? null : followUp
  };
}
