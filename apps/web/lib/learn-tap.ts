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

/** Headings, page labels and OCR fragments are valid source text but invalid
 * practice choices. Never assert that a section heading answers a question. */
export function factualSourceLine(line: string): boolean {
  const value = line.trim();
  if (value.length < 27 || value.length > 280) return false;
  if (/^page\s+\d+\b/i.test(value) || /^[A-Z\s/]+$/.test(value)) return false;
  return value.split(/\s+/).length >= 5;
}
function definedTerm(text: string): string | null {
  const match = text.match(/^([a-z][a-z\s-]{2,48})\s*(?:—|–|:|\bis\b|\bmeans\b)\s+\S/i);
  const term = match?.[1]?.trim();
  return term && term.split(/\s+/).length <= 5 ? term.toLowerCase() : null;
}
function clearChoiceQuestion(objective: string, answer: string): string {
  const term = definedTerm(answer);
  if (term) return `Which line from your guide explains what ${term} means?`;
  const subject = objective.trim().replace(/[.!?]+$/, "").slice(0, 100);
  return subject
    ? `Which line in your guide helps explain: ${subject}?`
    : "Which source statement matches the idea you just read?";
}

/** A short tutorial from one passage. Facts stay the source lines. Level changes only the prompt. */
export function missionBeats(objective: string, sentences: string[], target: number, level: ExplainDelivery = "standard"): MissionBeat[] {
  const usable = sentences.filter(factualSourceLine);
  // The mission database advances through four teaching phases. Never repeat
  // a clamped activity when the excerpt lacks enough distinct source facts.
  if (usable.length < 2) return [];
  const answer = sentences[target] && factualSourceLine(sentences[target])
    ? sentences[target] : usable[0];
  const distractors = usable.filter((line) => line !== answer);
  const choicePool = distractors.slice(0, level === "simpler" ? 2 : 3);
  const slot = usable.indexOf(answer) % (choicePool.length + 1);
  const options = [...choicePool];
  options.splice(slot, 0, answer);

  const readTitle = level === "simpler" ? "Read this source fact." :
    level === "deeper" ? "Let's examine the evidence." : "First, read this fact.";
  const beats: MissionBeat[] = [
    { kind: "read", title: readTitle, body: answer },
    {
      kind: "choice",
      prompt: clearChoiceQuestion(objective, answer),
      options,
      answer: slot,
    },
  ];

  // Exactly one word is missing, and every option comes from the authorized
  // excerpt. An alternate word from the same source statement is still
  // source-derived when the distractor lines contain no suitable candidate.
  const words = contentWords(answer);
  const hole = (level === "deeper"
    ? [...words].sort((a, b) => b.length - a.length)[0]
    : level === "simpler"
      ? [...words].sort((a, b) => a.length - b.length)[0]
      : words[0]) ?? "";
  const at = hole ? answer.toLowerCase().indexOf(hole.toLowerCase()) : -1;
  const extras = uniqueWords([...distractors.flatMap(contentWords),
    ...words.filter((word) => word.toLowerCase() !== hole.toLowerCase())])
    .filter((word) => word.toLowerCase() !== hole.toLowerCase()).slice(0, level === "simpler" ? 1 : 2);
  if (at < 0 || extras.length < 1) return [];
  const wordSlot = usable.indexOf(answer) % (extras.length + 1);
  const wordOptions = [...extras];
  wordOptions.splice(wordSlot, 0, answer.slice(at, at + hole.length));
  beats.push({
    kind: "blank",
    prompt: "Which word completes the sentence from your guide?",
    before: answer.slice(0, at),
    after: answer.slice(at + hole.length),
    answer: answer.slice(at, at + hole.length),
    options: wordOptions,
  });

  const boxOptions = usable.slice(0, Math.min(usable.length, level === "simpler" ? 3 : 4));
  let boxTarget = boxOptions.indexOf(answer);
  if (boxTarget < 0) {
    boxOptions[boxOptions.length - 1] = answer;
    boxTarget = boxOptions.length - 1;
  }
  const term = definedTerm(answer);
  const wanted = term ? term.split(/\s+/) :
    contentWords(objective).map((word) => word.toLowerCase());
  const hits = boxOptions
    .map((line, index) => index === boxTarget || (
      wanted.length > 0 && wanted.every((word) =>
        line.toLowerCase().includes(word.toLowerCase()))
    ))
    .map((hit, index) => hit ? index : -1)
    .filter((index) => index >= 0);
  beats.push({
    kind: "boxes",
    prompt: term
      ? `Which lines in your guide describe ${term}?`
      : "Which lines provide evidence for the fact you learned?",
    options: boxOptions,
    answers: hits,
  });
  return beats;
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
}

export function tapCheck(objective: string, excerpt: string): { sentences: string[]; target: number } | null {
  const sentences = sourceSentences(excerpt);
  if (sentences.filter(factualSourceLine).length < 2) return null;
  const wanted = words(objective);
  let target = 0;
  let best = -1;
  sentences.forEach((sentence, index) => {
    if (!factualSourceLine(sentence)) return;
    const seen = words(sentence);
    const score = wanted.filter((word) => seen.some((token) => token === word || token.startsWith(word))).length;
    if (score > best) {
      best = score;
      target = index;
    }
  });
  return { sentences, target };
}
