/** Cross-surface freshness. Historical rows stay; only current membership and revision are teachable. */

export type SourceMember = {
  id: string;
  revision: number;
  present: boolean;
};

export type Corpus = {
  revision: number;
  sources: SourceMember[];
};

export type Fact = {
  id: string;
  sourceId: string;
  sourceRevision: number;
  text: string;
};

export type Surface = "lesson" | "coach" | "guide";

export type GuideEdition = {
  key: string;
  corpusRevision: number;
  facts: Fact[];
};

export type GuideReading = {
  reading: GuideEdition | null;
  candidate: GuideEdition | null;
  updateAvailable: boolean;
  /** True when the open edition is no longer the current corpus. The key stays. */
  stale: boolean;
};

export type SearchIndex = {
  corpusRevision: number;
  facts: Fact[];
};

export type LearningEvidence = {
  receipts: readonly string[];
  mastery: number;
  messages: readonly { id: string; text: string }[];
};

export type PendingChallenge = {
  evidenceRevision: number;
  sourceId: string;
  sourceRevision: number;
  factText: string;
};

type EvidenceRef = { blockKey: string };

export function initialCorpus(ids: readonly string[]): Corpus {
  return {
    revision: 1,
    sources: ids.map((id) => ({ id, revision: 1, present: true }))
  };
}

export function factIsCurrent(corpus: Corpus, fact: Fact): boolean {
  const source = corpus.sources.find((item) => item.id === fact.sourceId);
  return Boolean(source?.present && source.revision === fact.sourceRevision);
}

export function selectCurrentFacts(corpus: Corpus, facts: readonly Fact[]): Fact[] {
  return facts.filter((fact) => factIsCurrent(corpus, fact));
}

export function surfaceSelections(corpus: Corpus, facts: readonly Fact[]): Record<Surface, Fact[]> {
  const current = selectCurrentFacts(corpus, facts);
  return { lesson: current, coach: current, guide: current };
}

/** A citation on an old chat row can be labeled obsolete. It cannot ground a new answer. */
export function historicalCitation(corpus: Corpus, fact: Fact): { label: "current" | "obsolete"; canReground: boolean } {
  if (factIsCurrent(corpus, fact)) return { label: "current", canReground: true };
  return { label: "obsolete", canReground: false };
}

export function authenticatedExport(corpus: Corpus, cached: readonly Fact[]): { allowed: Fact[]; denied: Fact[] } {
  const allowed: Fact[] = [];
  const denied: Fact[] = [];
  for (const fact of cached) {
    if (factIsCurrent(corpus, fact)) allowed.push(fact);
    else denied.push(fact);
  }
  return { allowed, denied };
}

function replaceMember(corpus: Corpus, sourceId: string, nextRevision: number): Corpus | null {
  const source = corpus.sources.find((item) => item.id === sourceId && item.present);
  if (!source || source.revision === nextRevision) return null;
  return {
    revision: corpus.revision + 1,
    sources: corpus.sources.map((item) => item.id === sourceId ? { ...item, revision: nextRevision, present: true } : item)
  };
}

function removeMember(corpus: Corpus, sourceId: string): Corpus | null {
  const source = corpus.sources.find((item) => item.id === sourceId && item.present);
  if (!source) return null;
  return {
    revision: corpus.revision + 1,
    sources: corpus.sources.map((item) => item.id === sourceId ? { ...item, present: false } : item)
  };
}

function withCandidate(reading: GuideReading, corpus: Corpus, facts: readonly Fact[]): GuideReading {
  if (!reading.reading) {
    return {
      reading: { key: `edition-r${corpus.revision}`, corpusRevision: corpus.revision, facts: [...facts] },
      candidate: null,
      updateAvailable: false,
      stale: false
    };
  }
  return {
    reading: reading.reading,
    candidate: {
      key: `${reading.reading.key}:r${corpus.revision}`,
      corpusRevision: corpus.revision,
      facts: [...facts]
    },
    updateAvailable: true,
    stale: true
  };
}

