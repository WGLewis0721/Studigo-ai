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

function citedPage(citation: Citation) {
  const page = Number(citation.pageNumber);
  return Number.isInteger(page) && page > 0 ? page : null;
}

/**
 * A citation chip opens the learner's own original file, at the cited page
 * where the format allows it. A citation that cannot be opened is not evidence.
 * The location is shown whenever the stored citation has one, in the file's own
 * word (page, slide or section), and is never guessed when it has none.
 */
export function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;

  return (
    <div className="sourceStack">
      {citations.map((citation, index) => {
        const page = citedPage(citation);
        const label = (citation.pageLabel || "page").toLowerCase();
        const location = page ? `${label} ${page}` : "";
        const href = `/api/documents/download?documentId=${encodeURIComponent(citation.documentId)}&inline=1${
          page ? `&page=${page}` : ""
        }`;

        return (
          <a
            className="sourceChipLink"
            key={`${citation.documentId}-${page}-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={`Open ${citation.documentName}${location ? `, ${location}` : ""}`}
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
