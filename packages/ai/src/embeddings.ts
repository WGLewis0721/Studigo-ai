import { EMBEDDING_DIMENSIONS, embeddingClient, embeddingModel } from "./client";

const MAX_BATCH_INPUTS = 96;
/** Well under the 8k-token model limit once chunks are ~1.4k characters. */
const MAX_INPUT_CHARS = 24_000;

export async function embedText(input: string): Promise<number[]> {
  const [embedding] = await embedTexts([input]);
  return embedding ?? [];
}

/** Embeds in batches so ingesting a textbook chapter is one pass, not N calls. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return [];
  const model = embeddingModel();
  const results: number[][] = [];

  for (let start = 0; start < inputs.length; start += MAX_BATCH_INPUTS) {
    const batch = inputs
      .slice(start, start + MAX_BATCH_INPUTS)
      .map((input) => input.slice(0, MAX_INPUT_CHARS) || " ");

    const response = await embeddingClient().embeddings.create({ model, input: batch });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);

    for (const item of ordered) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding model ${model} returned ${item.embedding.length} dimensions; the schema stores ${EMBEDDING_DIMENSIONS}.`
        );
      }
      results.push(item.embedding as number[]);
    }
  }

  return results;
}
