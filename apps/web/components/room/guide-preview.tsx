"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { evidenceHref, guidePreviewModel } from "@/lib/guide-preview";
import { guideOutlineHeading, guideFactExcerpt, guideSourceSegments, guideChapterNotes } from "@/lib/guide-outline";
import { guidePrintEdition } from "@/lib/guide-share";
import { requestQuietAcknowledgement, type QuietAcknowledgement } from "@/lib/quiet-feedback";
import { StudyGuideDownloadButton } from "./study-guide-download-button";
import { RichText } from "./rich-text";
import { CitationChips, type Citation } from "./citations";
import { createGestureBook, operationHeaders } from "@/lib/ai-operation-client";

export function GuidePreview({
  roomId,
  edition,
  initialAnswersRevealed = false,
  phase3Materials = false,
  topics = [],
  sourceRevision = ""
}: {
  roomId: string;
  edition?: StudyGuideContent | null;
  initialAnswersRevealed?: boolean;
  phase3Materials?: boolean;
  topics?: Array<{ id: string; title: string }>;
  sourceRevision?: string;
}) {
  const [loaded, setLoaded] = useState<StudyGuideContent | null>(edition ?? null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(edition !== undefined ? "ready" : "loading");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [showAnswers, setShowAnswers] = useState(initialAnswersRevealed);
  const [notesTopicId, setNotesTopicId] = useState("");
  const [notesByTopic, setNotesByTopic] = useState<Record<string, { text: string; citations: Citation[] }>>({});
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const noteRequests = useRef(0);
  const noteGestures = useRef(createGestureBook());
  const [guideQuiet, setGuideQuiet] = useState<{ acknowledgement: Exclude<QuietAcknowledgement, "none">; status: string } | null>(null);
  const [source, setSource] = useState<{ state: "loading" | "ready" | "unavailable"; blockKey: string; pageNumber: number; text?: string; document?: { id: string; name?: string; mimeType?: string } } | null>(null);
  const sourcePanelId = useId();
  const sourceRequest = useRef(0);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement | null>(null);

  function closeSource() {
    sourceRequest.current += 1;
    sourceDialog.current?.close();
    setSource(null);
    sourceTrigger.current?.focus({ preventScroll: true });
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

  useEffect(() => {
    if (!source) return;
    const dialog = sourceDialog.current;
    // Native top layer keeps the companion/navigation behind the sheet and
    // supplies focus containment, including while a source request is pending.
    if (dialog && !dialog.open) dialog.showModal();
    sourceHeading.current?.focus({ preventScroll: true });
  }, [source?.blockKey]);

  useEffect(() => {
    sourceRequest.current += 1;
    setSource(null);
    noteRequests.current += 1;
    setNotesByTopic({});
    setNotesBusy(false);
    setNotesError(null);
    setNotesTopicId("");
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

  const availableTopics = topics.filter((topic) =>
    loaded.topicIds.length === 0 || loaded.topicIds.includes(topic.id)
  );
  const selectedTopic = availableTopics.find((topic) => topic.id === notesTopicId) ?? availableTopics[0] ?? null;
  const selectedNotes = selectedTopic ? notesByTopic[selectedTopic.id] : null;

  // Deliberate learner gesture: reuse the existing admitted/cited Learn pipeline,
  // not a new unmetered guide generator or an automatic provider call on mount.
  async function explainWithStudigo() {
    if (!selectedTopic || notesBusy || selectedNotes) return;
    const body = JSON.stringify({ roomId, topicId: selectedTopic.id });
    const slot = `materials-note:${roomId}:${selectedTopic.id}`;
    const attempt = noteGestures.current.begin(slot, body);
    if (!attempt.started) return;
    const request = ++noteRequests.current;
    setNotesBusy(true);
    setNotesError(null);
    try {
      const response = await fetch("/api/learn", {
        method: "POST", headers: operationHeaders(attempt.id), body
      });
      noteGestures.current.finish(slot, response.status);
      const payload = await response.json().catch(() => null) as
        { explanation?: string; error?: string; citations?: Citation[] } | null;
      if (!response.ok || typeof payload?.explanation !== "string" || !payload.explanation.trim()) {
        throw new Error(payload?.error || "Studigo could not explain that topic from these materials.");
      }
      if (request !== noteRequests.current) return;
      setNotesByTopic((current) => ({
        ...current,
        [selectedTopic.id]: {
          text: payload.explanation!,
          citations: Array.isArray(payload.citations) ? payload.citations : []
        }
      }));
    } catch (error) {
      noteGestures.current.abort(slot);
      if (request === noteRequests.current) {
        setNotesError(error instanceof Error ? error.message : "Could not load your notes.");
      }
    } finally {
      if (request === noteRequests.current) setNotesBusy(false);
    }
  }

  const model = guidePreviewModel(loaded);
  const printText = guidePrintEdition(loaded, showAnswers);
  const sourceLinks = (refs: Array<{ blockKey: string; pageNumber: number }>) => refs.map((ref) => {
    const label = ref.pageNumber > 0 ? `Check source · page ${ref.pageNumber}` : "Check source passage";
    return phase3Materials
      ? <button className="materialsCitation" type="button" key={ref.blockKey} aria-expanded={source?.blockKey === ref.blockKey} aria-controls={sourcePanelId} onClick={(event) => void inspectSource(ref.blockKey, ref.pageNumber, event.currentTarget)}>{label}</button>
      : <a key={ref.blockKey} href={evidenceHref(roomId, ref.blockKey)}>{label}</a>;
  });
  return (
    <article className="guideReading" aria-label="Study guide preview" style={{ overflowWrap: "anywhere", background: "#fff", maxWidth: phase3Materials ? undefined : 320 }}>
      <div className="materialsGuideProvenance">
        <span className="tinyLabel">STUDIGO GUIDE · VERSION {model.version}</span>
        <span className="materialsGuideEvidence">{model.sourceCount} {model.sourceCount === 1 ? "cited source" : "cited sources"} · {model.level}</span>
      </div>
      <h2 className={phase3Materials ? "guideOutlineTitle" : undefined}>{phase3Materials ? "Study notes from your materials" : model.title}</h2>
      {updateAvailable && <p className="materialsGuideStale" role="status">
        <strong>Source changes need review.</strong>{" "}
        This saved guide may not reflect the current uploads. Verify its citations against the original files before studying from it.
      </p>}
      <div className="guideActions lessonProgressRow" data-quiet={guideQuiet?.acknowledgement ?? "none"}>
        {guideQuiet?.status ? <p className="quietStatus" role="status">{guideQuiet.status}</p> : null}
        <StudyGuideDownloadButton roomId={roomId} compactLabel={phase3Materials} />
        <StudyGuideDownloadButton roomId={roomId} format="docx" compactLabel={phase3Materials} />
        <button type="button" aria-label="Print generated Studigo guide" onClick={() => window.print()}>Print</button>
      </div>
      <pre className="guidePrintSheet" aria-hidden="true">{printText}</pre>
      {phase3Materials && availableTopics.length > 0 && (
        <section className="guideLearnOnDemand" aria-label="Explain a source-backed topic">
          <span className="tinyLabel guideLearnKicker">LEARN · FROM YOUR MATERIALS</span>
          <h3>Understand a topic</h3>
          <p>Get a short, source-cited explanation using Studigo's established Learn engine. Your original guide stays intact.</p>
          <div className="guideLearnControls">
            <label htmlFor={`${sourcePanelId}-learn-topic`}>Topic</label>
            <select id={`${sourcePanelId}-learn-topic`} value={selectedTopic?.id ?? ""} disabled={notesBusy} onChange={(event) => {
              noteRequests.current += 1;
              setNotesBusy(false);
              setNotesError(null);
              setNotesTopicId(event.currentTarget.value);
            }}>
              {availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
            {!selectedNotes && <button className="ghostButton" type="button" onClick={() => void explainWithStudigo()} disabled={notesBusy}>
              {notesBusy ? "Explaining…" : "Explain with Studigo"}
            </button>}
          </div>
          {notesError && <p className="guideNeedsReview" role="status">{notesError}</p>}
          {selectedNotes && (
            <div className="guideLearnAnswer">
              <RichText text={selectedNotes.text} className="lessonText" />
              <CitationChips citations={selectedNotes.citations} />
            </div>
          )}
        </section>
      )}
      {phase3Materials && source && <dialog ref={sourceDialog} id={sourcePanelId} className="materialsSourceSpotlight materialsSourceDialog" aria-labelledby={`${sourcePanelId}-title`} onCancel={(event) => { event.preventDefault(); closeSource(); }}>
        <div className="materialsSourceTop"><h3 id={`${sourcePanelId}-title`} ref={sourceHeading} tabIndex={-1}>Source passage{source.pageNumber > 0 ? ` · page ${source.pageNumber}` : ""}</h3><button type="button" onClick={closeSource}>Close</button></div>
        {source.state === "loading" && <p role="status">Checking the current source…</p>}
        {source.state === "unavailable" && <><p role="status">This passage is unavailable or no longer current. Check the original files above. Studigo will not substitute a passage from another source.</p><button className="ghostButton" type="button" onClick={() => { if (sourceTrigger.current) void inspectSource(source.blockKey, source.pageNumber, sourceTrigger.current); }}>Check passage again</button></>}
        {source.state === "ready" && <>
          <p className="materialsSourceName"><span>Original source</span><strong>{source.document?.name ?? "Authorized source passage"}</strong></p>
          <blockquote>{source.text}</blockquote>
          {source.document?.id && <a href={`/api/documents/download?documentId=${encodeURIComponent(source.document.id)}&inline=1${source.document.mimeType === "application/pdf" && source.pageNumber > 0 ? `&page=${source.pageNumber}` : ""}`} target="_blank" rel="noreferrer">Open original{source.document.mimeType === "application/pdf" && source.pageNumber > 0 ? ` at page ${source.pageNumber}` : ""}</a>}
        </>}
      </dialog>}
      {loaded.chapters.map((chapter, chapterIndex) => phase3Materials ? (
        <section key={chapter.id} className="guideOutlineChapter guideLearnCard" aria-label={guideOutlineHeading(chapter.title, chapterIndex).heading}>
          <div className="guideOutlineChapterHeading">
            <span className="tinyLabel guideLearnKicker">LEARN · FROM YOUR MATERIALS · SECTION {chapterIndex + 1}</span>
            <h3>{guideOutlineHeading(chapter.title, chapterIndex).heading}</h3>
          </div>
          {guideOutlineHeading(chapter.title, chapterIndex).oversized && (
            <details className="guideOutlineOriginal">
              <summary>View original heading and source wording</summary>
              <div className="guideSourceOutline" aria-label="Original source wording, organized into readable passages">
                {guideSourceSegments(chapter.title, chapter.terms.map((term) => term.term)).map((passage, index) =>
                  <p key={index}>{passage.trim()}</p>
                )}
              </div>
              {sourceLinks(chapter.objectiveEvidence)}
            </details>
          )}
          {guideChapterNotes(chapter).lead && (
            <p className="guideLearnLead">
              <strong>{guideChapterNotes(chapter).lead?.text}</strong>
              {sourceLinks(guideChapterNotes(chapter).lead?.evidence ?? [])}
            </p>
          )}
          {guideChapterNotes(chapter).idea.length > 0 && (
            <div className="guideOutlineGroup">
              <h4>The idea</h4>
              <ul className="guideOutlinePoints">
                {guideChapterNotes(chapter).idea.map((fact) => <li key={fact.id}>
                  {fact.text} {sourceLinks(fact.evidence)}
                </li>)}
              </ul>
            </div>
          )}
          {guideChapterNotes(chapter).why.length > 0 && (
            <div className="guideOutlineGroup">
              <h4>Why it matters</h4>
              <ul className="guideOutlinePoints">
                {guideChapterNotes(chapter).why.map((fact) => <li key={fact.id}>
                  {fact.text} {sourceLinks(fact.evidence)}
                </li>)}
              </ul>
            </div>
          )}
          {guideChapterNotes(chapter).raw.length > 0 && (
            <details className="guideOutlineOriginal guideRawNotes">
              <summary>Read unformatted source passage ({guideChapterNotes(chapter).raw.length})</summary>
              {guideChapterNotes(chapter).raw.map((fact) => (
                <div key={fact.id} className="guideSourceOutline">
                  {guideSourceSegments(fact.text, chapter.terms.map((term) => term.term)).map((passage, index) =>
                    <p key={index}>{passage.trim()}</p>
                  )}
                  {sourceLinks(fact.evidence)}
                </div>
              ))}
            </details>
          )}
          {guideChapterNotes(chapter).needsSourceReview && (
            <p className="guideNeedsReview">This scanned passage has no reliable short notes yet. Check the original source before studying it.</p>
          )}
          {chapter.terms.length > 0 && (
            <div className="guideOutlineGroup">
              <h4>Vocabulary</h4>
              <dl className="guideOutlineTerms">
                {chapter.terms.map((term) => {
                  const note = guideFactExcerpt(term.definition, 225);
                  return (
                    <div className="guideOutlineTerm" key={term.id}>
                      <dt>{term.term}</dt>
                      <dd>{note.long ? (
                        <details className="guideOutlineLongNote">
                          <summary>{note.excerpt}</summary>
                          <p>{term.definition}</p>
                        </details>
                      ) : term.definition}
                      {sourceLinks(term.evidence)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
          {chapter.examples.length > 0 && (
            <div className="guideOutlineGroup">
              <h4>Examples</h4>
              <ul className="guideOutlinePoints">
                {chapter.examples.map((example) => <li key={example.id}>
                  {example.text} {sourceLinks(example.evidence)}
                </li>)}
              </ul>
            </div>
          )}
          {chapter.practice.length > 0 && (
            <details className="guideOutlinePractice">
              <summary>Practice questions ({chapter.practice.length})</summary>
              <ol>
                {chapter.practice.map((question) => <li key={question.id}>{question.prompt} {sourceLinks(question.evidence)}</li>)}
              </ol>
              {showAnswers ? (
                <><button type="button" onClick={() => setShowAnswers(false)}>Hide answers</button>
                  <ol className="guideAnswerKey">
                    {chapter.answers.map((answer) => <li key={answer.id}>{answer.text} {sourceLinks(answer.evidence)}</li>)}
                  </ol></>
              ) : <button type="button" onClick={() => setShowAnswers(true)}>Show answers</button>}
            </details>
          )}
        </section>
      ) : (
        <section key={chapter.id}>
          <h3>{chapter.title}</h3>
          {chapter.facts.map((fact) => <p key={fact.id}>{fact.text} {sourceLinks(fact.evidence)}</p>)}
          {chapter.terms.map((term) => <p key={term.id}><strong>{term.term}.</strong> {term.definition} {sourceLinks(term.evidence)}</p>)}
          {chapter.examples.map((example) => <p key={example.id}>{example.text} {sourceLinks(example.evidence)}</p>)}
          <h4>Practice</h4>
          <ol>{chapter.practice.map((question) => <li key={question.id}>{question.prompt} {sourceLinks(question.evidence)}</li>)}</ol>
          <h4>Answers</h4>
          {showAnswers ? (
            <><button type="button" onClick={() => setShowAnswers(false)}>Hide answers</button>
              <ol className="guideAnswerKey">{chapter.answers.map((answer) => <li key={answer.id}>{answer.text} {sourceLinks(answer.evidence)}</li>)}</ol></>
          ) : <button type="button" onClick={() => setShowAnswers(true)}>Show answers</button>}
        </section>
      ))}
    </article>
  );
}
