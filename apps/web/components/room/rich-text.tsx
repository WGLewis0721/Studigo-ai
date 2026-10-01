import { Fragment } from "react";
import { parseRichText, type Inline, type ListBlock } from "@/lib/rich-text";

function renderInline(inline: Inline[]) {
  return inline.map((part, index) => {
    switch (part.type) {
      case "bold":
        return <strong key={index}>{part.value}</strong>;
      case "italic":
        return <em key={index}>{part.value}</em>;
      case "code":
        return <code key={index}>{part.value}</code>;
      case "cite":
        return <sup className="richCite" key={index} aria-label={`Source ${part.value}`}>{part.value}</sup>;
      default:
        return <Fragment key={index}>{part.value}</Fragment>;
    }
  });
}

function renderList(block: ListBlock, key: number | string) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag key={key}>
      {block.items.map((item, itemIndex) => (
        <li key={itemIndex}>
          {renderInline(item.inline)}
          {item.sublist ? renderList(item.sublist, "sub") : null}
        </li>
      ))}
    </Tag>
  );
}

/** Readable model text: real headings, lists and emphasis. Renders React nodes only. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`richText ${className}`.trim()}>
      {parseRichText(text).map((block, index) => {
        if (block.type === "heading") return <h4 key={index}>{renderInline(block.inline)}</h4>;
        if (block.type === "list") return renderList(block, index);
        return <p key={index}>{renderInline(block.inline)}</p>;
      })}
    </div>
  );
}
