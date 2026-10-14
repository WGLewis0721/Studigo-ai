import { pdfPageQualityIssues } from "./extract";
import type { ExtractedPage } from "./types";

export type PageCoverageState = "readable" | "uncertain" | "unreadable";

export type PageCoverageReason =
  | "verified_text"
  | "ocr_verified"
  | "missing_text"
  | "uncertain_text"
  | "ocr_failed";

/** Safe page outcome. Reasons never include source text. */
export type PageCoverageEntry = {
  pageNumber: number;
  state: PageCoverageState;
  reason: PageCoverageReason;
};

export type PageCoverageAssessment = {
  coverage: PageCoverageEntry[];
  publishable: ExtractedPage[];
  status: "ready" | "partial" | "failed";
  limitation: string | null;
};

function pageList(label: string, numbers: number[]) {
  const name = numbers.length === 1 ? label : `${label}s`;
  const titled = name.charAt(0).toUpperCase() + name.slice(1);
  if (numbers.length <= 1) return `${titled} ${numbers[0] ?? ""}`.trim();
  if (numbers.length === 2) return `${titled} ${numbers[0]} and ${numbers[1]}`;
  return `${titled} ${numbers.slice(0, -1).join(", ")}, and ${numbers[numbers.length - 1]}`;
}

export function coverageLimitation(coverage: PageCoverageEntry[], pageLabel = "page") {
  const blocked = coverage.filter((entry) => entry.state !== "readable").map((entry) => entry.pageNumber);
  if (!blocked.length) return null;
  const readable = coverage.filter((entry) => entry.state === "readable").map((entry) => entry.pageNumber);
  const noun = blocked.length === 1 ? "needs" : "need";
  const usable = readable.length ? ` ${pageList(pageLabel, readable)} can still be used.` : "";
  return `${pageList(pageLabel, blocked)} ${noun} a clearer copy.${usable}`;
}

/** Readable pages can be cited. Uncertain or unreadable text is not evidence. */
export function isPageCitable(coverage: PageCoverageEntry[] | null | undefined, pageNumber: number | null) {
  const entries = Array.isArray(coverage) ? coverage : [];
  const blocked = entries.filter((entry) => entry?.state !== "readable");
  if (!blocked.length) return true;
  if (pageNumber == null) return false;
  return !blocked.some((entry) => entry.pageNumber === pageNumber);
}

export function assessPageCoverage(
  pages: ExtractedPage[],
  failedPages: readonly number[] = [],
  options: { pdfQuality?: boolean } = {}
): PageCoverageAssessment {
  const failed = new Set(failedPages);
  const coverage = [...pages]
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page): PageCoverageEntry => {
      if (failed.has(page.pageNumber)) {
        return { pageNumber: page.pageNumber, state: "unreadable", reason: "ocr_failed" };
      }
      if (!options.pdfQuality) {
        return page.text.trim()
          ? { pageNumber: page.pageNumber, state: "readable", reason: page.ocr ? "ocr_verified" : "verified_text" }
          : { pageNumber: page.pageNumber, state: "unreadable", reason: "missing_text" };
      }
      const issues = pdfPageQualityIssues(page);
      if (!issues.length && page.text.trim()) {
        return { pageNumber: page.pageNumber, state: "readable", reason: page.ocr ? "ocr_verified" : "verified_text" };
      }
      if (!page.text.trim() || issues.includes("missing_text")) {
        return { pageNumber: page.pageNumber, state: "unreadable", reason: "missing_text" };
      }
      return { pageNumber: page.pageNumber, state: "uncertain", reason: "uncertain_text" };
    });
  const publishable = pages.filter((page) =>
    coverage.some((entry) => entry.pageNumber === page.pageNumber && entry.state === "readable")
  );
  const blocked = coverage.some((entry) => entry.state !== "readable");
  const status = publishable.length === 0 ? "failed" : blocked ? "partial" : "ready";
  return { coverage, publishable, status, limitation: coverageLimitation(coverage) };
}
