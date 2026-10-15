/** Formative "which sentence states this?" check. Both options come from the source. */
export function sourceSentences(excerpt: string): string[] {
  return excerpt
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
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
