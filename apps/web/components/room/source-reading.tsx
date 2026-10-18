import { parseSourceReading } from "@/lib/source-reading";

/**
 * Shares Materials' approved reading grammar: a white surface, distinct
 * headings, readable bullets and a single source-provenance line.
 * All sentences are direct substrings of the persisted authorized excerpt.
 */
export function SourceReading({ text, topic = "", className = "" }: {
  text: string; topic?: string; className?: string;
}) {
  const blocks = parseSourceReading(text, topic);
  const groups: Array<{ kind: "heading" | "paragraph" | "facts"; texts: string[] }> = [];
  for (const block of blocks) {
    if (block.kind === "fact" && groups.at(-1)?.kind === "facts") {
      groups[groups.length - 1].texts.push(block.text);
    } else {
      groups.push({ kind: block.kind === "fact" ? "facts" : block.kind, texts: [block.text] });
    }
  }
  return (
    <div className={`learnSourceFormatted ${className}`.trim()} aria-label="Readable source notes">
      {groups.map((group, index) => group.kind === "heading"
        ? <h3 className="learnSourceSubheading" key={index}>{group.texts[0]}</h3>
        : group.kind === "facts"
          ? <ul className="learnSourceFacts" key={index}>{group.texts.map((line, i) => <li key={i}>{line}</li>)}</ul>
          : <p className="learnSourceParagraph" key={index}>{group.texts[0]}</p>
      )}
    </div>
  );
}
