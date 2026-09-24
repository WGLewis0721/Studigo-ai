"use client";

import { StudigoMascot } from "@/components/studigo-mascot";
import { useEffect, useRef, useState } from "react";
import { CitationChips, type Citation } from "./citations";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  grounded?: boolean;
  streaming?: boolean;
};

const STARTERS = [
  "What does the study guide say I need to know?",
  "Explain the hardest idea in this unit simply.",
  "What am I most likely to be tested on?"
];

export function AskPanel({
  roomId,
  readyCount,
  onOpenMaterials
}: {
  roomId: string;
  readyCount: number;
  onOpenMaterials: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messages.length) return;
    const frame = window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setQuestion("");
    setBusy(true);

    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "", streaming: true }
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, question: trimmed, conversationId: conversationId.current })
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Studigo couldn't answer that.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Server-sent events: one JSON object per `data:` line.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          const event = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            citations?: Citation[];
            grounded?: boolean;
            conversationId?: string;
            error?: string;
          };

          if (event.type === "start" && event.conversationId) {
            conversationId.current = event.conversationId;
          } else if (event.type === "delta" && event.text) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + event.text }
                  : message
              )
            );
          } else if (event.type === "done") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: event.text ?? message.content,
                      citations: event.citations ?? [],
                      grounded: event.grounded,
                      streaming: false
                    }
                  : message
              )
            );
          } else if (event.type === "error") {
            throw new Error(event.error || "Studigo couldn't finish that answer.");
          }
        }
      }
    } catch (askError) {
      const message = askError instanceof Error ? askError.message : "Something went wrong.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      setBusy(false);
    }
  }

  if (readyCount === 0) {
    return (
      <div className="modeEmpty">
        <h2>Studigo has nothing to answer from yet.</h2>
        <p>
          Ask mode only answers from this room's own materials — that's the point. Add the study
          guide, your notes, or the textbook pages first.
        </p>
        <button className="buttonPrimary" type="button" onClick={onOpenMaterials}>
          Add materials <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="askMode">
      <div className="askThread" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="askIntro">
            <StudigoMascot state="welcome" size={88} />
            <h2>Ask anything in this room.</h2>
            <p>
              Every answer comes from the {readyCount} processed{" "}
              {readyCount === 1 ? "source" : "sources"} here, and shows you where it came from.
            </p>
            <div className="starterList">
              {STARTERS.map((starter) => (
                <button key={starter} type="button" onClick={() => void ask(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div className="studentBubble" key={message.id}>
              {message.content}
            </div>
          ) : (
            <div className="answerBubble" key={message.id}>
              <span className="answerKicker">
                <StudigoMascot state={message.streaming ? "thinking" : "sources"} size={28} mark />
                {message.streaming
                  ? "READING YOUR MATERIALS…"
                  : message.grounded
                    ? "FROM YOUR MATERIALS"
                    : "NOT IN YOUR MATERIALS"}
              </span>
              <p className="answerText">
                {message.content}
                {message.streaming && <span className="caret" aria-hidden="true" />}
              </p>
              {message.citations && message.citations.length > 0 && (
                <CitationChips citations={message.citations} />
              )}
            </div>
          )
        )}
        <div ref={threadEndRef} className="threadEnd" aria-hidden="true" />
      </div>

      {error && (
        <p className="formError" role="alert">
          {error}
        </p>
      )}

      <form
        className="askComposer askComposerLive"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this unit…"
          aria-label="Ask Studigo a question"
          maxLength={4000}
          disabled={busy}
        />
        <button type="submit" aria-label="Send question" disabled={busy || !question.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
