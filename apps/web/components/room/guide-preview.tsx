"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { evidenceHref, guidePreviewModel } from "@/lib/guide-preview";
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
  const sourcePanelId = useId();

  useEffect(() => {
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
  // The saved original guide remains available to download, not duplicated as
  // a second OCR-heavy learning card on Materials. Legacy preview retains its
  // original source links and answer key.
  const sourceLinks = (refs: Array<{ blockKey: string; pageNumber: number }>) =>
    refs.map((ref) => <a key={ref.blockKey} href={evidenceHref(roomId, ref.blockKey)}>Check source{ref.pageNumber > 0 ? ` · page ${ref.pageNumber}` : ""}</a>);
  return (
    <article className={`guideReading${phase3Materials ? " guideReadingFocused" : ""}`} aria-label={phase3Materials ? "Study notes" : "Study guide preview"} style={{ overflowWrap: "anywhere", background: "#fff", maxWidth: phase3Materials ? undefined : 320 }}>
      <div className="materialsGuideProvenance">
        <span className="tinyLabel">{phase3Materials ? `SAVED GUIDE · VERSION ${model.version}` : `STUDIGO GUIDE · VERSION ${model.version}`}</span>
        <span className="materialsGuideEvidence">{model.sourceCount} {model.sourceCount === 1 ? "cited source" : "cited sources"} · {model.level}</span>
      </div>
      <h2 className={phase3Materials ? "guideOutlineTitle" : undefined}>{phase3Materials ? "Study notes" : model.title}</h2>
      {updateAvailable && <p className="materialsGuideStale" role="status">
        <strong>Source changes need review.</strong>{" "}
        This saved guide may not reflect the current uploads. Verify its citations against the original files before studying from it.
      </p>}
      {phase3Materials ? (
        <details className="guideExports">
          <summary>Saved guide downloads</summary>
          <div className="guideActions lessonProgressRow">
            <StudyGuideDownloadButton roomId={roomId} compactLabel />
            <StudyGuideDownloadButton roomId={roomId} format="docx" compactLabel />
            <button type="button" aria-label="Print saved Studigo guide" onClick={() => window.print()}>Print</button>
          </div>
        </details>
      ) : (
        <div className="guideActions lessonProgressRow" data-quiet={guideQuiet?.acknowledgement ?? "none"}>
          {guideQuiet?.status ? <p className="quietStatus" role="status">{guideQuiet.status}</p> : null}
          <StudyGuideDownloadButton roomId={roomId} />
          <StudyGuideDownloadButton roomId={roomId} format="docx" />
          <button type="button" aria-label="Print generated Studigo guide" onClick={() => window.print()}>Print</button>
        </div>
      )}
      <pre className="guidePrintSheet" aria-hidden="true">{printText}</pre>
      {phase3Materials && availableTopics.length > 0 && (
        <section className="guideLearnOnDemand" aria-label="Explain a source-backed topic">
          <p className="guideLearnIntro">Choose a topic to get a clear explanation using your uploaded materials.</p>
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
            <div className="guideLearnAnswer" aria-live="polite">
              <RichText text={selectedNotes.text} className="lessonText" />
              <CitationChips citations={selectedNotes.citations} />
            </div>
          )}
        </section>
      )}
      {phase3Materials && availableTopics.length === 0 && (
        <p className="guideNeedsReview" role="status">No study topics are ready yet. Check the original files above, then refresh your study guide if needed.</p>
      )}
      {!phase3Materials && loaded.chapters.map((chapter) => (
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
