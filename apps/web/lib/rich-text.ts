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

/** One bullet. A bullet indented under it becomes its sublist, which is how an outline nests. */
export type ListItem = { inline: Inline[]; sublist: ListBlock | null };
export type ListBlock = { type: "list"; ordered: boolean; items: ListItem[] };

export type Block =
  | { type: "heading"; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | ListBlock;

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
const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const ORDERED = /^(\s*)\d{1,2}[.)]\s+(.*)$/;

type RawItem = { indent: number; ordered: boolean; text: string };

/** Indentation counts a tab as four spaces, so a model that tabs its sub-bullets still nests. */
function indentOf(whitespace: string): number {
  return whitespace.replace(/\t/g, "    ").length;
}

/**
 * Builds nested lists from consecutive list lines. A line indented deeper than the line above it
 * starts a sublist under that line; a line indented less closes the deeper lists. Only the order
 * of indents matters, not their width, so two, three or four spaces per level all work.
 */
function buildList(items: RawItem[]): ListBlock {
  const root: ListBlock = { type: "list", ordered: items[0].ordered, items: [] };
  const stack: Array<{ indent: number; list: ListBlock }> = [{ indent: items[0].indent, list: root }];

  for (const item of items) {
    while (stack.length > 1 && item.indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];

    if (item.indent > top.indent) {
      const parent = top.list.items[top.list.items.length - 1];
      if (parent) {
        const child: ListBlock = { type: "list", ordered: item.ordered, items: [] };
        parent.sublist = child;
        stack.push({ indent: item.indent, list: child });
        top = stack[stack.length - 1];
      }
    }

    top.list.items.push({ inline: parseInline(item.text), sublist: null });
  }
  return root;
}

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: RawItem[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(buildList(list));
    list = [];
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
    const match = bullet ?? ordered;
    if (match) {
      flushParagraph();
      const raw: RawItem = { indent: indentOf(match[1]), ordered: Boolean(ordered), text: match[2] };
      // A top-level list keeps one style: switching between bullets and numbers starts a new list.
      if (list.length && raw.indent <= list[0].indent && raw.ordered !== list[0].ordered) flushList();
      list.push(raw);
      continue;
    }
    // A wrapped continuation of the previous list item.
    if (list.length && /^\s{2,}\S/.test(raw)) {
      list[list.length - 1].text += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}
