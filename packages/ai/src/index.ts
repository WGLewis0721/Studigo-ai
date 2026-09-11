import OpenAI from "openai";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  similarity: number;
  sourceType?: string | null;
  pageNumber?: number | null;
  priority?: number | null;
};

export type GroundedAnswer = {
  text: string;
  citations: Array<{
    documentId: string;
    documentName: string;
    pageNumber?: number | null;
  }>;
};

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
}

export async function embedText(input: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const result = await client().embeddings.create({ model, input });
  return result.data[0]?.embedding ?? [];
}

export async function answerFromRetrievedContext(args: {
  question: string;
  chunks: RetrievedChunk[];
}): Promise<GroundedAnswer> {
  const model = process.env.OPENAI_CHAT_MODEL;
  if (!model) throw new Error("OPENAI_CHAT_MODEL is not configured");

  if (!args.chunks.length) {
    return {
      text: "I couldn't find enough support for that answer in the materials currently in this Study Room.",
      citations: []
    };
  }

  const context = args.chunks
    .map((chunk, index) => {
      const page = chunk.pageNumber ? ` page ${chunk.pageNumber}` : "";
      return `[${index + 1}] ${chunk.documentName}${page}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  const response = await client().responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You are Studigo, a course-specific study companion. Answer from the supplied study material only. Teacher study guides and teacher-provided materials outrank textbook background when they conflict in emphasis. Never invent a source, page, fact, assignment requirement, or test topic. If the provided context is insufficient, say so plainly. Explain at the learner's level and optimize for understanding rather than showing off."
      },
      {
        role: "user",
        content: `Question: ${args.question}\n\nRetrieved study material:\n${context}`
      }
    ]
  });

  const uniqueSources = new Map<string, GroundedAnswer["citations"][number]>();
  for (const chunk of args.chunks) {
    const key = `${chunk.documentId}:${chunk.pageNumber ?? ""}`;
    if (!uniqueSources.has(key)) {
      uniqueSources.set(key, {
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageNumber: chunk.pageNumber
      });
    }
  }

  return {
    text: response.output_text || "I couldn't generate a grounded response from the retrieved material.",
    citations: [...uniqueSources.values()]
  };
}
