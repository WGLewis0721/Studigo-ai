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

/** Each check gets its own source fact. A longer reading earns more checks, up to ten. */
function factOrder(sentences: string[], target: number): number[] {
  const first = sentences[target] ? target : 0;
  const rest = sentences.map((_, index) => index).filter((index) => index !== first);
  // Spread the first three checks across the passage before filling the gaps.
  const middle = rest[Math.floor((rest.length - 1) / 3)];
  const last = rest[Math.floor((rest.length - 1) * 2 / 3)];
  return [first, middle, last, ...rest].filter((index, position, order) =>
    index !== undefined && order.indexOf(index) === position);
}

function clue(sentence: string): string {
  const definition = sentence.match(/^([A-Za-z][A-Za-z\s-]{2,55})\s*[—–:]\s+.{12,}$/)?.[1]?.trim();
  if (definition) return definition;
  const condition = sentence.match(/^(?:When|If)\s+([^,]{5,70}),/i)?.[1]?.trim();
  if (condition) return condition;
  const subject = sentence.match(/^(.{4,65}?)\s+(?:is|are|was|were|can|will|must|may|should|makes?|causes?|helps?|has|have|means?|describes?|represents?|interprets?|explains?|changes?|comes?|uses?|allows?|elects?|votes?|cast)\b/i)?.[1]?.trim();
  if (subject) return subject;
  return sentence.split(/\s+/).slice(0, 5).join(" ").replace(/[.,;:!?]+$/, "");
}

function questionFor(sentence: string, boxes: boolean): string {
  const definition = sentence.match(/^([A-Za-z][A-Za-z\s-]{2,55})\s*[—–:]\s+.{12,}$/)?.[1]?.trim();
  if (definition) return `What does "${definition}" mean according to your guide?`;
  const condition = sentence.match(/^(?:When|If)\s+([^,]{5,70}),/i)?.[1]?.trim();
  if (condition) return `What happens when ${condition} according to your guide?`;
  const subject = sentence.match(/^(.{4,65}?)\s+(is|are|was|were|can|will|makes?|causes?|helps?|means?|describes?|represents?|interprets?|changes?|elects?|votes?)\b/i);
  if (subject) {
    const name = subject[1].replace(/^(The|A|An|Some|Other|Many|Most|Each|Every)\b/, (word) => word.toLowerCase());
    if (/^(is|are|was|were)$/i.test(subject[2])) return `How does your guide describe ${name}?`;
    if (/^can$/i.test(subject[2])) return `What can ${name} do according to your guide?`;
    return `What does your guide say ${name} does?`;
  }
  return boxes ? `Which source detail describes ${clue(sentence)}?`
    : `What does your guide say about ${clue(sentence)}?`;
}

function alternatives(sentences: string[], index: number, level: ExplainDelivery): string[] {
  const key = clue(sentences[index]).toLowerCase();
  const other = sentences.filter((sentence, position) => position !== index && sentence !== sentences[index]);
  return [...other.filter((sentence) => !sentence.toLowerCase().includes(key)),
    ...other.filter((sentence) => sentence.toLowerCase().includes(key))]
    .slice(0, level === "simpler" ? 2 : 3);
}

function choiceBeat(sentences: string[], index: number, level: ExplainDelivery, boxes = false): MissionBeat {
  const answer = sentences[index];
  const prompt = questionFor(answer, boxes);
  const options = alternatives(sentences, index, level);
  const slot = index % (options.length + 1);
  options.splice(slot, 0, answer);
  return boxes
    ? { kind: "boxes", prompt, options, answers: [slot] }
    : { kind: "choice", prompt, options, answer: slot };
}

