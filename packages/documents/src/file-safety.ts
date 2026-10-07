/**
 * Content checks that run on the uploaded bytes, not on the browser's declared
 * MIME type or the filename (SECURITY_AUDIT_CHECKLIST UP-02, UP-04).
 *
 * These are cheap structural checks. They do not replace malware scanning or
 * content disarm for PDF/DOCX/PPTX, which remain open items.
 */

export class UnsafeFileError extends Error {}

export type ZipLimits = { maxEntries: number; maxUncompressedBytes: number; maxRatio: number };

export const ZIP_LIMITS: ZipLimits = {
  /** Real DOCX/PPTX files have tens to a few hundred parts. */
  maxEntries: 5_000,
  /** Total declared uncompressed size of every part. */
  maxUncompressedBytes: 300 * 1024 * 1024,
  /** Whole-archive expansion ratio; XML compresses well but not this well. */
  maxRatio: 100
};

const OOXML_MAIN_PART: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/document.xml",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/presentation.xml"
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Rejects files whose bytes do not match the type they were accepted as. */
export function assertContentMatchesType(mimeType: string, input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const mismatch = () => new UnsafeFileError("That file's contents don't match its file type. Export it again and re-upload.");

  switch (mimeType) {
    case "application/pdf": {
      // The PDF spec tolerates leading bytes; readers accept the header within 1 KB.
      if (!ascii(bytes, 0, Math.min(bytes.length, 1024)).includes("%PDF-")) throw mismatch();
      return;
    }
    case "image/png":
      if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw mismatch();
      return;
    case "image/jpeg":
      if (!startsWith(bytes, [0xff, 0xd8, 0xff])) throw mismatch();
      return;
    case "image/webp":
      if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") throw mismatch();
      return;
    case "text/plain":
    case "text/markdown": {
      if (bytes.subarray(0, 8192).includes(0)) throw mismatch();
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new UnsafeFileError("Text files must be UTF-8. Save it as UTF-8 and re-upload.");
      }
      return;
    }
    default: {
      const mainPart = OOXML_MAIN_PART[mimeType];
      if (!mainPart) throw new UnsafeFileError(`Unsupported file type: ${mimeType}`);
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) throw mismatch();
      const entries = assertSafeZip(bytes);
      if (!entries.includes(mainPart)) throw mismatch();
    }
  }
}

/**
 * Reads the ZIP central directory and rejects archives that declare too many
 * parts or expand too far (decompression bombs). Returns the entry names.
 *
 * Limitation: sizes come from the central directory, which a hand-crafted
 * archive can understate. This stops ordinary bombs before any inflation; it is
 * not a substitute for running parsers with a memory/time budget in a worker.
 */
export function assertSafeZip(input: ArrayBuffer | Uint8Array, limits: Partial<ZipLimits> = {}): string[] {
  const { maxEntries, maxUncompressedBytes, maxRatio } = { ...ZIP_LIMITS, ...limits };
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => new UnsafeFileError("That file is not a valid Word or PowerPoint document.");

  // End of central directory: 22 bytes plus an optional comment of up to 64 KB.
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 0xffff); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw invalid();

  const entryCount = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  // ZIP64 markers: Office files never need them at Studigo's 50 MB upload limit.
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) throw invalid();
  if (entryCount > maxEntries) throw new UnsafeFileError("That document has too many internal parts to process safely.");
  if (directoryOffset + directorySize > eocd) throw invalid();

  const names: string[] = [];
  let total = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > eocd || view.getUint32(cursor, true) !== 0x02014b50) throw invalid();
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    if (uncompressed === 0xffffffff) throw invalid();
    total += uncompressed;
    names.push(new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  if (total > maxUncompressedBytes || total > Math.max(bytes.length, 1) * maxRatio) {
    throw new UnsafeFileError("That document expands too far to process safely. Re-save it and upload again.");
  }
  return names;
}