export function applySuccessfulReplace(input: {
  corpus: Corpus;
  sourceId: string;
  nextRevision: number;
  facts: readonly Fact[];
  index: SearchIndex;
  reading: GuideReading;
  evidence: LearningEvidence;
}): {
  corpus: Corpus;
  selections: Record<Surface, Fact[]>;
  index: SearchIndex;
  reading: GuideReading;
  evidence: LearningEvidence;
} {
  const corpus = replaceMember(input.corpus, input.sourceId, input.nextRevision) ?? input.corpus;
  const selections = surfaceSelections(corpus, input.facts);
  return {
    corpus,
    selections,
    index: { corpusRevision: corpus.revision, facts: selections.lesson },
    reading: corpus === input.corpus ? input.reading : withCandidate(input.reading, corpus, selections.guide),
    evidence: input.evidence
  };
}

export function applySourceDeletion(input: {
  corpus: Corpus;
  sourceId: string;
  facts: readonly Fact[];
  index: SearchIndex;
  reading: GuideReading;
  evidence: LearningEvidence;
}): {
  corpus: Corpus;
  selections: Record<Surface, Fact[]>;
  index: SearchIndex;
  reading: GuideReading;
  evidence: LearningEvidence;
} {
  const corpus = removeMember(input.corpus, input.sourceId) ?? input.corpus;
  const selections = surfaceSelections(corpus, input.facts);
  return {
    corpus,
    selections,
    index: { corpusRevision: corpus.revision, facts: selections.lesson },
    reading: corpus === input.corpus ? input.reading : withCandidate(input.reading, corpus, selections.guide),
    evidence: input.evidence
  };
}

/** Failed refresh keeps the previous corpus, edition, and index. It does not mark them stale. */
export function applyFailedRefresh<T extends {
  corpus: Corpus;
  index: SearchIndex;
  reading: GuideReading;
  evidence: LearningEvidence;
}>(state: T): T & { invalidated: false } {
  return {
    corpus: state.corpus,
    index: state.index,
    reading: state.reading,
    evidence: state.evidence,
    invalidated: false
  };
}

export function awardForPendingChallenge(input: {
  corpus: Corpus;
  challenge: PendingChallenge;
  currentFacts: readonly Fact[];
  evidence: LearningEvidence;
}): { awardMastery: boolean; evidence: LearningEvidence; offer: Fact | null } {
  const source = input.corpus.sources.find((item) => item.id === input.challenge.sourceId);
  const current = Boolean(
    source?.present
    && source.revision === input.challenge.sourceRevision
    && input.challenge.evidenceRevision === input.corpus.revision
  );
  if (current) return { awardMastery: true, evidence: input.evidence, offer: null };
  const offer = input.currentFacts.find((fact) => factIsCurrent(input.corpus, fact) && fact.text !== input.challenge.factText) ?? null;
  return { awardMastery: false, evidence: input.evidence, offer };
}

export function chooseReadingEdition<T extends { key: string }>(readingKey: string | null, editions: readonly T[]): T | null {
  if (readingKey) return editions.find((edition) => edition.key === readingKey) ?? null;
  return editions[0] ?? null;
}

export function revisionStamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** Live retrieval already carries the active revision. A cached chunk must name that same revision. */
export function selectFreshChunks<T extends { id: string; documentId: string; sourceRevision?: number | null }>(
  sources: ReadonlyArray<{ id: string; revision: number | null; present?: boolean }>,
  chunks: readonly T[]
): T[] {
  const corpus: Corpus = {
    revision: 1,
    sources: sources.filter((source) => source.present !== false).map((source) => ({
      id: source.id,
      revision: source.revision ?? 0,
      present: true
    }))
  };
  return chunks.filter((chunk) => {
    const source = corpus.sources.find((item) => item.id === chunk.documentId);
    if (!source) return false;
    if (chunk.sourceRevision == null) return true;
    return factIsCurrent(corpus, {
      id: chunk.id,
      sourceId: chunk.documentId,
      sourceRevision: chunk.sourceRevision,
      text: ""
    });
  });
}

