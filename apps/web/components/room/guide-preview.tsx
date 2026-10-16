"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { evidenceHref, guidePreviewModel } from "@/lib/guide-preview";
import { guidePrintEdition } from "@/lib/guide-share";
import { requestQuietAcknowledgement, type QuietAcknowledgement } from "@/lib/quiet-feedback";
import { StudyGuideDownloadButton } from "./study-guide-download-button";

export function GuidePreview({
  roomId,
  edition,
  initialAnswersRevealed = false,
  phase3Materials = false,
  sourceRevision = ""
}: {
  roomId: string;
  edition?: StudyGuideContent | null;
  initialAnswersRevealed?: boolean;
  phase3Materials?: boolean;
  sourceRevision?: string;
}) {
  const [loaded, setLoaded] = useState<StudyGuideContent | null>(edition ?? null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(edition !== undefined ? "ready" : "loading");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [showAnswers, setShowAnswers] = useState(initialAnswersRevealed);
  const [guideQuiet, setGuideQuiet] = useState<{ acknowledgement: Exclude<QuietAcknowledgement, "none">; status: string } | null>(null);
  const [source, setSource] = useState<{ state: "loading" | "ready" | "unavailable"; blockKey: string; pageNumber: number; text?: string; document?: { id: string; name?: string; mimeType?: string } } | null>(null);
  const sourcePanelId = useId();
  const sourceRequest = useRef(0);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement | null>(null);

  function closeSource() {
    sourceRequest.current += 1;
    setSource(null);
    sourceTrigger.current?.focus();
  }

  async function inspectSource(blockKey: string, pageNumber: number, trigger: HTMLButtonElement) {
    sourceTrigger.current = trigger;
    const request = ++sourceRequest.current;
    setSource({ state: "loading", blockKey, pageNumber });
    try {
      const response = await fetch(evidenceHref(roomId, blockKey));
      const body = response.ok ? await response.json() as { blockKey?: string; pageNumber?: number; text?: string; document?: { id: string; name?: string; mimeType?: string } } : null;
      if (request !== sourceRequest.current) return;
      if (!body || body.blockKey !== blockKey || typeof body.text !== "string" || !body.text.trim()) {
        setSource({ state: "unavailable", blockKey, pageNumber });
      } else {
        setSource({ state: "ready", blockKey, pageNumber: typeof body.pageNumber === "number" && body.pageNumber > 0 ? body.pageNumber : 0, text: body.text, document: body.document });
      }
    } catch {
      if (request === sourceRequest.current) setSource({ state: "unavailable", blockKey, pageNumber });
    }
  }

  useEffect(() => { if (source) sourceHeading.current?.focus(); }, [source?.blockKey]);

  useEffect(() => {
    sourceRequest.current += 1;
    setSource(null);
    setShowAnswers(initialAnswersRevealed);
  }, [roomId, sourceRevision, edition, initialAnswersRevealed]);

  useEffect(() => {
    if (edition !== undefined) {
      setLoaded(edition);
      setLoadState("ready");
      setUpdateAvailable(false);
      return;
    }
    const controller = new AbortController();
    setLoaded(null);
    setLoadState("loading");
    setUpdateAvailable(false);
    void fetch(`/api/guides/edition?roomId=${encodeURIComponent(roomId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the guide.");
        const body = await response.json() as { edition?: StudyGuideContent | null; updateAvailable?: boolean };
        if (controller.signal.aborted) return;
        setLoaded(body.edition ?? null);
        setUpdateAvailable(body.updateAvailable === true);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadState("error");
          requestQuietAcknowledgement({ phase: "error", kind: "guide-ready", eventKey: `guide-ready:${roomId}` });
          setGuideQuiet(null);
        }
      });
    return () => controller.abort();
  }, [edition, roomId, sourceRevision, reload]);

  useEffect(() => {
    if (!loaded) {
      setGuideQuiet(null);
      if (edition === undefined) {
        requestQuietAcknowledgement({ phase: "loading", kind: "guide-ready", eventKey: `guide-ready:${roomId}` });
      }
      return;
    }
    const decision = requestQuietAcknowledgement({
      phase: "success",
      kind: "guide-ready",
      eventKey: `guide-ready:${roomId}:${loaded.sourceSnapshot}`
    });
    setGuideQuiet(decision.acknowledgement === "none" || !decision.status ? null : {
      acknowledgement: decision.acknowledgement,
      status: decision.status
    });
  }, [edition, loaded, roomId]);

  if (!loaded) {
    if (loadState === "loading") return <p className="setupLead" role="status">Loading your saved guide…</p>;
    if (loadState === "error") return <div className="materialsGuideRecovery"><p role="status">Your saved guide could not be loaded. Your original files are still available above.</p><button type="button" className="ghostButton" onClick={() => setReload((value) => value + 1)}>Try loading guide again</button></div>;
    return <p className="setupLead">{phase3Materials ? "No generated guide yet. Once your files are readable, it will appear here; your original files remain available above." : "Your guide will show up here after your files are ready."}</p>;
  }

  const model = guidePreviewModel(loaded);
  const printText = guidePrintEdition(loaded, showAnswers);
  const sourceLinks = (refs: Array<{ blockKey: string; pageNumber: number }>) => refs.map((ref) => {
    const label = ref.pageNumber > 0 ? `Source, page ${ref.pageNumber}` : "Source passage";
    return phase3Materials
      ? <button className="materialsCitation" type="button" key={ref.blockKey} aria-expanded={source?.blockKey === ref.blockKey} aria-controls={sourcePanelId} onClick={(event) => void inspectSource(ref.blockKey, ref.pageNumber, event.currentTarget)}>{label}</button>
      : <a key={ref.blockKey} href={evidenceHref(roomId, ref.blockKey)}>{label}</a>;
  });
  return (
    <article className="guideReading" aria-label="Study guide preview" style={{ overflowWrap: "anywhere", background: "#fff", maxWidth: phase3Materials ? undefined : 320 }}>
      <p className="tinyLabel">Guide · {model.level} · version {model.version} · {model.sourceCount} sources</p>
      <h2>{model.title}</h2>
      {updateAvailable && <p className="setupLead" role="status">Your sources have changed since this guide was saved. Check cited passages against the originals; this guide may be out of date.</p>}
      <div className="guideActions lessonProgressRow" data-quiet={guideQuiet?.acknowledgement ?? "none"}>
        {guideQuiet?.status ? <p className="quietStatus" role="status">{guideQuiet.status}</p> : null}
        <StudyGuideDownloadButton roomId={roomId} />
        <StudyGuideDownloadButton roomId={roomId} format="docx" />
        <button type="button" aria-label="Print generated Studigo guide" onClick={() => window.print()}>Print</button>
      </div>
      <pre className="guidePrintSheet" aria-hidden="true">{printText}</pre>
      {phase3Materials && source && <aside id={sourcePanelId} className="materialsSourceSpotlight" aria-label="Source passage" onKeyDown={(event) => { if (event.key === "Escape") closeSource(); }}>
        <div className="materialsSourceTop"><h3 ref={sourceHeading} tabIndex={-1}>Source passage{source.pageNumber > 0 ? ` · page ${source.pageNumber}` : ""}</h3><button type="button" onClick={closeSource}>Close</button></div>
        {source.state === "loading" && <p role="status">Checking the current source…</p>}
        {source.state === "unavailable" && <><p role="status">This passage is unavailable or no longer current. Check the original files above. Studigo will not substitute a passage from another source.</p><button className="ghostButton" type="button" onClick={() => { if (sourceTrigger.current) void inspectSource(source.blockKey, source.pageNumber, sourceTrigger.current); }}>Check passage again</button></>}
        {source.state === "ready" && <>
          <p className="materialsSourceName">{source.document?.name ?? "Current source"}</p>
          <blockquote>{source.text}</blockquote>
          {source.document?.id && <a href={`/api/documents/download?documentId=${encodeURIComponent(source.document.id)}&inline=1${source.document.mimeType === "application/pdf" && source.pageNumber > 0 ? `&page=${source.pageNumber}` : ""}`} target="_blank" rel="noreferrer">Open original{source.document.mimeType === "application/pdf" && source.pageNumber > 0 ? ` at page ${source.pageNumber}` : ""}</a>}
        </>}
      </aside>}
      {loaded.chapters.map((chapter) => (
        <section key={chapter.id}>
          <h3>{chapter.title}</h3>
          {chapter.facts.map((fact) => (
            <p key={fact.id}>
              {fact.text}{" "}
              {sourceLinks(fact.evidence)}
            </p>
          ))}
          {chapter.terms.map((term) => (
            <p key={term.id}><strong>{term.term}.</strong> {term.definition} {sourceLinks(term.evidence)}</p>
          ))}
          {chapter.examples.map((example) => <p key={example.id}>{example.text} {sourceLinks(example.evidence)}</p>)}
          <h4>Practice</h4>
          <ol>
            {chapter.practice.map((question) => <li key={question.id}>{question.prompt} {sourceLinks(question.evidence)}</li>)}
          </ol>
          <h4>Answers</h4>
          {showAnswers ? (
            <><button type="button" onClick={() => setShowAnswers(false)}>Hide answers</button><ol className="guideAnswerKey">
              {chapter.answers.map((answer) => <li key={answer.id}>{answer.text} {sourceLinks(answer.evidence)}</li>)}
            </ol></>
          ) : (
            <button type="button" onClick={() => setShowAnswers(true)}>Show answers</button>
          )}
        </section>
      ))}
    </article>
  );
}
