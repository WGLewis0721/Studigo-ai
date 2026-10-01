// ---------------------------------------------------------------------------
// Reading what a learner meant, not only what they typed.
//
// Everything here is deterministic and cheap, so it can run on every turn and
// inside grading without a model call. It is used three ways, each with its own
// strictness because the cost of a wrong guess differs:
//
//  - wordsMatch: loose, for ranking ("which question is this reply about?").
//    A wrong guess costs nothing because the caller shows the model the rest.
//  - termMatch: strict, for grading a typed term. A wrong guess would credit a
//    different term, so short words must be exact and numbers never bend.
//  - repairCommandTypos: for spotting a request such as "hint" or "show the
//    answer". Only a closed list of command words is ever repaired, and only in
//    short messages, so a real answer is never rewritten into a command.
// ---------------------------------------------------------------------------

/** Damerau-Levenshtein distance (optimal string alignment): an edit, a gap or a swapped pair is one step. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) table[i][0] = i;
  for (let j = 0; j < cols; j += 1) table[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        table[i][j] = Math.min(table[i][j], table[i - 2][j - 2] + 1);
      }
    }
  }
  return table[a.length][b.length];
}

/**
 * Loose match: equal, a slight misspelling (one edit in a short word, two in a long one), or one
 * shared stem such as evaporate and evaporation. Words of three letters or fewer must match
 * exactly, because one edit changes them into other words. For ranking only, never for grading.
 */
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shortest = Math.min(a.length, b.length);
  if (shortest < 4) return false;

  let prefix = 0;
  while (prefix < shortest && a[prefix] === b[prefix]) prefix += 1;
  if (prefix >= 5 && prefix >= Math.ceil(shortest * 0.7)) return true;

  const allowed = Math.max(a.length, b.length) >= 8 ? 2 : 1;
  return Math.abs(a.length - b.length) <= allowed && editDistance(a, b) <= allowed;
}

// --- Grading ------------------------------------------------------------------

/**
 * Is `answer` a typo of `target`, for grading? Strict on purpose: crediting a different term as
 * a typo would corrupt the learner's own record.
 *  - Words of four letters or fewer, and anything containing a digit, must be exact.
 *  - Five to eleven letters allow one edit. Twelve or more allow two, but only when the first
 *    three letters agree, so near-opposites such as endothermic and exothermic stay apart.
 * Inputs are expected to be normalized (lowercase, no punctuation).
 */
export function typoOfWord(answer: string, target: string): boolean {
  if (answer === target) return true;
  if (/\d/.test(answer) || /\d/.test(target)) return false;
  if (Math.min(answer.length, target.length) < 5) return false;

  const longest = Math.max(answer.length, target.length);
  const allowed = longest >= 12 ? 2 : 1;
  if (allowed === 2 && answer.slice(0, 3) !== target.slice(0, 3) && editDistance(answer, target) > 1) return false;
  return Math.abs(answer.length - target.length) <= allowed && editDistance(answer, target) <= allowed;
}

export type TermMatch = "exact" | "typo" | null;

/**
 * Compares a typed answer with an accepted term, word by word, allowing misspellings and
 * run-together or split words ("watercycle", "photo synthesis"). Both inputs are normalized.
 * At most two words of a multi-word term may carry a typo.
 */
export function termMatch(answer: string, target: string): TermMatch {
  if (!answer || !target) return null;
  if (answer === target) return "exact";
  if (answer.replace(/\s/g, "") === target.replace(/\s/g, "")) return "exact";

  const answerWords = answer.split(" ");
  const targetWords = target.split(" ");
  if (answerWords.length === targetWords.length) {
    let typos = 0;
    let allMatch = true;
    for (let index = 0; index < targetWords.length; index += 1) {
      if (answerWords[index] === targetWords[index]) continue;
      if (typoOfWord(answerWords[index], targetWords[index])) typos += 1;
      else {
        allMatch = false;
        break;
      }
    }
    if (allMatch && typos > 0 && typos <= 2) return "typo";
  }

  // A merged or split word changes the word count: compare the run-together forms.
  if (answerWords.length !== targetWords.length && typoOfWord(answer.replace(/\s/g, ""), target.replace(/\s/g, ""))) {
    return "typo";
  }
  return null;
}

/**
 * The words people put in front of or after an answer without meaning them as part of it:
 * "it's condensation", "I think evaporation", "condensation maybe". Takes a normalized answer.
 */
export function stripAnswerFiller(normalized: string): string {
  return normalized
    .replace(
      /^(?:(?:i\s+)?(?:think|guess|believe|say|would\s+say)\s+)?(?:maybe\s+|probably\s+|perhaps\s+)?(?:(?:it\s+is|it\s+s|its|that\s+is|that\s+s|this\s+is|they\s+are)\s+)?(?:the\s+answer\s+is\s+|answer\s+is\s+)?/,
      ""
    )
    .replace(/\s+(?:maybe|i\s+think|i\s+guess|probably|perhaps)$/, "")
    .trim();
}

// --- Commands -------------------------------------------------------------------

/** Real words that sit one letter from a command word and must never be "repaired" into it. */
const PROTECTED_WORDS = new Set([
  "stick", "struck", "stock", "stack", "steak", "sticks", "sticky", "shorten", "shorts", "simple", "repeal", "pleased"
]);

/**
 * A command word, as typed, matches the vocabulary word when it is a swapped pair (any length
 * of four or more), or, at five letters or more, one edit with the same first letter and the
 * same last letter, or two edits at nine letters or more. Short words must be exact.
 */
export function commandWordMatches(typed: string, command: string): boolean {
  if (typed === command) return true;
  if (command.length <= 3 || PROTECTED_WORDS.has(typed)) return false;
  if (command.length === 4) {
    return typed.length === 4 && [...typed].sort().join("") === [...command].sort().join("") && editDistance(typed, command) === 1;
  }
  if (typed[0] !== command[0]) return false;
  const allowed = command.length >= 9 ? 2 : 1;
  if (Math.abs(typed.length - command.length) > allowed) return false;
  if (allowed === 1 && typed[typed.length - 1] !== command[command.length - 1] && editDistance(typed, command) > 1) return false;
  return editDistance(typed, command) <= allowed;
}

/** The longest message that can be a command; longer replies are content and are never repaired. */
export const MAX_COMMAND_WORDS = 8;

/**
 * Rewrites near-miss spellings of a closed list of command words back to the word, so the usual
 * patterns can match "shwo me the answr". The result is only for detecting a command: the
 * learner's own text is never altered or graded in this form, and a message longer than a short
 * command is returned untouched.
 */
export function repairCommandTypos(text: string, vocabulary: readonly string[], maxWords = MAX_COMMAND_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > maxWords) return text;

  return text.replace(/[A-Za-z]+/g, (word) => {
    const typed = word.toLowerCase();
    if (vocabulary.includes(typed)) return word;
    const fix = vocabulary.find((command) => commandWordMatches(typed, command));
    return fix ?? word;
  });
}