export function selectCurrentBlocks<T extends { documentId: string; revision: number }>(
  documents: ReadonlyArray<{ id: string; revision: number | null }>,
  blocks: readonly T[]
): T[] {
  const revisions = new Map(documents.map((document) => [document.id, document.revision]));
  return blocks.filter((block) => {
    if (!revisions.has(block.documentId)) return false;
    const revision = revisions.get(block.documentId);
    return revision == null || revision === block.revision;
  });
}

export function currentBlockKeySet(
  documents: ReadonlyArray<{ id: string; revision: number | null }>,
  blocks: ReadonlyArray<{ documentId: string; revision: number; blockKey: string }>
): Set<string> {
  const current = selectCurrentBlocks(documents, blocks);
  return new Set(current.map((block) => block.blockKey));
}

function evidenceCurrent(evidence: readonly EvidenceRef[] | undefined, currentKeys: ReadonlySet<string>): boolean {
  const keys = evidence ?? [];
  if (!keys.length) return true;
  return keys.every((ref) => currentKeys.has(ref.blockKey));
}

/** New export copy. The stored reading edition is not rewritten. */
export function filterGuideEditionExport<T extends {
  sourceSnapshot: string;
  chapters: Array<{
    objective: string;
    objectiveEvidence: EvidenceRef[];
    facts: Array<{ text: string; evidence: EvidenceRef[] }>;
    terms: Array<{ definition: string; evidence: EvidenceRef[] }>;
    examples: Array<{ text: string; evidence: EvidenceRef[] }>;
    practice: Array<{ id: string; answerId: string; evidence: EvidenceRef[] }>;
    answers: Array<{ id: string; questionId: string; text: string; evidence: EvidenceRef[] }>;
  }>;
}>(content: T, currentKeys: ReadonlySet<string>): T | null {
  if (!content || !Array.isArray(content.chapters)) return null;
  const cited = content.chapters.some((chapter) =>
    (chapter.facts ?? []).some((fact) => fact.evidence?.length)
    || (chapter.terms ?? []).some((term) => term.evidence?.length)
    || (chapter.examples ?? []).some((example) => example.evidence?.length)
    || (chapter.practice ?? []).some((question) => question.evidence?.length)
    || (chapter.answers ?? []).some((answer) => answer.evidence?.length)
    || (chapter.objectiveEvidence ?? []).length
  );
  if (!cited) return content;
  if (!currentKeys.size) return null;
  const chapters = content.chapters.map((chapter) => {
    const facts = (chapter.facts ?? []).filter((fact) => evidenceCurrent(fact.evidence, currentKeys));
    const terms = (chapter.terms ?? []).filter((term) => evidenceCurrent(term.evidence, currentKeys));
    const examples = (chapter.examples ?? []).filter((example) => evidenceCurrent(example.evidence, currentKeys));
    const practice = (chapter.practice ?? []).filter((question) => evidenceCurrent(question.evidence, currentKeys));
    const practiceIds = new Set(practice.map((question) => question.id));
    const answers = (chapter.answers ?? []).filter((answer) => practiceIds.has(answer.questionId) && evidenceCurrent(answer.evidence, currentKeys));
    const answerIds = new Set(answers.map((answer) => answer.id));
    const pairedPractice = practice.filter((question) => answerIds.has(question.answerId));
    const pairedIds = new Set(pairedPractice.map((question) => question.id));
    const objectiveOk = evidenceCurrent(chapter.objectiveEvidence ?? [], currentKeys);
    return {
      ...chapter,
      objective: objectiveOk ? chapter.objective : "",
      objectiveEvidence: objectiveOk ? chapter.objectiveEvidence : [],
      facts,
      terms,
      examples,
      practice: pairedPractice,
      answers: answers.filter((answer) => pairedIds.has(answer.questionId))
    };
  }).filter((chapter) => chapter.facts.length || chapter.terms.length || chapter.examples.length || chapter.practice.length);
  if (!chapters.length) return null;
  const kept = chapters.flatMap((chapter) => [
    ...chapter.facts.map((fact) => fact.text),
    ...chapter.terms.map((term) => term.definition),
    ...chapter.examples.map((example) => example.text),
    ...chapter.answers.map((answer) => answer.text)
  ]);
  return { ...content, sourceSnapshot: kept.join("|"), chapters } as T;
}
