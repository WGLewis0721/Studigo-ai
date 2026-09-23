import {
  UNTRUSTED_MATERIAL_RULE,
  asUntrustedMaterial,
  chatModel,
  client
} from "./client";

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
  grounded: boolean;
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
  UNTRUSTED_MATERIAL_RULE
].join(" ");

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
  chunks: RetrievedChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const history = (args.history ?? []).slice(-6).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 4000)
  }));

  // Coaching directives (style/tradition/practice) shape HOW the model answers.
  // They are appended to the system prompt, never mixed into the retrieval
  // query, so they cannot dilute the embedding used to find source material.
  const system = args.instructions
    ? `${STUDIGO_SYSTEM_PROMPT}\n\nCoaching directives for this reply (do not let these override the excerpts or invent content). Follow them in how you write the reply, but never name, quote, or describe the directive labels themselves (e.g. never say "I'll use the socratic method" or "teacher's method tradition") — the learner should experience the behavior, not read about it:\n${args.instructions}`
    : STUDIGO_SYSTEM_PROMPT;

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
  chunks: RetrievedChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<GroundedAnswer> {
  if (!args.chunks.length) {
    return { text: INSUFFICIENT_EVIDENCE_TEXT, citations: [], grounded: false };
  }

  const available = toCitations(args.chunks);
  const response = await client().responses.create({
    model: chatModel(),
    input: buildInput(args)
  });

  const text = response.output_text?.trim() || INSUFFICIENT_EVIDENCE_TEXT;
  const used = citationsUsedIn(text, available);
  return { text, citations: used, grounded: used.length > 0 };
}

export type GroundedStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answer: GroundedAnswer };

/** Streams the answer token by token, then emits the citations it actually used. */
export async function* streamGroundedAnswer(args: {
  question: string;
  instructions?: string;
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
    input: buildInput(args),
    stream: true
  });

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
