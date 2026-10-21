"use client";

import { useRef, useState } from "react";
import { guideDownloadPath, guideExportFile, guideFilenameFromDisposition, type GuideExportFormat } from "@/lib/guide-share";

export function StudyGuideDownloadButton({ roomId, format = "pdf", compactLabel = false }: { roomId: string; format?: GuideExportFormat; compactLabel?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const path = guideDownloadPath(roomId, format);
      const response = await fetch(`${path}${path.includes("?") ? "&" : "?"}ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not build the study guide.");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const filename = guideFilenameFromDisposition(response.headers.get("Content-Disposition"), format);
      const contentType = response.headers.get("Content-Type");
      const file = guideExportFile(bytes, filename, format, contentType);
      saveGuideFile(file);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not build the study guide.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <span className="studyGuideDownload">
      <button className="buttonQuiet" type="button" onClick={() => void download()} disabled={busy} aria-label={`Download generated Studigo guide as ${format === "docx" ? "Word" : "PDF"}`}>
        <span className="studyGuideDownloadLabel">{busy ? "Saving..." : compactLabel ? format === "docx" ? "Word" : "PDF" : format === "docx" ? "Word" : "Download study guide"}</span>
        <span className="studyGuideDownloadIcon" aria-hidden="true">↓</span>
      </button>
      {error && <small className="formError" role="alert">{error}</small>}
    </span>
  );
}

function saveGuideFile(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
