"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, assertUploadAllowed, resolveMimeType, coverageLimitation, type SourceType } from "@studigo/documents";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";
import type { StudyDocument } from "@/lib/rooms";
import { createProcessGate, runMaterialIntake } from "@/lib/material-intake";
import { ChipSelect, HeaderChip, HeaderMascot } from "./mode-header";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp";

async function readUploadReply(response: Response, fallback: string): Promise<Record<string, any>> {
  const payload = await response.json().catch(() => null) as Record<string, any> | null;
  if (response.ok) return payload ?? {};
  if (response.status === 413) {
    throw new Error("Upload request was too large for the server. This file needs direct Storage upload.");
  }
  if (response.status === 401) {
    throw new Error("Your sign-in expired. Please sign in again.");
  }
  throw new Error(payload?.error || `${fallback} (HTTP ${response.status}).`);
}


type QueueItem = {
  key: string;
  name: string;
  stage: "uploading" | "processing" | "done" | "error";
  message?: string;
};

const STATUS_LABELS: Record<StudyDocument["status"], string> = {
  ready: "Ready",
  partial: "Needs review",
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
    case "partial":
      return coverageLimitation(document.page_coverage ?? [], document.page_label || "page")
        ?? "Some pages need a clearer copy. The readable pages can still be used.";
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
  const gestures = useRef(createGestureBook());
  const uploadLock = useRef(false);
  const mounted = useRef(true);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processGate = useRef(createProcessGate());
  const latestStudyGuide = documents.find((document) => document.source_type === "study_guide") ?? null;

  useEffect(() => () => {
    mounted.current = false;
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

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
    const body = JSON.stringify({ roomId, documentId: latestStudyGuide.id });
    const attempt = gestures.current.begin(`reindex:${latestStudyGuide.id}`, body);
    if (!attempt.started) return;

    setRefreshingGuide(true);
    setRefreshStatus(null);
    setError(null);
    try {
      const response = await fetch("/api/documents/reindex", {
        method: "POST",
        headers: operationHeaders(attempt.id),
        body
      });
      gestures.current.finish(`reindex:${latestStudyGuide.id}`, response.status);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 202 || response.status === 409 || !response.ok) {
        throw new Error(payload.error || "Could not refresh that study guide.");
      }
      setRefreshStatus(
        `Refreshed ${latestStudyGuide.name}. Studigo rebuilt the source index and study topics from this file.`
      );
      startTransition(onChanged);
    } catch (refreshError) {
      gestures.current.abort(`reindex:${latestStudyGuide.id}`);
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh that study guide.");
    } finally {
      setRefreshingGuide(false);
    }
  }, [latestStudyGuide, onChanged, refreshingGuide, roomId, startTransition]);

  const process = useCallback(
    async (documentId: string) => {
      return processGate.current(documentId, async () => {
      const body = JSON.stringify({ documentId });
      const slot = `process:${documentId}`;
      const attempt = gestures.current.begin(slot, body);
      if (!attempt.started) throw new Error("That file is already being read.");
      try {
        const response = await fetch("/api/documents/process", {
          method: "POST",
          headers: operationHeaders(attempt.id),
          body
        });
        gestures.current.finish(slot, response.status);
        const payload = await response.json().catch(() => ({}));
        if (response.status === 202 || response.status === 409 || !response.ok) {
          throw new Error(payload.error || "Processing failed");
        }
        return payload as { chunkCount?: number; topicsCreated?: number };
      } catch (error) {
        gestures.current.abort(slot);
        throw error;
      }
      });
    },
    []
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || uploadLock.current) return;
      uploadLock.current = true;
      setError(null);
      const chosenType = sourceType;

      try {
      await runMaterialIntake({
        files: files.map((file) => ({
          file,
          key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name
        })),
        sourceType: chosenType,
        active: () => mounted.current,
        onStage: (item, stage, message) => {
          if (!mounted.current) return;
          setQueue((current) => current.some((entry) => entry.key === item.key)
            ? current.map((entry) => entry.key === item.key ? { ...entry, stage, message } : entry)
            : [...current, { key: item.key, name: item.name, stage, message }]);
          if (stage !== "uploading") startTransition(onChanged);
        },
        upload: async (item, type) => {
          const file = item.file;
          const mimeType = assertUploadAllowed({
            name: file.name, size: file.size, type: resolveMimeType(file)
          });
          const body = JSON.stringify({ roomId, sourceType: type, name: file.name, size: file.size, type: mimeType });
          const slot = `prepare:${file.name}:${file.size}:${mimeType}`;
          const attempt = gestures.current.begin(slot, body);
          if (!attempt.started) throw new Error("That file is already being prepared.");
          let prepare: Response;
          try {
            prepare = await fetch("/api/documents/upload/prepare", {
              method: "POST",
              headers: operationHeaders(attempt.id),
              body
            });
            gestures.current.finish(slot, prepare.status);
          } catch (error) {
            gestures.current.abort(slot);
            throw error;
          }
          if (prepare.status === 202 || prepare.status === 409) {
            const denied = await prepare.json().catch(() => ({}));
            throw new Error(denied.error || "Could not prepare the upload");
          }
          const prepared = await readUploadReply(prepare, "Could not prepare the upload");
          if (!prepared?.upload?.path || !prepared?.upload?.token || !prepared?.document?.id) {
            throw new Error("Could not obtain a secure upload destination.");
          }
          const { error: storageError } = await createBrowserSupabaseClient().storage
            .from("study-materials")
            .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, { contentType: mimeType });
          if (storageError) {
            await fetch(`/api/documents/${prepared.document.id}`, { method: "DELETE" }).catch(() => null);
            throw new Error(`Supabase Storage rejected the file: ${storageError.message || "Unknown storage error"}.`);
          }
          const finalize = await fetch("/api/documents/upload/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: prepared.document.id })
          });
          const payload = await readUploadReply(finalize, "Could not confirm the uploaded file");
          return { id: String(payload.document.id) };
        },
        processOne: async (documentId) => {
          await process(documentId);
        }
      });
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => {
        if (mounted.current) setQueue((current) => current.filter((item) => item.stage !== "done"));
      }, 2500);
      } finally {
        uploadLock.current = false;
      }
    },
    [onChanged, process, roomId, sourceType, startTransition]
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
                document.status === "partial" ||
                document.status === "queued" ||
                document.status === "uploaded") && (
                <button type="button" onClick={() => void retry(document.id)}>
                  {document.status === "failed" || document.status === "partial" ? "Retry unread pages" : "Process now"}
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
