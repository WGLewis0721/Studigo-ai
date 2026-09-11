export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown"
]);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function sanitizeFilename(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "document";
}

export function buildDocumentStoragePath(args: {
  userId: string;
  roomId: string;
  documentId: string;
  filename: string;
}) {
  return `${args.userId}/${args.roomId}/${args.documentId}-${sanitizeFilename(args.filename)}`;
}

export function assertUploadAllowed(file: { type: string; size: number; name: string }) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  if (file.size <= 0) throw new Error("File is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 50 MB scaffold limit");
  return true;
}

export type DocumentProcessingStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "ready"
  | "failed";
