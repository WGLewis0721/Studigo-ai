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

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
}

export function tapCheck(objective: string, excerpt: string): { sentences: string[]; target: number } | null {
  const sentences = sourceSentences(excerpt);
  if (sentences.length < 2) return null;
  const wanted = words(objective);
  let target = 0;
  let best = -1;
  sentences.forEach((sentence, index) => {
    const seen = words(sentence);
    const score = wanted.filter((word) => seen.some((token) => token === word || token.startsWith(word))).length;
    if (score > best) {
      best = score;
      target = index;
    }
  });
  return { sentences, target };
}
