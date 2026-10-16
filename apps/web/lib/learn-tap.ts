/** Formative "which line states this?" check. Both options come from the source. */
const LABEL = /^(who|where|what|when|why|job)\??$/i;

export function sourceSentences(excerpt: string): string[] {
  const lines = excerpt
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (LABEL.test(line) && lines[index + 1]) {
      const prompt = line.endsWith("?") ? line : `${line}?`;
      merged.push(`${prompt} ${lines[index + 1]}`);
      index += 1;
      continue;
    }
    merged.push(line);
  }
  return merged.filter((line) => line.length > 12);
}

export type ExplainDelivery = "simpler" | "standard" | "deeper";

export type MissionBeat =
  | { kind: "read"; title: string; body: string }
  | { kind: "choice"; prompt: string; options: string[]; answer: number }
  | { kind: "blank"; prompt: string; before: string; after: string; answer: string; options: string[] }
  | { kind: "boxes"; prompt: string; options: string[]; answers: number[] };

const STOP = new Set(["that", "this", "with", "from", "your", "have", "been", "they", "their", "them", "what", "when", "where", "which", "about", "into", "than", "then", "some", "other", "does", "make", "made"]);

function contentWords(text: string): string[] {
  return text.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word.toLowerCase()));
}

function uniqueWords(words: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(word);
  }
  return kept;
}

/** A short tutorial from one passage. Facts stay the source lines. Level changes only the prompt. */
export function missionBeats(objective: string, sentences: string[], target: number, level: ExplainDelivery = "standard"): MissionBeat[] {
  const title = objective.trim() || "This idea";
  const safeTarget = sentences[target] ? target : 0;
  const answer = sentences[safeTarget] ?? title;
  const lead = level === "simpler" ? "Watch." : level === "deeper" ? "Notice this." : "Here it is.";
  const beats: MissionBeat[] = [{ kind: "read", title: lead, body: answer }];
  if (sentences.length < 2) return beats;

  // The extraction contains page titles and headings as well as facts.
  // A heading is not a reasonable competing answer to a definition question.
  const distractors = sentences.filter((sentence, index) =>
    index !== safeTarget && sentence.split(/\s+/).length >= 5 && sentence.length >= 30
  );
  const concept = answer.match(/^([A-Za-z][A-Za-z\s-]{2,55})\s*[—–:]\s+.{12,}$/)?.[1]?.trim();
  const question = concept
    ? `What does "${concept}" mean?`
    : /^\s*(who|what|which|where|when|why|how)\b/i.test(objective)
      ? objective.trim().replace(/[.]+$/, "?")
      : `Which statement from your guide explains "${objective.trim() || "this concept"}"?`;
  const choicePool = distractors.slice(0, level === "simpler" ? 2 : 3);
  const slot = safeTarget % (choicePool.length + 1);
  const options = [...choicePool];
  options.splice(slot, 0, answer);
  beats.push({
    kind: "choice",
    prompt: question,
    options,
    answer: slot,
  });

  const words = contentWords(answer);
  const hole = (level === "deeper"
    ? [...words].sort((a, b) => b.length - a.length)[0]
    : level === "simpler"
      ? [...words].sort((a, b) => a.length - b.length)[0]
      : words[0]) ?? "";
  const at = hole ? answer.toLowerCase().indexOf(hole.toLowerCase()) : -1;
  const extras = uniqueWords(distractors.flatMap(contentWords)).filter((word) => word.toLowerCase() !== hole.toLowerCase()).slice(0, level === "simpler" ? 1 : 2);
  if (at >= 0 && extras.length) {
    const wordSlot = safeTarget % (extras.length + 1);
    const wordOptions = [...extras];
    wordOptions.splice(wordSlot, 0, answer.slice(at, at + hole.length));
    beats.push({
      kind: "blank",
      prompt: level === "simpler" ? "Tap the missing word." : level === "deeper" ? "Complete the line." : "Fill the gap.",
      before: answer.slice(0, at),
      after: answer.slice(at + hole.length),
      answer: answer.slice(at, at + hole.length),
      options: wordOptions,
    });
  }

  const boxOptions = sentences.slice(0, Math.min(sentences.length, level === "simpler" ? 3 : 4));
  let boxTarget = boxOptions.indexOf(answer);
  if (boxTarget < 0) {
    boxOptions[boxOptions.length - 1] = answer;
    boxTarget = boxOptions.length - 1;
  }
  const wanted = new Set(contentWords(objective).map((word) => word.toLowerCase()));
  const hits = boxOptions
    .map((line, index) => index === boxTarget || contentWords(line).some((word) => wanted.has(word.toLowerCase())))
    .map((hit, index) => hit ? index : -1)
    .filter((index) => index >= 0);
  beats.push({
    kind: "boxes",
    prompt: level === "simpler" ? "Tap every one that fits." : level === "deeper" ? "Mark every line that counts." : "Mark the ones that count.",
    options: boxOptions,
    answers: hits.length && hits.length < boxOptions.length ? hits : [boxTarget],
  });
  return beats;
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
}

export function tapCheck(objective: string, excerpt: string): { sentences: string[]; target: number } | null {
  const sentences = sourceSentences(excerpt);
  if (sentences.length < 2) return null;
  const wanted = words(objective);
  // Prefer meaningful explanatory passages over long OCR headers or contents
  // lines. If the objective is a generic chapter title, choose a real factual
  // sentence, not the matching title itself.
  const eligible = sentences.map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => sentence.length >= 35 &&
      sentence.split(/\s+/).length >= 7 &&
      !/^(page\s*\d+|government\s*\/|study materials)/i.test(sentence));
  if (eligible.length < 2) return null;
  const candidates = eligible.map(({ sentence, index }) => ({ sentence, index }));
  let target = 0;
  let best = -1;
  candidates.forEach(({ sentence, index }) => {
    const seen = words(sentence);
    const score = wanted.filter((word) => seen.some((token) => token === word || token.startsWith(word))).length;
    const isDefinition = /[—–:]\s+[a-z]/i.test(sentence);
    const isStatement = /[.!?]$/.test(sentence);
    const quality = score * 10 + (isDefinition ? 3 : 0) + (isStatement ? 1 : 0);
    if (quality > best) {
      best = quality;
      target = index;
    }
  });
  return { sentences, target };
}
