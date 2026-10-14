export const GUIDE_SCHEMA_VERSION = 1;
export const GUIDE_PROMPT_VERSION = 1;

export type GuideSourceBlock = {
  blockKey: string;
  pageNumber: number;
  text: string;
  kind?: string;
};

export type EvidenceRef = { blockKey: string; pageNumber: number };

export type GuideFact = { id: string; text: string; evidence: EvidenceRef[] };
export type GuideTerm = { id: string; term: string; definition: string; evidence: EvidenceRef[] };
export type GuideExample = { id: string; text: string; evidence: EvidenceRef[] };
export type GuideQuestion = { id: string; prompt: string; answerId: string; evidence: EvidenceRef[] };
export type GuideAnswer = { id: string; questionId: string; text: string; evidence: EvidenceRef[] };

export type GuideChapter = {
  id: string;
  title: string;
  objective: string;
  objectiveEvidence: EvidenceRef[];
  facts: GuideFact[];
  terms: GuideTerm[];
  examples: GuideExample[];
  practice: GuideQuestion[];
  answers: GuideAnswer[];
};

export type StudyGuideContent = {
  version: 1;
  schemaVersion: number;
  promptVersion: number;
  level: string;
  roomId: string;
  topicIds: string[];
  sourceSnapshot: string;
  chapters: GuideChapter[];
};

export type GuideBuildResult =
  | { status: "ready"; content: StudyGuideContent }
  | { status: "unsupported"; reason: string };

const CHAPTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "facts", "terms", "examples"],
  properties: {
    title: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
    terms: { type: "array", items: { type: "object", additionalProperties: false, required: ["term", "definition"], properties: { term: { type: "string" }, definition: { type: "string" } } } },
    examples: { type: "array", items: { type: "string" } }
  }
};

/** Live generation stays off unless an operator enables it. Tests never set this. */
export async function generateChapterWithProvider(blocks: GuideSourceBlock[], repair?: string) {
  if (process.env.STUDIGO_GUIDE_GENERATION !== "1") {
    return { refused: "generation_not_enabled" as const };
  }
  const { structured } = await import("./study");
  return structured<unknown>({
    schemaName: "guide_chapter",
    schema: CHAPTER_SCHEMA,
    system: "Use only the supplied study material. Do not add outside facts. If a fact is missing, omit it.",
    user: JSON.stringify({ repair: repair ?? null, blocks: blocks.map((block) => ({ id: block.blockKey, page: block.pageNumber, text: block.text })) })
  });
}

function snapshot(blocks: GuideSourceBlock[]) {
  return blocks.map((block) => `${block.blockKey}:${block.text}`).join("|");
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter((part) => part.length > 12);
}

function cite(block: GuideSourceBlock): EvidenceRef[] {
  return [{ blockKey: block.blockKey, pageNumber: block.pageNumber }];
}

function isHeading(block: GuideSourceBlock) {
  return block.kind === "heading" || (block.text.length < 80 && !/[.!?]$/.test(block.text) && block.kind !== "term" && block.kind !== "table");
}

