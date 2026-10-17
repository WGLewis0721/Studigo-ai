"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, assertUploadAllowed, resolveMimeType, coverageLimitation, type SourceType } from "@studigo/documents";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";
import type { StudyDocument } from "@/lib/rooms";
import { GuidePreview } from "./guide-preview";
import { describeCorpus } from "@/lib/guide-lifecycle";
import { visibleIngestStage } from "@/lib/ingest-jobs";
import { createBoundedUploadQueue, enqueueUploadBatch } from "@/lib/materials-upload-queue";
import { ChipSelect, HeaderChip, HeaderMascot } from "./mode-header";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp";
const phase3Materials = process.env.NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI === "1";

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
  stage: "waiting" | "uploading" | "queued" | "processing" | "done" | "error";
  message?: string;
  documentId?: string;
  jobId?: string;
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
  onChanged,
  phase3FoundationUi = phase3Materials
}: {
  roomId: string;
  documents: StudyDocument[];
  onChanged: () => void;
  /** Server-selected room UI gate; undefined preserves standalone fixture behavior. */
  phase3FoundationUi?: boolean;
}) {
  const phase3Materials = phase3FoundationUi;
  const [sourceType, setSourceType] = useState<SourceType>("study_guide");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingGuide, setRefreshingGuide] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [guideRevision, setGuideRevision] = useState(0);
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const gestures = useRef(createGestureBook());
  const uploadQueueRef = useRef<ReturnType<typeof createBoundedUploadQueue> | null>(null);
  if (!uploadQueueRef.current) uploadQueueRef.current = createBoundedUploadQueue(3);
  const processQueueRef = useRef<Array<{ key: string; documentId: string }>>([]);
  const runProcessQueueRef = useRef<() => void>(() => {});
  const processingIdsRef = useRef(new Set<string>());
  const processorRunningRef = useRef(false);
  const queueKeyRef = useRef(0);
  const clearDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(() => new Set());
  const latestStudyGuide = documents.find((document) => document.source_type === "study_guide") ?? null;
  const sourceRevision = `${guideRevision}:${documents.map((document) => `${document.id}:${document.status}:${document.chunk_count}`).join("|")}`;
  const readableCount = documents.filter((document) => document.status === "ready" || document.status === "partial").length;

  const refreshStudyGuide = useCallback(async () => {
    if (!latestStudyGuide || refreshingGuide) return;
    if (["processing", "queued", "uploaded"].includes(latestStudyGuide.status)) {
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
      setGuideRevision((revision) => revision + 1);
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
        if (response.status === 202 && payload.jobId && payload.status === "queued") {
          return payload as { jobId: string; status: "queued" };
        }
        if (response.status === 202 || response.status === 409 || !response.ok) {
          throw new Error(payload.error || "Processing failed");
        }
        return payload as { chunkCount?: number; topicsCreated?: number; status?: string };
      } catch (error) {
        gestures.current.abort(slot);
        throw error;
      }
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
            const result = await process(job.documentId);
            const queued = result && "jobId" in result && result.status === "queued";
            setQueue((current) => current.map((item) =>
              item.key === job.key
                ? { ...item, stage: queued ? "queued" : "done", documentId: job.documentId, jobId: queued ? result.jobId : item.jobId }
                : item
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

  useEffect(() => {
    const pending = queue.filter((item) => item.jobId && item.stage === "queued");
    if (!pending.length) return;
    let stopped = false;
    const timer = setInterval(() => {
      for (const item of pending) {
        void fetch(`/api/documents/jobs?jobId=${item.jobId}`).then(async (response) => {
          if (!response.ok || stopped) return;
          const body = await response.json().catch(() => null) as { stage?: string } | null;
          if (!body?.stage) return;
          const visible = visibleIngestStage(body.stage);
          if (visible === "queued") return;
          setQueue((current) => current.map((entry) =>
            entry.jobId === item.jobId ? { ...entry, stage: visible === "done" ? "done" : visible === "error" ? "error" : "processing" } : entry
          ));
          startTransition(onChanged);
        }).catch(() => undefined);
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [onChanged, queue, startTransition]);

  useEffect(() => () => {
    if (clearDoneTimerRef.current) clearTimeout(clearDoneTimerRef.current);
  }, []);

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      setError(null);

      const jobs = files.map((file) => {
        const key = `file-${queueKeyRef.current += 1}`;
        setQueue((current) => [...current, { key, name: file.name, stage: "waiting" }]);
        return { file, key };
      });
      enqueueUploadBatch(uploadQueueRef.current!, jobs, sourceType, async ({ file, key }, selectedSourceType) => {
        setQueue((current) => current.map((item) =>
          item.key === key ? { ...item, stage: "uploading" } : item
        ));
        try {
          const mimeType = assertUploadAllowed({
            name: file.name, size: file.size, type: resolveMimeType(file)
          });
          const body = JSON.stringify({ roomId, sourceType: selectedSourceType, name: file.name, size: file.size, type: mimeType });
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

          // The signed token authorizes this one private user-owned Storage path.
          // Never send file bytes to a Vercel API route.
          const { error: storageError } = await createBrowserSupabaseClient().storage
            .from("study-materials")
            .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, { contentType: mimeType });
          if (storageError) {
            // Remove the pending metadata and schedule Storage cleanup if needed.
            await fetch(`/api/documents/${prepared.document.id}`, { method: "DELETE" }).catch(() => null);
            throw new Error(`Supabase Storage rejected the file: ${storageError.message || "Unknown storage error"}.`);
          }

          const finalize = await fetch("/api/documents/upload/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: prepared.document.id })
          });
          const payload = await readUploadReply(finalize, "Could not confirm the uploaded file");

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
      });
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
    if (removingIds.has(document.id)) return;
    if (!window.confirm(`Remove “${document.name}” and its source passages? Study content based on this file may need refreshing.`)) return;
    setRemovingIds((current) => new Set(current).add(document.id));
    setError(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not remove that document.");
      }
      setGuideRevision((revision) => revision + 1);
      startTransition(onChanged);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove that document. Try again.");
    } finally {
      setRemovingIds((current) => { const next = new Set(current); next.delete(document.id); return next; });
    }
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
      {phase3Materials ? <div className="materialsIntro">
        <div>
          <span className="tinyLabel">YOUR SOURCE LIBRARY</span>
          <h2>Start with the real material.</h2>
          <p>Choose the file type above, then add a class file. Studigo reads what it can and tells you when something needs attention.</p>
        </div>
        <div className="materialsReadout" role="status"><strong>{readableCount}</strong><span>of {documents.length} files readable</span></div>
      </div> : <p className="setupLead">Set the file type above, then add your files.</p>}

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
            disabled={refreshingGuide || ["processing", "queued", "uploaded"].includes(latestStudyGuide.status)}
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
        {phase3Materials ? <><span className="dropzoneGlyph" aria-hidden="true">＋</span><strong>Bring your materials in.</strong><span className="dropzoneHint">Drop files here, or choose them from your device.</span></> : <strong>Drop files here</strong>}
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
                {item.stage === "waiting" && "Waiting to upload…"}
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
      {phase3Materials ? <div className="materialsLibraryTitle"><div><span className="tinyLabel libraryHeading">IN THIS ROOM · {documents.length} {documents.length === 1 ? "FILE" : "FILES"}</span><h2>On the shelf</h2></div><span>Original files &amp; Studigo guide</span></div> : <span className="tinyLabel libraryHeading">IN THIS ROOM · {documents.length} {documents.length === 1 ? "FILE" : "FILES"}</span>}
      <p className="setupLead">{describeCorpus(documents.map((document) => ({ id: document.id, revision: 0, status: document.status }))).notice}</p>
      {!phase3Materials && <GuidePreview roomId={roomId} sourceRevision={sourceRevision} />}
      <ul className="documentList">
        {documents.length === 0 && (
          <li className="emptyState">{phase3Materials ? "No original files yet. Add a study guide or other class material above to begin." : "Nothing here yet. The study guide is the best first upload."}</li>
        )}

        {documents.map((document) => (
          <li
            key={document.id}
            className={`documentRow status-${document.status}`}
            data-source={document.source_type}
            data-readiness={document.status === "ready" ? "ready" : document.status === "partial" ? "partial" : document.status === "failed" ? "failed" : "pending"}
          >
            <span className="documentBadge">{SOURCE_TYPE_LABELS[document.source_type]}</span>
            <div className="documentMeta">
              <span className="documentOrigin">Original upload</span>
              <strong title={document.name}>{document.name}</strong>
              <div className="documentEvidence">
                <b className={`docStatus docStatus-${document.status}`}>{STATUS_LABELS[document.status]}</b>
                <span>{formatSize(document.size_bytes)}</span>
              </div>
              <p className="documentStatusDetail">{statusCopy(document)}</p>
            </div>
            <div className="documentActions" aria-label={`Actions for ${document.name}`}>
              <a className="documentOpen" aria-label={`View original file ${document.name}`}
                href={`/api/documents/download?documentId=${encodeURIComponent(document.id)}&inline=1`}
                target="_blank" rel="noopener noreferrer">View original</a>
              {(document.status === "failed" ||
                document.status === "partial" ||
                document.status === "queued" ||
                document.status === "uploaded") && (
                <button type="button" disabled={retryingIds.has(document.id)} onClick={() => retry(document)}>
                  {retryingIds.has(document.id) ? "Processing…" : document.status === "failed" || document.status === "partial" ? "Read again" : "Process now"}
                </button>
              )}
              <details className="documentMore">
                <summary aria-label={`More actions for ${document.name}`}>More <span aria-hidden="true">⌄</span></summary>
                <div className="documentMoreOptions">
                  <a href={`/api/documents/download?documentId=${encodeURIComponent(document.id)}`}
                    aria-label={`Download original file ${document.name}`}>Download original</a>
                  {document.mime_type === "application/pdf" && <a
                    href={`/api/documents/download?documentId=${encodeURIComponent(document.id)}&inline=1`}
                    target="_blank" rel="noopener noreferrer"
                    title="Opens the original PDF in a new tab; choose Print in your PDF viewer"
                    aria-label={`Open original PDF ${document.name} to print`}>Print original</a>}
                  <button type="button" className="danger" disabled={removingIds.has(document.id)}
                    aria-label={`Remove original file ${document.name}`} onClick={() => void remove(document)}>
                    {removingIds.has(document.id) ? "Removing…" : "Remove file"}
                  </button>
                </div>
              </details>
            </div>
          </li>
        ))}

      </ul>
      {phase3Materials && <div className="materialsGuide"><div className="materialsGuideLabel"><span className="tinyLabel">GENERATED FROM YOUR SOURCES</span><strong>Studigo guide</strong><p>A study aid, separate from your original files. Open a cited page to check the source.</p></div><GuidePreview roomId={roomId} phase3Materials sourceRevision={sourceRevision} /></div>}
      </div>
    </div>
  );
}
