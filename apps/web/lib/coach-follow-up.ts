/** The last real question Coach asked, when it is not the one still being graded. */
export function followUpQuestion(pending: string, assistantText: string): string | null {
  const asked = assistantText.match(/[^.!?\n]*\?/g)?.map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part.length > 12) ?? [];
  const last = asked.at(-1);
  if (!last || /\b(hint|try again|another one)\b/i.test(last)) return null;
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const next = norm(last);
  const current = norm(pending);
  if (!next || next === current || current.includes(next) || next.includes(current)) return null;
  return last;
}
