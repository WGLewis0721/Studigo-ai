/**
 * Model output arrives as light markdown (headings, bullets, **bold**, [1]
 * citation markers). This parses the small subset we expect into plain data so
 * the UI can render it as real paragraphs and lists instead of raw symbols.
 * No HTML is ever produced or injected.
 */
export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "cite"; value: string };

export type Block =
  | { type: "heading"; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*?\*|\[\d{1,2}(?:\s*,\s*\d{1,2})*\])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", value: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) out.push({ type: "bold", value: token.slice(2, -2) });
    else if (token.startsWith("`")) out.push({ type: "code", value: token.slice(1, -1) });
    else if (token.startsWith("[")) out.push({ type: "cite", value: token.slice(1, -1).replace(/\s+/g, "") });
    else out.push({ type: "italic", value: token.slice(1, -1) });
    last = index + token.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d{1,2}[.)]\s+(.*)$/;

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", inline: parseInline(heading[1]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const item = bullet ?? ordered;
    if (item) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(item[1]);
      continue;
    }
    // A wrapped continuation of the previous list item.
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}
