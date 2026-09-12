/** Restrict redirects to normalized same-origin application paths. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/app";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return "/app";
    const url = new URL(value, "https://studigo.invalid");
    if (url.origin !== "https://studigo.invalid") return "/app";
    return url.pathname + url.search + url.hash;
  } catch { return "/app"; }
}

export function parseTestDate(value: FormDataEntryValue | null): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid test date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Choose a valid test date.");
  return date.toISOString();
}

export const MAX_OCR_PAGES = 40;
export const MAX_CHUNKS_PER_DOCUMENT = 4000;
export function assertIngestLimit(count: number, limit: number, label: string) {
  if (count > limit) throw new Error(`This file needs ${count} ${label}; the supported limit is ${limit}. Split it into smaller files. Nothing has been marked ready.`);
}
