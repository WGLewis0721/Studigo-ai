"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, type SourceType } from "@studigo/documents";
import type { StudyDocument } from "@/lib/rooms";
import { ChipSelect, HeaderChip, HeaderMascot } from "./mode-header";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp";

type QueueItem = {
  key: string;
  name: string;
  stage: "uploading" | "queued" | "processing" | "done" | "error";
  message?: string;
  documentId?: string;
};

const STATUS_LABELS: Record<StudyDocument["status"], string> = {
  ready: "Ready",
  processing: "Reading",
  queued: "Queued",
  uploaded: "Queued",
  failed: "Needs attention"
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
  const [refreshingGuide, setRefreshingGuide] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const processQueueRef = useRef<Array<{ key: string; documentId: string }>>([]);
  const runProcessQueueRef = useRef<() => void>(() => {});
  const processingIdsRef = useRef(new Set<string>());
  const processorRunningRef = useRef(false);
  const clearDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(() => new Set());
  const latestStudyGuide = documents.find((document) => document.source_type === "study_guide") ?? null;

  const refreshStudyGuide = useCallback(async () => {
    if (!latestStudyGuide || refreshingGuide) return;
    if (latestStudyGuide.status === "processing") {
      setError("That study guide is still being processed. Wait for it to finish first.");
      return;
    }
    const confirmed = window.confirm(
      `Refresh “${latestStudyGuide.name}”? Studigo will reread the stored file, rebuild its search index and topic map, and start fresh Coach/Learn context the next time you open them. Practice history is kept.`
    );
    if (!confirmed) return;

    setRefreshingGuide(true);
    setRefreshStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/documents/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, documentId: latestStudyGuide.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not refresh that study guide.");
      setRefreshStatus(
        `Refreshed ${latestStudyGuide.name}. Studigo rebuilt the source index and study topics from this file.`
      );
      startTransition(onChanged);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh that study guide.");
    } finally {
      setRefreshingGuide(false);
    }
  }, [latestStudyGuide, onChanged, refreshingGuide, roomId, startTransition]);

  const process = useCallback(
    async (documentId: string) => {
      const response = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Processing failed");
      if (payload.status !== "ready") {
        throw new Error("Processing did not finish. Refresh this file's status before retrying.");
      }
      return payload as { documentId: string; status: "ready"; chunkCount?: number; topicsCreated?: number };
    },
    []
  );

  const runProcessQueue = useCallback(() => {
    if (processorRunningRef.current) return;
    processorRunningRef.current = true;
    void (async () => {
      try {
        while (processQueueRef.current.length) {
          const job = processQueueRef.current.shift()!;
          setQueue((current) => current.map((item) =>
            item.key === job.key ? { ...item, stage: "processing" } : item
          ));
          try {
            await process(job.documentId);
            setQueue((current) => current.map((item) =>
              item.key === job.key ? { ...item, stage: "done" } : item
            ));
          } catch (processError) {
            setQueue((current) => current.map((item) =>
              item.key === job.key
                ? { ...item, stage: "error", message: processError instanceof Error ? processError.message : "Processing failed" }
                : item
            ));
          } finally {
            processingIdsRef.current.delete(job.documentId);
            setRetryingIds((current) => {
              if (!current.has(job.documentId)) return current;
              const next = new Set(current);
              next.delete(job.documentId);
              return next;
            });
            startTransition(onChanged);
          }
        }
      } finally {
        processorRunningRef.current = false;
        if (processQueueRef.current.length) {
          runProcessQueueRef.current();
        } else {
          if (clearDoneTimerRef.current) clearTimeout(clearDoneTimerRef.current);
          clearDoneTimerRef.current = setTimeout(() => {
            setQueue((current) => current.filter((item) => item.stage !== "done"));
          }, 2500);
        }
      }
    })();
  }, [onChanged, process, startTransition]);
  runProcessQueueRef.current = runProcessQueue;

  useEffect(() => () => {
    if (clearDoneTimerRef.current) clearTimeout(clearDoneTimerRef.current);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setError(null);

      const selectedSourceType = sourceType;
      let nextFileIndex = 0;
      const uploadNext = async () => {
        while (nextFileIndex < files.length) {
          const file = files[nextFileIndex++];
          const key = crypto.randomUUID();
          setQueue((current) => [...current, { key, name: file.name, stage: "uploading" }]);

          try {
            const form = new FormData();
            form.set("file", file);
            form.set("roomId", roomId);
            form.set("sourceType", selectedSourceType);

            const response = await fetch("/api/documents/upload", { method: "POST", body: form });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Upload failed");

            const documentId = payload.document?.id;
            if (typeof documentId !== "string" || !documentId) {
              throw new Error("Upload response did not include a document ID.");
            }
            setQueue((current) => current.map((item) =>
              item.key === key ? { ...item, stage: "queued", documentId } : item
            ));
            startTransition(onChanged);
            if (!processingIdsRef.current.has(documentId)) {
              processingIdsRef.current.add(documentId);
              processQueueRef.current.push({ key, documentId });
              runProcessQueue();
            }
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
      };
      await Promise.all(Array.from({ length: Math.min(3, files.length) }, () => uploadNext()));

    },
    [onChanged, roomId, runProcessQueue, sourceType]
  );

  const retry = (document: StudyDocument) => {
    const { id: documentId } = document;
    if (processingIdsRef.current.has(documentId)) return;
    processingIdsRef.current.add(documentId);
    setRetryingIds((current) => new Set(current).add(documentId));
    setError(null);
    const key = `retry-${documentId}`;
    setQueue((current) => [...current.filter((item) => item.key !== key), {
      key,
      name: document.name,
      documentId,
      stage: "queued"
    }]);
    processQueueRef.current.push({ key, documentId });
    runProcessQueue();
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
      <HeaderMascot state="sources" />
      <HeaderChip>
        <ChipSelect
          label={`Adding: ${SOURCE_TYPE_LABELS[sourceType]}`}
          ariaLabel="What kind of file is this?"
          value={sourceType}
          onChange={(value) => setSourceType(value as SourceType)}
        >
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {SOURCE_TYPE_LABELS[type]}
            </option>
          ))}
        </ChipSelect>
      </HeaderChip>
      <div className="materialsIntake">
      <p className="setupLead">Set the file type above, then add your files.</p>

      {latestStudyGuide && (
        <div className="studyGuideRefresh">
          <div>
            <strong>Study guide index</strong>
            <small>
              If topics or answers look stale, reread the newest study guide and rebuild Studigo from the stored original.
            </small>
          </div>
          <button
            className="ghostButton"
            type="button"
            disabled={refreshingGuide || latestStudyGuide.status === "processing"}
            onClick={() => void refreshStudyGuide()}
          >
            {refreshingGuide ? "Refreshing…" : "Refresh study guide"}
          </button>
        </div>
      )}

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
      {refreshStatus && (
        <p className="coachPreferenceStatus" role="status">
          {refreshStatus}
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
                {item.stage === "queued" && "Uploaded · waiting to be read…"}
                {item.stage === "processing" && "Reading, OCR'ing, and indexing…"}
                {item.stage === "done" && "Ready to study"}
                {item.stage === "error" && item.message}
              </small>
            </li>
          ))}
        </ul>
      )}

      </div>

      <div className="materialsLibrary">
      <span className="tinyLabel libraryHeading">IN THIS ROOM · {documents.length} {documents.length === 1 ? "FILE" : "FILES"}</span>
      <ul className="documentList">
        {documents.length === 0 && (
          <li className="emptyState">Nothing here yet. The study guide is the best first upload.</li>
        )}

        {documents.map((document) => (
          <li
            key={document.id}
            className={`documentRow status-${document.status}`}
            data-source={document.source_type}
          >
            <span className="documentBadge">{SOURCE_TYPE_LABELS[document.source_type]}</span>
            <div className="documentMeta">
              <strong>{document.name}</strong>
              <small>
                <b className={`docStatus docStatus-${document.status}`}>
                  {STATUS_LABELS[document.status]}
                </b>
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
                <button type="button" disabled={retryingIds.has(document.id)} onClick={() => retry(document)}>
                  {retryingIds.has(document.id) ? "Processing…" : document.status === "failed" ? "Retry" : "Process now"}
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
    </div>
  );
}
