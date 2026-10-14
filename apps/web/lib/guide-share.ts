import type { StudyGuideContent } from "@studigo/ai";

export type GuideExportFormat = "pdf" | "docx";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type GuideSharePayload = {
  files: [File];
  title: string;
};

export type GuideExportDecision =
  | { action: "share-file"; file: File; payload: GuideSharePayload }
  | { action: "download"; file: File; filename: string }
  | { action: "ignore-cancel" }
  | { action: "reject-inflight" }
  | { action: "error"; message: string };

type FileShareNavigator = {
  canShare?: (data?: { files?: File[] }) => boolean;
};

const PRIVATE_LINK = /blob:|token=|X-Amz-|signedUrl|\/object\/sign\/|supabase\.co\/storage/i;

export function guideDownloadPath(roomId: string, format: GuideExportFormat): string {
  if (roomId === "fixture") return "/api/dev/study-guide/download";
  const query = new URLSearchParams({ roomId });
  if (format === "docx") query.set("format", "docx");
  return `/api/study-guide/download?${query.toString()}`;
}

export function guideFileType(format: GuideExportFormat, contentType?: string | null): string {
  const cleaned = contentType?.split(";")[0]?.trim().toLowerCase();
  if (cleaned === PDF_MIME || cleaned === DOCX_MIME) return cleaned;
  return format === "docx" ? DOCX_MIME : PDF_MIME;
}

export function sanitizeGuideFilename(name: string, format: GuideExportFormat): string {
  const fallback = format === "docx" ? "Studigo-Study-Guide.docx" : "Studigo-Study-Guide.pdf";
  const base = name.split(/[/\\]/).pop()?.replace(/[\u0000-\u001f"]/g, "").trim() ?? "";
  if (!base || PRIVATE_LINK.test(base) || /^https?:/i.test(base)) return fallback;
  const extension = format === "docx" ? ".docx" : ".pdf";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

export function guideFilenameFromDisposition(disposition: string | null, format: GuideExportFormat): string {
  const starred = disposition?.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i)?.[1];
  if (starred) {
    const encoded = starred.trim().replace(/^"|"$/g, "");
    try {
      return sanitizeGuideFilename(decodeURIComponent(encoded), format);
    } catch {
      return sanitizeGuideFilename(encoded, format);
    }
  }
  const quoted = disposition?.match(/filename="([^"]+)"/i)?.[1];
  return sanitizeGuideFilename(quoted ?? "", format);
}

export function guideExportFile(bytes: Uint8Array, filename: string, format: GuideExportFormat, contentType?: string | null): File {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new File([copy], sanitizeGuideFilename(filename, format), { type: guideFileType(format, contentType) });
}

/** A temporary blob URL or a private signed source URL is never a share address. */
export function guideSharePayload(file: File, discardedLink?: string): GuideSharePayload {
  void discardedLink;
  return { files: [file], title: file.name };
}

export function browserCanShareFile(nav: FileShareNavigator | undefined, file: File): boolean {
  if (!nav || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

export function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  if (name === "AbortError") return true;
  return /share cancel(?:l)?ed|user (?:did )?cancel|the user aborted|request was aborted/i.test(message);
}

export function decideGuideExport(input: {
  inFlight: boolean;
  canShare: boolean;
  cancelled: boolean;
  failed?: boolean;
  format: GuideExportFormat;
  filename?: string;
  bytes?: Uint8Array;
  contentType?: string | null;
  file?: File;
  message?: string;
  /** Present only so callers cannot accidentally forward it. It is never copied onto the result. */
  links?: { blobUrl?: string; signedUrl?: string };
}): GuideExportDecision {
  if (input.inFlight) return { action: "reject-inflight" };
  if (input.cancelled) return { action: "ignore-cancel" };
  if (input.failed) return { action: "error", message: input.message || "Could not share the study guide." };

  const file = input.file ?? guideExportFile(input.bytes ?? new Uint8Array(), input.filename ?? "", input.format, input.contentType);
  if (input.canShare) {
    return { action: "share-file", file, payload: guideSharePayload(file, input.links?.blobUrl ?? input.links?.signedUrl) };
  }
  return { action: "download", file, filename: file.name };
}

export function guidePrintEdition(content: StudyGuideContent, answersRevealed: boolean): string {
  const lines: string[] = [];
  const title = content.chapters[0]?.title ?? "Study guide";
  lines.push(title);
  for (const chapter of content.chapters) {
    if (chapter.title !== title) lines.push(chapter.title);
    if (chapter.objective && chapter.objective !== chapter.title) lines.push(chapter.objective);
    for (const fact of chapter.facts) lines.push(fact.text);
    for (const term of chapter.terms) lines.push(`${term.term}. ${term.definition}`);
    for (const example of chapter.examples) lines.push(example.text);
    if (chapter.practice.length) {
      lines.push("Practice");
      chapter.practice.forEach((question, index) => lines.push(`${index + 1}. ${question.prompt}`));
    }
    if (answersRevealed && chapter.answers.length) {
      lines.push("Answers");
      chapter.answers.forEach((answer, index) => lines.push(`${index + 1}. ${answer.text}`));
    }
  }
  return lines.map((line) => line.replace(PRIVATE_LINK, "").trimEnd()).filter((line) => line.trim().length > 0).join("\n");
}