function blankBeat(sentences: string[], index: number, level: ExplainDelivery): MissionBeat {
  const answer = sentences[index];
  const subject = clue(answer).toLowerCase();
  const candidateWords = contentWords(answer).filter((word) => !subject.includes(word.toLowerCase()));
  const words = candidateWords.length ? candidateWords : contentWords(answer);
  const hole = (level === "deeper"
    ? [...words].sort((a, b) => b.length - a.length)[0]
    : level === "simpler" ? [...words].sort((a, b) => a.length - b.length)[0]
      : words[Math.floor(words.length / 2)]) ?? "";
  const at = hole ? answer.toLowerCase().indexOf(hole.toLowerCase()) : -1;
  const extras = uniqueWords(alternatives(sentences, index, level).flatMap(contentWords))
    .filter((word) => word.toLowerCase() !== hole.toLowerCase()).slice(0, level === "simpler" ? 1 : 2);
  if (at < 0 || !extras.length) return choiceBeat(sentences, index, level);
  const options = [...extras];
  const wordSlot = index % (options.length + 1);
  options.splice(wordSlot, 0, answer.slice(at, at + hole.length));
  return {
    kind: "blank", prompt: `Complete your guide's idea about ${clue(answer)}.`,
    before: answer.slice(0, at), after: answer.slice(at + hole.length),
    answer: answer.slice(at, at + hole.length), options
  };
}

/** The persisted mission has four phases. Sparse sources end with a reading handoff rather than replaying a fact. */
export function missionBeats(_objective: string, sentences: string[], target: number, level: ExplainDelivery = "standard"): MissionBeat[] {
  const order = factOrder(sentences, target);
  const lead = level === "simpler" ? "Watch." : level === "deeper" ? "Notice this." : "Here it is.";
  const beats: MissionBeat[] = [{ kind: "read", title: lead, body: sentences[order[0]] ?? "" }];
  if (order.length < 2) return beats;
  beats.push(choiceBeat(sentences, order[0], level));
  beats.push(blankBeat(sentences, order[1], level));
  beats.push(order.length >= 3 ? choiceBeat(sentences, order[2], level, true)
    : { kind: "read", title: "You have covered the distinct ideas in this passage.", body: "Continue when you're ready to practice independently." });
  return beats;
}

/** Add one new fact per check; no fact is reused by another question. */
export function supplementalMissionBeats(_objective: string, sentences: string[], target: number, level: ExplainDelivery = "standard"): MissionBeat[] {
  const order = factOrder(sentences, target);
  const wordCount = sentences.join(" ").trim().split(/\s+/).length;
  const baseQuestions = Math.min(3, order.length);
  const desiredQuestions = Math.min(10, Math.max(baseQuestions, Math.ceil(wordCount / 30)));
  return order.slice(3, 3 + Math.max(0, desiredQuestions - baseQuestions))
    .map((index, position) => position % 2 === 0
      ? choiceBeat(sentences, index, level) : blankBeat(sentences, index, level));
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
    .filter(({ sentence }) => sentence.length >= 27 &&
      sentence.split(/\s+/).length >= 5 &&
      !/^(page\s*\d+|government\s*\/|study materials)/i.test(sentence));
  if (eligible.length < 2) return null;
  const candidates = eligible.filter(({ sentence }, position) => {
    const tokens = new Set(words(sentence));
    return !eligible.slice(0, position).some(({ sentence: previous }) => {
      const prior = new Set(words(previous));
      const overlap = [...tokens].filter((word) => prior.has(word)).length;
      const sameNumbers = JSON.stringify(sentence.match(/\d+/g) ?? []) === JSON.stringify(previous.match(/\d+/g) ?? []);
      return sentence.toLowerCase() === previous.toLowerCase() ||
        (sameNumbers && tokens.size >= 8 && prior.size >= 8 && overlap / Math.max(tokens.size, prior.size) >= 0.95);
    });
  }).map(({ sentence, index }) => ({ sentence, index }));
  if (candidates.length < 2) return null;
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
  // Never send extracted headings into the distractor or evidence pools.
  // Cursor and quiz generation must both use the same filtered source subset.
  return { sentences: candidates.map((candidate) => candidate.sentence),
    target: candidates.findIndex((candidate) => candidate.index === target) };
}
