"use client";

import { useEffect, useState } from "react";
import type { StudyGuideContent } from "@studigo/ai";
import { evidenceHref, guidePreviewModel } from "@/lib/guide-preview";
import { StudyGuideDownloadButton } from "./study-guide-download-button";

export function GuidePreview({
  roomId,
  edition
}: {
  roomId: string;
  edition?: StudyGuideContent | null;
}) {
  const [loaded, setLoaded] = useState<StudyGuideContent | null>(edition ?? null);
  const [showAnswers, setShowAnswers] = useState(false);

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
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [edition, roomId]);

  if (!loaded) {
    return <p className="setupLead">Your guide will show up here after your files are ready.</p>;
  }

  const model = guidePreviewModel(loaded);
  return (
    <article className="guideReading" aria-label="Study guide preview" style={{ overflowWrap: "anywhere", background: "#fff", maxWidth: 320 }}>
      <p className="tinyLabel">Guide · {model.level} · version {model.version} · {model.sourceCount} sources</p>
      <h2>{model.title}</h2>
      <div className="guideActions">
        <StudyGuideDownloadButton roomId={roomId} />
        <StudyGuideDownloadButton roomId={roomId} format="docx" />
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>
      {loaded.chapters.map((chapter) => (
        <section key={chapter.id}>
          <h3>{chapter.title}</h3>
          {chapter.facts.map((fact) => (
            <p key={fact.id}>
              {fact.text}{" "}
              {fact.evidence.map((ref) => (
                <a key={ref.blockKey} href={evidenceHref(roomId, ref.blockKey)}>Source, page {ref.pageNumber}</a>
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
            <ol>
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
