"use client";

import { useEffect, useRef, useState } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { evidenceHref, guidePreviewModel } from "@/lib/guide-preview";
import { guidePrintEdition } from "@/lib/guide-share";
import { requestQuietAcknowledgement, type QuietAcknowledgement } from "@/lib/quiet-feedback";
import { StudyGuideDownloadButton } from "./study-guide-download-button";

export function GuidePreview({
  roomId,
  edition,
  initialAnswersRevealed = false,
  phase3Materials = false
}: {
  roomId: string;
  edition?: StudyGuideContent | null;
  initialAnswersRevealed?: boolean;
  phase3Materials?: boolean;
}) {
  const [loaded, setLoaded] = useState<StudyGuideContent | null>(edition ?? null);
  const [showAnswers, setShowAnswers] = useState(initialAnswersRevealed);
  const [guideQuiet, setGuideQuiet] = useState<{ acknowledgement: Exclude<QuietAcknowledgement, "none">; status: string } | null>(null);
  const [source, setSource] = useState<{ state: "loading" | "ready" | "unavailable"; blockKey: string; pageNumber: number; text?: string; document?: { id: string; name?: string; mimeType?: string } } | null>(null);
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
        setSource({ state: "ready", blockKey, pageNumber: body.pageNumber ?? pageNumber, text: body.text, document: body.document });
      }
    } catch {
      if (request === sourceRequest.current) setSource({ state: "unavailable", blockKey, pageNumber });
    }
  }

  useEffect(() => { if (source) sourceHeading.current?.focus(); }, [source?.blockKey, source?.state]);

  useEffect(() => {
    if (edition !== undefined) {
      setLoaded(edition);
      return;
    }
    let stopped = false;
    void fetch(`/api/guides/edition?roomId=${encodeURIComponent(roomId)}`)
      .then(async (response) => {
        if (!response.ok || stopped) return;
        const body = await response.json().catch(() => null) as { edition?: StudyGuideContent | null } | null;
        if (!stopped) setLoaded(body?.edition ?? null);
      })
      .catch(() => {
        if (!stopped) {
          requestQuietAcknowledgement({ phase: "error", kind: "guide-ready", eventKey: `guide-ready:${roomId}` });
          setGuideQuiet(null);
        }
      });
    return () => {
      stopped = true;
    };
  }, [edition, roomId]);

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
    return <p className="setupLead">{phase3Materials ? "No generated guide yet. Once your files are readable, it will appear here; your original files remain available above." : "Your guide will show up here after your files are ready."}</p>;
  }

  const model = guidePreviewModel(loaded);
  const printText = guidePrintEdition(loaded, showAnswers);
  return (
    <article className="guideReading" aria-label="Study guide preview" style={{ overflowWrap: "anywhere", background: "#fff", maxWidth: phase3Materials ? undefined : 320 }}>
      <p className="tinyLabel">Guide · {model.level} · version {model.version} · {model.sourceCount} sources</p>
      <h2>{model.title}</h2>
      <div className="guideActions lessonProgressRow" data-quiet={guideQuiet?.acknowledgement ?? "none"}>
        {guideQuiet?.status ? <p className="quietStatus" role="status">{guideQuiet.status}</p> : null}
        <StudyGuideDownloadButton roomId={roomId} />
        <StudyGuideDownloadButton roomId={roomId} format="docx" />
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>
      <pre className="guidePrintSheet" aria-hidden="true">{printText}</pre>
      {phase3Materials && source && <aside className="materialsSourceSpotlight" aria-label="Source passage" onKeyDown={(event) => { if (event.key === "Escape") closeSource(); }}>
        <div className="materialsSourceTop"><h3 ref={sourceHeading} tabIndex={-1}>Source passage · page {source.pageNumber}</h3><button type="button" onClick={closeSource}>Close</button></div>
        {source.state === "loading" && <p role="status">Checking the current source…</p>}
        {source.state === "unavailable" && <p role="status">This passage is unavailable or no longer current. Check the original files above, or refresh the guide after your sources are ready.</p>}
        {source.state === "ready" && <>
          <p className="materialsSourceName">{source.document?.name ?? "Current source"}</p>
          <blockquote>{source.text}</blockquote>
          {source.document?.id && <a href={`/api/documents/download?documentId=${encodeURIComponent(source.document.id)}&inline=1${source.document.mimeType === "application/pdf" && source.pageNumber > 0 ? `&page=${source.pageNumber}` : ""}`} target="_blank" rel="noreferrer">Open original{source.document.mimeType === "application/pdf" ? ` at page ${source.pageNumber}` : ""}</a>}
        </>}
      </aside>}
      {loaded.chapters.map((chapter) => (
        <section key={chapter.id}>
          <h3>{chapter.title}</h3>
          {chapter.facts.map((fact) => (
            <p key={fact.id}>
              {fact.text}{" "}
              {fact.evidence.map((ref) => (
                phase3Materials
                  ? <button className="materialsCitation" type="button" key={ref.blockKey} onClick={(event) => void inspectSource(ref.blockKey, ref.pageNumber, event.currentTarget)}>Source, page {ref.pageNumber}</button>
                  : <a key={ref.blockKey} href={evidenceHref(roomId, ref.blockKey)}>Source, page {ref.pageNumber}</a>
              ))}
            </p>
          ))}
          {chapter.terms.map((term) => (
            <p key={term.id}><strong>{term.term}.</strong> {term.definition}</p>
          ))}
          {chapter.examples.map((example) => <p key={example.id}>{example.text}</p>)}
          <h4>Practice</h4>
          <ol>
            {chapter.practice.map((question) => <li key={question.id}>{question.prompt}</li>)}
          </ol>
          <h4>Answers</h4>
          {showAnswers ? (
            <ol className="guideAnswerKey">
              {chapter.answers.map((answer) => <li key={answer.id}>{answer.text}</li>)}
            </ol>
          ) : (
            <button type="button" onClick={() => setShowAnswers(true)}>Show answers</button>
          )}
        </section>
      ))}
    </article>
  );
}
