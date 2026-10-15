"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/rooms";
import { operationHeaders } from "@/lib/ai-operation-client";
import { RichText } from "./rich-text";

type Step = { title: string; body: string };

const SAMPLES = {
  elementary: {
    source: "Behavior notes, p. 2",
    steps: [
      { title: "Inherited behavior", body: "Some animal behaviors are inherited. The animal is born knowing them. Nobody has to teach a spider to spin a web." },
      { title: "Learned behavior", body: "Other behaviors are learned through experience. A dog learns a trick by practicing it." },
    ] satisfies Step[],
  },
  college: {
    source: "Motion notes, p. 4",
    steps: [
      { title: "Net force", body: "A net force is the leftover force after every push and pull is combined. A net force changes an object's motion." },
      { title: "Balanced forces", body: "If the forces on an object are balanced, the net force is zero and its velocity stays the same." },
    ] satisfies Step[],
  },
} as const;

function lessonSteps(text: string): Step[] {
  const trimmed = text.replace(/\r/g, "").trim();
  if (!trimmed) return [];
  const chunks = trimmed.split(/\n(?=#{1,3}\s+)/);
  const headed = chunks.map((chunk) => {
    const lines = chunk.trim().split("\n");
    const first = lines[0]?.trim() ?? "";
    const heading = /^#{1,3}\s+/.test(first) || /^\*\*[^*]+\*\*$/.test(first);
    const title = first.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "").replace(/\s*\[\d+\]/g, "").trim();
    const body = (heading ? lines.slice(1) : lines).join("\n").trim();
    return { title: heading ? title : "The idea", body: body || title };
  }).filter((step) => step.body);
  if (headed.length > 1) return headed;
  const paragraphs = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return headed;
  return paragraphs.map((paragraph) => {
    const lines = paragraph.split("\n");
    const first = lines[0]?.trim() ?? "";
    const heading = /^#{1,3}\s+/.test(first) || /^\*\*[^*]+\*\*$/.test(first);
    const title = first.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "").replace(/\s*\[\d+\]/g, "").trim();
    const body = (heading ? lines.slice(1) : lines).join("\n").trim();
    return { title: heading ? title || "The idea" : "The idea", body: body || title };
  }).filter((step) => step.body);
}

export function LearnMission({ roomId, topics, selectedTopicId }: {
  roomId: string; topics: Topic[]; selectedTopicId: string | null; onOpenMaterials: () => void;
}) {
  const [sample, setSample] = useState<keyof typeof SAMPLES>("elementary");
  const [pickedTopicId, setPickedTopicId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const askedFor = useRef<string | null>(null);
  const gen = useRef(0);
  const fixture = roomId === "fixture";
  const topicId = fixture ? sample : pickedTopicId ?? selectedTopicId ?? topics[0]?.id ?? null;

  const open = useCallback(async (id: string) => {
    if (askedFor.current === id) return;
    askedFor.current = id;
    const token = ++gen.current;
    setOpening(true);
    setError(null);
    setSteps([]);
    setIndex(0);
    setSource(null);
    if (fixture) {
      const demo = SAMPLES[id === "college" ? "college" : "elementary"];
      setSteps(demo.steps);
      setSource(demo.source);
      setOpening(false);
      return;
    }
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/learn", {
          method: "POST",
          headers: operationHeaders(crypto.randomUUID()),
          body: JSON.stringify({ roomId, topicId: id }),
        });
        if (gen.current !== token) return;
        const payload = await response.json().catch(() => null) as {
          explanation?: string;
          error?: string;
          citations?: { documentName?: string; pageNumber?: number | null }[];
        } | null;
        if ((response.status === 429 || response.status === 503) && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 3000 + attempt * 2000));
          if (gen.current !== token) return;
          continue;
        }
        if (!response.ok || !payload?.explanation?.trim()) throw new Error(payload?.error || "Could not open this lesson.");
        const next = lessonSteps(payload.explanation);
        if (!next.length) throw new Error("Could not open this lesson.");
        setSteps(next);
        const cite = payload.citations?.find((item) => item.documentName);
        setSource(cite ? `${cite.documentName}${cite.pageNumber ? `, p. ${cite.pageNumber}` : ""}` : null);
        return;
      }
    } catch (caught) {
      if (gen.current !== token) return;
      askedFor.current = null;
      setError(caught instanceof Error ? caught.message : "Could not open this lesson.");
    } finally {
      if (gen.current === token) setOpening(false);
    }
  }, [fixture, roomId]);

  useEffect(() => {
    if (!topicId) return;
    void open(topicId);
  }, [open, topicId]);

  function continueGuide() {
    if (index < steps.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (fixture) {
      askedFor.current = null;
      setSample((current) => current === "elementary" ? "college" : "elementary");
      return;
    }
    const at = topics.findIndex((topic) => topic.id === topicId);
    const next = topics[at + 1] ?? topics[0];
    if (!next) return;
    askedFor.current = null;
    setPickedTopicId(next.id);
    void open(next.id);
  }

  const step = steps[index];
  const progress = steps.length ? Math.round(((index + 1) / steps.length) * 100) : 16;

  return <section className="learnReading" aria-label="Lesson">
    {fixture && <div className="learnSamples">{(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((key) => <button key={key} type="button" aria-pressed={sample === key} onClick={() => { askedFor.current = null; setSample(key); }}>{key === "college" ? "College sample" : "Elementary sample"}</button>)}</div>}
    <div className="learnBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Lesson progress">
      <span style={{ width: `${progress}%` }} />
    </div>
    {error && <p className="formError" role="alert">{error}</p>}
    {step ? <>
      <h2 className="learnAsk">{step.title}</h2>
      <div className="learnGuide"><RichText text={step.body} /></div>
      {source && <p className="learnSource">{source}</p>}
    </> : !error && <p className="learnAsk">Opening the lesson.</p>}
    <button className="buttonPrimary learnGo" type="button" disabled={opening || (!step && !error)} onClick={() => {
      if (!step && topicId) { askedFor.current = null; void open(topicId); return; }
      continueGuide();
    }}>{opening ? "Opening" : "Continue"}</button>
  </section>;
}
