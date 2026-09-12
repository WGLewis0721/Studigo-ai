import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type ExtractionResult
} from "./types";
import {
  extractDocx,
  extractPdf,
  extractPlainText,
  extractPptx
} from "./extract";

export * from "./types";
export * from "./chunk";
export {
  extractDocx,
  extractPdf,
  extractPlainText,
  extractPptx,
  extractSinglePagePdf,
  normalizeText,
  pagesNeedingOcr,
  OCR_TEXT_THRESHOLD
} from "./extract";

export function sanitizeFilename(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 180) || "document"
  );
}

export function buildDocumentStoragePath(args: {
  userId: string;
  roomId: string;
  documentId: string;
  filename: string;
}) {
  return `${args.userId}/${args.roomId}/${args.documentId}-${sanitizeFilename(args.filename)}`;
}

/**
 * Browsers often send an empty or wrong MIME type for DOCX/PPTX, so the file
 * extension is treated as authoritative when the declared type is unusable.
 */
export function resolveMimeType(file: { type?: string | null; name: string }) {
  const declared = (file.type || "").toLowerCase();
  if (ALLOWED_MIME_TYPES.has(declared)) return declared;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp"
  };

  return byExtension[extension] ?? declared;
}

export function assertUploadAllowed(file: { type: string; size: number; name: string }) {
  const mimeType = resolveMimeType(file);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${file.type || mimeType || "unknown"}`);
  }
  if (file.size <= 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is larger than the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`
    );
  }
  return mimeType;
}

export function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}

/**
 * Routes a file to its extractor. Images have no text layer at all, so they
 * come back as a single empty page that the ingestion worker sends to OCR.
 */
export async function extractDocument(args: {
  mimeType: string;
  buffer: ArrayBuffer;
}): Promise<ExtractionResult> {
  switch (args.mimeType) {
    case "application/pdf":
      return extractPdf(args.buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocx(args.buffer);
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return extractPptx(args.buffer);
    case "text/plain":
    case "text/markdown":
      return extractPlainText(new TextDecoder().decode(args.buffer));
    default:
      if (isImageMimeType(args.mimeType)) {
        return { pages: [{ pageNumber: 1, text: "" }], pageCount: 1, pageLabel: "page", ocrPageCount: 0 };
      }
      throw new Error(`No extractor for ${args.mimeType}`);
  }
}

export async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
