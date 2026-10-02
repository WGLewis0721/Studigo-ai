export type GuideTopic = { title: string; objective: string | null; key_terms: string[] | null; source_document_ids: string[] | null };
export type GuideChunk = { document_id: string; content: string; chunk_index: number; page_number: number | null };
const STOP = new Set(['explain','describe','understand','identify','compare','their','these','which','about','using','know','learn']);
/** Linked documents restrict scope, but do not prove relevance. No arbitrary fallback. */
export function selectGuideSources<T extends GuideChunk>(topic: GuideTopic, chunks: T[], readyIds: ReadonlySet<string>): T[] {
  const terms = new Set([topic.title, topic.objective ?? '', ...(topic.key_terms ?? [])].join(' ').toLowerCase()
    .match(/[a-z0-9]{3,}/g)?.filter(t => !STOP.has(t)) ?? []);
  return chunks.filter(c => readyIds.has(c.document_id)
    && (!topic.source_document_ids?.length || topic.source_document_ids.includes(c.document_id)))
    .map(chunk => ({ chunk, score: [...terms].reduce((n,t) => n + (new RegExp('\\b' + t + '\\b','i').test(chunk.content) ? 1 : 0), 0) }))
    .filter(item => item.score > 0).sort((a,b) => b.score-a.score || a.chunk.chunk_index-b.chunk.chunk_index
      || a.chunk.document_id.localeCompare(b.chunk.document_id)).slice(0,2).map(item => item.chunk);
}