export function composeChapters(blocks: GuideSourceBlock[]): GuideChapter[] {
  const groups: Array<{ title: string; evidence: EvidenceRef[]; blocks: GuideSourceBlock[] }> = [];
  let current = { title: "Study guide", evidence: [] as EvidenceRef[], blocks: [] as GuideSourceBlock[] };
  for (const block of blocks) {
    if (isHeading(block)) {
      if (current.blocks.length) groups.push(current);
      current = { title: block.text.replace(/^#+\s*/, ""), evidence: cite(block), blocks: [] };
    } else {
      current.blocks.push(block);
      if (!current.evidence.length) current.evidence = cite(block);
    }
  }
  if (current.blocks.length) groups.push(current);

  return groups.map((group, index) => {
    const facts: GuideFact[] = [];
    const terms: GuideTerm[] = [];
    const examples: GuideExample[] = [];
    const practice: GuideQuestion[] = [];
    const answers: GuideAnswer[] = [];
    for (const block of group.blocks) {
      if (block.kind === "term" || /^[^:\n]{2,40}\s[-:]\s+\S/.test(block.text)) {
        const split = block.text.split(/\s[-:]\s/);
        const term = split[0]?.trim();
        const definition = split.slice(1).join(" - ").trim();
        if (!term || !definition || !block.text.includes(definition)) continue;
        const id = `term-${terms.length + 1}`;
        terms.push({ id, term, definition, evidence: cite(block) });
        const answerId = `answer-term-${id}`;
        const questionId = `question-${id}`;
        answers.push({ id: answerId, questionId, text: definition, evidence: cite(block) });
        practice.push({ id: questionId, prompt: `What is ${term}?`, answerId, evidence: cite(block) });
        continue;
      }
      for (const sentence of sentences(block.text)) {
        if (!block.text.includes(sentence)) continue;
        if (/^for example\b/i.test(sentence)) {
          examples.push({ id: `example-${examples.length + 1}`, text: sentence, evidence: cite(block) });
          continue;
        }
        const factId = `fact-${facts.length + 1}`;
        facts.push({ id: factId, text: sentence, evidence: cite(block) });
        const branch = sentence.match(/^The ([A-Za-z]+) branch\b/i);
        if (branch) {
          const answerId = `answer-${factId}`;
          const questionId = `question-${factId}`;
          answers.push({ id: answerId, questionId, text: sentence, evidence: cite(block) });
          practice.push({
            id: questionId,
            prompt: `What does the ${branch[1].toLowerCase()} branch do?`,
            answerId,
            evidence: cite(block)
          });
        }
      }
    }
    return {
      id: `chapter-${index + 1}`,
      title: group.title,
      objective: group.title,
      objectiveEvidence: group.evidence,
      facts,
      terms,
      examples,
      practice,
      answers
    };
  }).filter((chapter) => chapter.facts.length || chapter.terms.length);
}

export function validateGuideContent(content: StudyGuideContent, blocks: GuideSourceBlock[]): string | null {
  if (content.version !== 1 || content.schemaVersion !== GUIDE_SCHEMA_VERSION) return "schema";
  if (!content.chapters.length) return "no_chapters";
  const byKey = new Map(blocks.map((block) => [block.blockKey, block]));
  const seenTerms = new Set<string>();
  const seenQuestions = new Set<string>();
  const grounded = (text: string, evidence: EvidenceRef[]) => {
    if (!text.trim() || !evidence.length) return false;
    return evidence.every((ref) => {
      const block = byKey.get(ref.blockKey);
      return Boolean(block && block.pageNumber === ref.pageNumber && block.text.toLowerCase().includes(text.toLowerCase()));
    });
  };
  for (const chapter of content.chapters) {
    if (!grounded(chapter.objective, chapter.objectiveEvidence)) return "objective";
    for (const fact of chapter.facts) if (!grounded(fact.text, fact.evidence)) return "fact";
    for (const term of chapter.terms) {
      const key = term.term.toLowerCase();
      if (seenTerms.has(key)) return "duplicate_term";
      seenTerms.add(key);
      if (!grounded(term.definition, term.evidence)) return "term";
    }
    for (const example of chapter.examples) if (!grounded(example.text, example.evidence)) return "example";
    const answers = new Map(chapter.answers.map((answer) => [answer.id, answer]));
    for (const question of chapter.practice) {
      if (seenQuestions.has(question.prompt.toLowerCase())) return "duplicate_question";
      seenQuestions.add(question.prompt.toLowerCase());
      const answer = answers.get(question.answerId);
      if (!answer || answer.questionId !== question.id || !grounded(answer.text, answer.evidence)) return "answer";
    }
  }
  return null;
}

export function editionKey(input: { roomId: string; level: string; topicIds: string[]; blocks: GuideSourceBlock[] }) {
  return [
    GUIDE_SCHEMA_VERSION,
    GUIDE_PROMPT_VERSION,
    input.roomId,
    input.level,
    [...input.topicIds].sort().join(","),
    snapshot(input.blocks)
  ].join("#");
}

export function assembleGuide(input: {
  roomId: string;
  level: string;
  topicIds: string[];
  blocks: GuideSourceBlock[];
  chapters: GuideChapter[];
}): StudyGuideContent {
  return {
    version: 1,
    schemaVersion: GUIDE_SCHEMA_VERSION,
    promptVersion: GUIDE_PROMPT_VERSION,
    level: input.level,
    roomId: input.roomId,
    topicIds: input.topicIds,
    sourceSnapshot: snapshot(input.blocks),
    chapters: input.chapters
  };
}

export async function generateGroundedEdition(input: {
  roomId: string;
  level: string;
  topicIds: string[];
  blocks: GuideSourceBlock[];
  generate?: (blocks: GuideSourceBlock[], repair?: string) => Promise<GuideChapter[] | { refused: string }>;
}): Promise<GuideBuildResult> {
  if (!input.blocks.length) return { status: "unsupported", reason: "no_sources" };
  const generate = input.generate ?? (async (blocks: GuideSourceBlock[]) => composeChapters(blocks));
  let repair: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const drafted = await generate(input.blocks, repair);
    if (!Array.isArray(drafted)) return { status: "unsupported", reason: drafted.refused || "refused" };
    const content = assembleGuide({ ...input, chapters: drafted });
    const problem = validateGuideContent(content, input.blocks);
    if (!problem) return { status: "ready", content };
    repair = problem;
  }
  return { status: "unsupported", reason: repair ?? "invalid" };
}

/** Same factual object the preview and download paths should render. */
export function renderGuideFacts(content: StudyGuideContent) {
  return content.chapters.flatMap((chapter) => chapter.facts.map((fact) => fact.text));
}
