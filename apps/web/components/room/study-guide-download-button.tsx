"use client";

import { useState } from "react";

export function StudyGuideDownloadButton({ roomId }: { roomId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/study-guide/download?roomId=${encodeURIComponent(roomId)}`, {
        method: "GET"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not build the study guide.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const name = match?.[1] || "Studigo-Study-Guide.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not build the study guide.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="studyGuideDownload">
      <button className="buttonQuiet" type="button" onClick={() => void download()} disabled={busy}>
        {busy ? "Building PDF..." : "Download study guide"} <span aria-hidden="true">↓</span>
      </button>
      {error && <small className="formError" role="alert">{error}</small>}
    </span>
  );
}
