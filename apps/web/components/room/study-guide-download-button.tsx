"use client";

import { useRef, useState } from "react";
import {
  browserCanShareFile,
  decideGuideExport,
  guideDownloadPath,
  guideExportFile,
  guideFilenameFromDisposition,
  isShareCancellation,
  type GuideExportFormat
} from "@/lib/guide-share";

export function StudyGuideDownloadButton({ roomId, format = "pdf" }: { roomId: string; format?: GuideExportFormat }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function download() {
    if (decideGuideExport({ inFlight: inFlight.current, canShare: false, cancelled: false, format }).action === "reject-inflight") return;
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
      const canShare = browserCanShareFile(typeof navigator === "undefined" ? undefined : navigator, file);
      const decision = decideGuideExport({ inFlight: false, canShare, cancelled: false, format, file });

      if (decision.action === "share-file" && typeof navigator.share === "function") {
        try {
          await navigator.share({ files: decision.payload.files, title: decision.payload.title });
        } catch (shareError) {
          const settled = decideGuideExport({
            inFlight: false,
            canShare: true,
            cancelled: isShareCancellation(shareError),
            failed: !isShareCancellation(shareError),
            format,
            file,
            message: "Could not share the study guide."
          });
          if (settled.action === "error") setError(settled.message);
        }
        return;
      }

      if (decision.action === "share-file" || decision.action === "download") saveGuideFile(decision.file);
    } catch (downloadError) {
      if (isShareCancellation(downloadError)) return;
      setError(downloadError instanceof Error ? downloadError.message : "Could not build the study guide.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <span className="studyGuideDownload">
      <button className="buttonQuiet" type="button" onClick={() => void download()} disabled={busy}>
        <span className="studyGuideDownloadLabel">{busy ? "Saving..." : format === "docx" ? "Word" : "Download study guide"}</span>
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
    URL.revokeObjectURL(url);
  }
}
