"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, type SourceType } from "@studigo/documents";
import type { StudyDocument } from "@/lib/rooms";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp";

type QueueItem = {
  key: string;
  name: string;
  stage: "uploading" | "processing" | "done" | "error";
  message?: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusCopy(document: StudyDocument) {
  switch (document.status) {
    case "ready":
      return `${document.chunk_count} passages${
        document.page_count ? ` · ${document.page_count} ${document.page_label}s` : ""
      }${document.ocr_page_count ? ` · ${document.ocr_page_count} scanned` : ""}`;
    case "processing":
      return "Reading the document…";
    case "queued":
    case "uploaded":
      return "Waiting to be processed";
    case "failed":
      return document.error_message || "Processing failed";
  }
}

export function MaterialsPanel({
  roomId,
  documents,
  onChanged
}: {
  roomId: string;
  documents: StudyDocument[];
  onChanged: () => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("study_guide");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    async (documentId: string) => {
      const response = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Processing failed");
      return payload as { chunkCount?: number; topicsCreated?: number };
    },
    []
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setError(null);

      for (const file of files) {
        const key = `${file.name}-${file.size}-${Date.now()}`;
        setQueue((current) => [...current, { key, name: file.name, stage: "uploading" }]);

        try {
          const form = new FormData();
          form.set("file", file);
          form.set("roomId", roomId);
          form.set("sourceType", sourceType);

          const response = await fetch("/api/documents/upload", { method: "POST", body: form });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Upload failed");

          setQueue((current) =>
            current.map((item) => (item.key === key ? { ...item, stage: "processing" } : item))
          );
          // The list should show the new row while it is being read.
          startTransition(onChanged);

          await process(payload.document.id as string);

          setQueue((current) =>
            current.map((item) => (item.key === key ? { ...item, stage: "done" } : item))
          );
          startTransition(onChanged);
        } catch (uploadError) {
          const message =
            uploadError instanceof Error ? uploadError.message : "Something went wrong";
          setQueue((current) =>
            current.map((item) =>
              item.key === key ? { ...item, stage: "error", message } : item
            )
          );
          startTransition(onChanged);
        }
      }

      // Clear finished rows once the learner has seen them land.
      setTimeout(() => {
        setQueue((current) => current.filter((item) => item.stage !== "done"));
      }, 2500);
    },
    [onChanged, process, roomId, sourceType]
  );

  const retry = async (documentId: string) => {
    setError(null);
    try {
      await process(documentId);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry failed");
    }
    startTransition(onChanged);
  };

  const remove = async (document: StudyDocument) => {
    if (!window.confirm(`Remove “${document.name}” and everything Studigo learned from it?`)) {
      return;
    }
    const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Could not remove that document.");
    }
    startTransition(onChanged);
  };

  return (
    <div className="materialsPanel">
      <div className="materialsIntro">
        <span className="tinyLabel">01 / FEED THE ROOM</span>
        <h2>Start with the study guide.</h2>
        <p>
          Tell Studigo what each file is. Teacher study guides set the scope of the test; everything
          else becomes supporting evidence.
        </p>
      </div>

      <div className="sourceTypePicker" role="radiogroup" aria-label="What kind of file is this?">
        {SOURCE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={sourceType === type}
            className={`sourceChip ${sourceType === type ? "sourceChipActive" : ""}`}
            onClick={() => setSourceType(type)}
          >
            {SOURCE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        className={`dropzone ${dragging ? "dropzoneActive" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles([...event.dataTransfer.files]);
        }}
      >
        <strong>Drop files here</strong>
        <small>PDF, DOCX, PPTX, TXT, Markdown, or a photo of a handout · up to 50 MB</small>
        <button className="buttonPrimary" type="button" onClick={() => inputRef.current?.click()}>
          Choose files <span aria-hidden="true">→</span>
        </button>
        <input
          ref={inputRef}
          className="visuallyHidden"
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => {
            void uploadFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      {queue.length > 0 && (
        <ul className="uploadQueue" aria-live="polite">
          {queue.map((item) => (
            <li key={item.key} className={`queueItem queue-${item.stage}`}>
              <span className="queueSpinner" aria-hidden="true" />
              <strong>{item.name}</strong>
              <small>
                {item.stage === "uploading" && "Uploading…"}
                {item.stage === "processing" && "Reading, OCR'ing, and indexing…"}
                {item.stage === "done" && "Ready to study"}
                {item.stage === "error" && item.message}
              </small>
            </li>
          ))}
        </ul>
      )}

      <ul className="documentList">
        {documents.length === 0 && (
          <li className="emptyState">Nothing here yet. The study guide is the best first upload.</li>
        )}

        {documents.map((document) => (
          <li key={document.id} className={`documentRow status-${document.status}`}>
            <span className="documentBadge">{SOURCE_TYPE_LABELS[document.source_type]}</span>
            <div className="documentMeta">
              <strong>{document.name}</strong>
              <small>
                {formatSize(document.size_bytes)} · {statusCopy(document)}
              </small>
            </div>
            <div className="documentActions">
              <a
                href={`/api/documents/download?documentId=${document.id}&inline=1`}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
              <a href={`/api/documents/download?documentId=${document.id}`}>Download</a>
              {(document.status === "failed" ||
                document.status === "queued" ||
                document.status === "uploaded") && (
                <button type="button" onClick={() => void retry(document.id)}>
                  {document.status === "failed" ? "Retry" : "Process now"}
                </button>
              )}
              <button type="button" className="danger" onClick={() => void remove(document)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
