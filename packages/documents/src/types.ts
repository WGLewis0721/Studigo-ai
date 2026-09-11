export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const SOURCE_TYPES = [
  "study_guide",
  "teacher_material",
  "worksheet",
  "presentation",
  "student_notes",
  "textbook",
  "other"
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  study_guide: "Teacher study guide",
  teacher_material: "Teacher material",
  worksheet: "Worksheet",
  presentation: "Slides",
  student_notes: "My notes",
  textbook: "Textbook",
  other: "Other"
};

export type DocumentProcessingStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

/** A unit of a source document that keeps its human-addressable location. */
export type ExtractedPage = {
  /** 1-based page, slide, or section number as a learner would cite it. */
  pageNumber: number;
  text: string;
  /** True when the text came from OCR rather than an embedded text layer. */
  ocr?: boolean;
};

export type ExtractionResult = {
  pages: ExtractedPage[];
  pageCount: number;
  /** What a citation should call a location: "page", "slide", "section". */
  pageLabel: "page" | "slide" | "section";
  ocrPageCount: number;
};

export type DocumentChunk = {
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
};
