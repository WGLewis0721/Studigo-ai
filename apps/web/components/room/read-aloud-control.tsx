"use client";

import { useEffect, useRef, useState } from "react";

/** Explicit on-demand OS/browser speech. Never autoplays or records audio. */
export function ReadAloudControl({ text, label = "Read this aloud" }: { text: string; label?: string }) {
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused" | "unavailable">("idle");
  useEffect(() => () => {
    if (utterance.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utterance.current = null;
  }, []);
  function play() {
    if (!text.trim()) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setStatus("unavailable");
      return;
    }
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text.slice(0, 2400));
    message.lang = document.documentElement.lang || navigator.language || "en-US";
    message.rate = 0.93;
    message.onend = () => { utterance.current = null; setStatus("idle"); };
    message.onerror = () => { utterance.current = null; setStatus("unavailable"); };
    utterance.current = message;
    window.speechSynthesis.speak(message);
    setStatus("playing");
  }
  function pause() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }
  function resume() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setStatus("playing");
  }
  function stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utterance.current = null;
    setStatus("idle");
  }
  return <div className="readAloudControl" role="group" aria-label={label}>
    {status === "playing" ? <button type="button" onClick={pause}>Pause reading</button> :
      status === "paused" ? <button type="button" onClick={resume}>Resume reading</button> :
        <button type="button" onClick={play} disabled={!text.trim()}>Read to me</button>}
    {(status === "playing" || status === "paused") &&
      <button type="button" onClick={stop}>Stop</button>}
    {status === "unavailable" && <span role="status">Audio is unavailable. The text is still here.</span>}
  </div>;
}
