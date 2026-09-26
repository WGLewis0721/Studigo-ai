"use client";

export type Citation = {
  marker?: number;
  chunkId?: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  pageLabel?: string | null;
  sourceType?: string | null;
};

/**
 * A citation chip opens the learner's own original file, at the cited page
 * where the format allows it. A citation that cannot be opened is not evidence.
 */
export function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;

  return (
    <div className="sourceStack">
      {citations.map((citation, index) => {
        const label = citation.pageLabel || "page";
        const location = citation.pageNumber ? `${label} ${citation.pageNumber}` : "";
        const href = `/api/documents/download?documentId=${citation.documentId}&inline=1${
          citation.pageNumber ? `&page=${citation.pageNumber}` : ""
        }`;

        return (
          <a
            className="sourceChipLink"
            key={`${citation.documentId}-${citation.pageNumber}-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={`Open ${citation.documentName}`}
          >
            <i>{citation.marker ?? index + 1}</i>
            <span className="sourceChipName">{citation.documentName}</span>
            {location && <span className="sourceChipPage">{location}</span>}
            <span className="sourceChipOpen" aria-hidden="true">↗</span>
          </a>
        );
      })}
    </div>
  );
}
