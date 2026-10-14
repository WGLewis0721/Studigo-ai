import { extractSinglePagePdf, pageWithOcrTranscription } from "./extract";
import type { ExtractedPage, ExtractionResult } from "./types";

/**
 * A page-scoped failure that does not expose private source text in its message.
 * The caller can inspect originalError to produce a safe, specific failure reason.
 */
export class PdfOcrPageError extends Error {
  constructor(
    public readonly pageNumber: number,
    public readonly originalError: unknown
  ) {
    super(`OCR could not process Page ${pageNumber}`);
    this.name = "PdfOcrPageError";
  }
}

/**
 * Provider-agnostic PDF recovery. Transcription is injected so page splitting,
 * completion, and chunk readiness can be exercised without any network calls.
 *
 * Nothing is written or published until every requested page succeeds.
 * Durable checkpoints/partial publication belong to C08/C09, not this helper.
 */
export async function recoverPdfPages(args: {
  extraction: ExtractionResult;
  buffer: ArrayBuffer;
  targetPages: readonly number[];
  transcribePage: (args: { pdf: Uint8Array; pageNumber: number }) => Promise<string>;
}): Promise<ExtractionResult> {
  if (args.targetPages.length === 0) return args.extraction;

  const byPage = new Map<number, ExtractedPage>(
    args.extraction.pages.map((page) => [page.pageNumber, page])
  );
  const targets = new Set(args.targetPages);

  if (targets.size !== args.targetPages.length ||
      args.targetPages.some((pageNumber) => !Number.isInteger(pageNumber) || !byPage.has(pageNumber))) {
    throw new Error("Invalid OCR page selection");
  }

  let ocrPageCount = 0;
  for (const pageNumber of args.targetPages) {
    try {
      const pdf = await extractSinglePagePdf(args.buffer, pageNumber);
      const transcription = await args.transcribePage({ pdf, pageNumber });
      // An empty or invalid page cannot become citable learning evidence.
      byPage.set(pageNumber, pageWithOcrTranscription(byPage.get(pageNumber)!, transcription));
      ocrPageCount += 1;
    } catch (error) {
      throw new PdfOcrPageError(pageNumber, error);
    }
  }

  return {
    ...args.extraction,
    pages: [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber),
    ocrPageCount: args.extraction.ocrPageCount + ocrPageCount
  };
}

/**
 * Same page recovery as `recoverPdfPages`, but one failed page does not
 * discard the pages that already succeeded. Failed pages are named, not published.
 */
export async function recoverPdfPagesAllowingGaps(args: {
  extraction: ExtractionResult;
  buffer: ArrayBuffer;
  targetPages: readonly number[];
  transcribePage: (args: { pdf: Uint8Array; pageNumber: number }) => Promise<string>;
}): Promise<{ extraction: ExtractionResult; failedPages: number[] }> {
  if (args.targetPages.length === 0) return { extraction: args.extraction, failedPages: [] };

  const byPage = new Map<number, ExtractedPage>(
    args.extraction.pages.map((page) => [page.pageNumber, page])
  );
  const targets = new Set(args.targetPages);
  if (targets.size !== args.targetPages.length ||
      args.targetPages.some((pageNumber) => !Number.isInteger(pageNumber) || !byPage.has(pageNumber))) {
    throw new Error("Invalid OCR page selection");
  }

  const failedPages: number[] = [];
  let ocrPageCount = 0;
  for (const pageNumber of args.targetPages) {
    try {
      const pdf = await extractSinglePagePdf(args.buffer, pageNumber);
      const transcription = await args.transcribePage({ pdf, pageNumber });
      byPage.set(pageNumber, pageWithOcrTranscription(byPage.get(pageNumber)!, transcription));
      ocrPageCount += 1;
    } catch {
      failedPages.push(pageNumber);
    }
  }

  return {
    extraction: {
      ...args.extraction,
      pages: [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber),
      ocrPageCount: args.extraction.ocrPageCount + ocrPageCount
    },
    failedPages
  };
}
