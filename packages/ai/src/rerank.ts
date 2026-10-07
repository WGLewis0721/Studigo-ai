/**
 * Optional second pass over retrieved chunks. Off unless STUDIGO_RERANK=1.
 * This overlap ranker does not call a model. A provider reranker, if added,
 * stays in this package.
 */
export type RerankChunk = { id: string; content: string };

function tokens(text: string) {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
}

export function rerankByOverlap<T extends RerankChunk>(query: string, chunks: T[], limit = 8): T[] {
  const wanted = tokens(query);
  return [...chunks]
    .sort((a, b) => {
      const score = (chunk: T) => {
        const have = tokens(chunk.content);
        let hits = 0;
        for (const word of wanted) if (have.has(word)) hits += 1;
        return hits;
      };
      return score(b) - score(a);
    })
    .slice(0, limit);
}
