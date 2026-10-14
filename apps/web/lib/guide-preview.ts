import type { StudyGuideContent } from "@studigo/ai";

export function evidenceHref(roomId: string, blockKey: string) {
  return `/api/guides/source?roomId=${encodeURIComponent(roomId)}&blockKey=${encodeURIComponent(blockKey)}`;
}

export function guidePreviewModel(content: StudyGuideContent) {
  const blockKeys = new Set<string>();
  for (const chapter of content.chapters) {
    for (const ref of chapter.objectiveEvidence) blockKeys.add(ref.blockKey);
    for (const item of [...chapter.facts, ...chapter.terms, ...chapter.examples, ...chapter.practice, ...chapter.answers]) {
      for (const ref of item.evidence) blockKeys.add(ref.blockKey);
    }
  }
  return {
    title: content.chapters[0]?.title ?? "Study guide",
    level: content.level,
    version: content.schemaVersion,
    sourceCount: blockKeys.size,
    chapters: content.chapters.map((chapter) => ({
      title: chapter.title,
      facts: chapter.facts.map((fact) => fact.text),
      terms: chapter.terms.map((term) => ({ term: term.term, definition: term.definition })),
      examples: chapter.examples.map((example) => example.text),
      practice: chapter.practice.map((question) => question.prompt),
      answers: chapter.answers.map((answer) => answer.text)
    }))
  };
}
