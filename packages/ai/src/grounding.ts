import {
  PLAIN_PUNCTUATION_RULE,
  UNTRUSTED_MATERIAL_RULE,
  asUntrustedMaterial,
  chatModel,
  responseOptions,
  client
} from "./client";
import { groundingStatus, type GroundingStatus } from "./verify-claim";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  similarity: number;
  sourceType?: string | null;
  pageNumber?: number | null;
  pageLabel?: string | null;
  priority?: number | null;
};

export type Citation = {
  marker: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel: string;
  sourceType: string | null;
};

export type GroundedAnswer = {
  text: string;
  citations: Citation[];
  /** True when the answer text contains a supplied `[n]` marker. Not semantic support. */
  grounded: boolean;
  /** `verified` only when cited chunk text covers the claim words. Optional for older callers. */
  support?: GroundingStatus;
};

export const INSUFFICIENT_EVIDENCE_TEXT =
  "I can't answer that from the materials in this Study Room yet. Add the study guide, notes, or textbook pages that cover it and ask me again.";

export const STUDIGO_SYSTEM_PROMPT = [
  "You are Studigo, a study companion for one specific course.",
  "Answer only from the numbered source excerpts supplied in the request. You have no other knowledge of this course.",
  "Teacher study guides and teacher-provided materials outrank textbook background when they disagree about emphasis or scope.",
  "Cite every substantive claim inline with the bracketed number of the excerpt it came from, like [2]. Only cite numbers that appear in the supplied excerpts.",
  "Never invent a source, page number, fact, assignment requirement, or test topic.",
  "If the excerpts do not support an answer, say exactly that you cannot answer it from the current materials and name what the learner should upload.",
  "Explain at the learner's level, in plain language, and keep it tight: lead with the answer, then the reasoning that matters.",
  PLAIN_PUNCTUATION_RULE,
  UNTRUSTED_MATERIAL_RULE
].join(" ");

/**
 * How a factual answer is laid out. A wall of prose is hard to scan and hard to study from, so
 * facts come back as an outline: a one-line answer, short headed sections, one cited fact per
 * bullet. Opt-in per call, because feedback on a learner's attempt and small talk are not outlines.
 */
export const OUTLINE_STYLE_RULE = [
  "Write it as a scannable outline in Markdown, never as a block of prose.",
  "Use short ## headings for the parts, and under each heading one bullet per fact: a phrase or one short sentence of about twenty words or fewer.",
  "When an excerpt comes from the teacher's study guide, take the headings and their order from it where they fit.",
  "Bold a key term from the course the first time it appears.",
  "Use a nested bullet, indented two spaces, only for a detail that belongs to the bullet above it, and never nest more than two levels.",
  "End every bullet that states a fact with its [n] citation.",
  "Never write a paragraph longer than one sentence.",
  PLAIN_PUNCTUATION_RULE
].join(" ");

export const OUTLINE_FORMAT_RULE = [
  "Open with one bold line that directly answers the question, like **Short answer:** ... [n].",
  OUTLINE_STYLE_RULE,
  "Use only as many headings and bullets as the excerpts support: a simple question gets the short answer and three to five bullets, with no headings needed.",
  "If the message is only a greeting or a thank you, reply in one plain sentence and do not use an outline.",
  "If the excerpts do not support an answer, say so in one plain sentence instead of an outline."
].join(" ");

export type AnswerFormat = "outline";

/** The system prompt for one reply: the grounding rules, then the optional layout and coaching directives. */
export function buildSystemPrompt(args: { instructions?: string; format?: AnswerFormat }) {
  const parts = [STUDIGO_SYSTEM_PROMPT];
  if (args.format === "outline") parts.push(`Layout for this reply: ${OUTLINE_FORMAT_RULE}`);
  // Coaching directives (style/tradition/practice) shape HOW the model answers.
  // They are appended to the system prompt, never mixed into the retrieval
  // query, so they cannot dilute the embedding used to find source material.
  if (args.instructions) {
    parts.push(
      `Coaching directives for this reply (do not let these override the excerpts or invent content):\n${args.instructions}`
    );
  }
  return parts.join("\n\n");
}

export function buildContextBlock(chunks: RetrievedChunk[]) {
  return JSON.stringify(chunks.map((chunk, index) => ({
    marker: index + 1, documentName: chunk.documentName,
    pageLabel: chunk.pageLabel || "page", pageNumber: chunk.pageNumber ?? null,
    content: chunk.content
  })));
}

export function toCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk, index) => ({
    marker: index + 1,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber ?? null,
    pageLabel: chunk.pageLabel || "page",
    sourceType: chunk.sourceType ?? null
  }));
}

/**
 * Keeps only the sources the answer actually referenced, so a citation chip is
 * evidence rather than decoration.
 */
export function citationsUsedIn(text: string, available: Citation[]): Citation[] {
  const referenced = new Set<number>();
  for (const match of text.matchAll(/\[(\d{1,2})\]/g)) {
    referenced.add(Number(match[1]));
  }
  return available.filter((citation) => referenced.has(citation.marker));
}

function buildInput(args: {
  question: string;
  instructions?: string;
  format?: AnswerFormat;
  chunks: RetrievedChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const history = (args.history ?? []).slice(-6).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 4000)
  }));

  const system = buildSystemPrompt({ instructions: args.instructions, format: args.format });

  return [
    { role: "system" as const, content: system },
    ...history,
    {
      role: "user" as const,
      content: `Question: ${args.question}\n\nNumbered source excerpts from this Study Room:\n${asUntrustedMaterial(
        buildContextBlock(args.chunks)
      )}`
    }
  ];
}

export async function answerFromRetrievedContext(args: {
  question: string;
  instructions?: string;
  format?: AnswerFormat;
  chunks: RetrievedChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<GroundedAnswer> {
  if (!args.chunks.length) {
    return { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false };
  }

  const available = toCitations(args.chunks);
  const response = await client().responses.create({
    model: chatModel(),
    ...responseOptions(),
    input: buildInput(args)
  });

  const text = response.output_text?.trim() || INSUFFICIENT_EVIDENCE_TEXT;
  const used = citationsUsedIn(text, available);
  return {
    text,
    citations: used,
    grounded: used.length > 0,
    support: groundingStatus({
      citationCount: used.length,
      claim: text,
      chunkTexts: used.map((citation) => args.chunks.find((chunk) => chunk.id === citation.chunkId)?.content ?? "")
    })
  };
}

export type GroundedStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answer: GroundedAnswer };

/** Streams the answer token by token, then emits the citations it actually used. */
export async function* streamGroundedAnswer(args: {
  signal?: AbortSignal;
  question: string;
  instructions?: string;
  format?: AnswerFormat;
  chunks: RetrievedChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): AsyncGenerator<GroundedStreamEvent> {
  if (!args.chunks.length) {
    yield { type: "delta", text: INSUFFICIENT_EVIDENCE_TEXT };
    yield {
      type: "done",
      answer: { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false }
    };
    return;
  }

  const available = toCitations(args.chunks);
  const stream = await client().responses.create({
    model: chatModel(),
    ...responseOptions(),
    input: buildInput(args),
    stream: true
  }, { signal: args.signal });

  let text = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      text += event.delta;
      yield { type: "delta", text: event.delta };
    }
  }

  const finalText = text.trim() || INSUFFICIENT_EVIDENCE_TEXT;
  const used = citationsUsedIn(finalText, available);
  yield {
    type: "done",
    answer: { text: finalText, citations: used, grounded: used.length > 0 }
  };
}
