"use client";

import { useEffect, useRef, useState } from "react";

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
type SpeechErrorEvent = { error: string };
type DeviceRecognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => DeviceRecognizer;
  webkitSpeechRecognition?: new () => DeviceRecognizer;
};

/** Optional, explicitly initiated browser speech preview.
 * No audio bytes reach Studigo; browser speech services may process audio.
 * Full production release requires consent, locale and provider safeguards. */
export function SpeechAnswerControl({ onUse, disabled = false }: {
  onUse: (text: string) => void;
  disabled?: boolean;
}) {
  const recognition = useRef<DeviceRecognizer | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => { recognition.current?.abort(); recognition.current = null; }, []);
  // Native top-layer dialog avoids getting clipped beneath the scrolling
  // lesson canvas on narrow devices; Escape cancels safely without submitting.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);
  function start() {
    if (!acknowledged || disabled) return;
    recognition.current?.abort();
    const device = window as RecognitionWindow;
    const Recognition = device.SpeechRecognition ?? device.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("Voice recognition isn't available here. Use your keyboard or device dictation.");
      return;
    }
    try {
      const listener = new Recognition();
      recognition.current = listener;
      listener.lang = document.documentElement.lang || navigator.language || "en-US";
      listener.continuous = false;
      listener.interimResults = false;
      listener.onresult = (event) => {
        const value = Array.from(event.results).slice(event.resultIndex)
          .map((part) => part[0]?.transcript ?? "").join(" ").trim();
        if (value) { setTranscript(value); setStatus("Review the transcript before using it."); }
        else setStatus("No words detected. Try again or type.");
      };
      listener.onerror = (event) => {
        setStatus(event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission denied. Use typing or device dictation."
          : "Voice wasn't understood. Try again or type your answer.");
        setListening(false);
      };
      listener.onend = () => { setListening(false); recognition.current = null; };
      listener.start();
      setListening(true);
      setStatus("Listening only while you record. Stop whenever you want.");
    } catch {
      setListening(false);
      setStatus("Voice unavailable. You can still type or use device dictation.");
    }
  }
  function stop() { recognition.current?.stop(); setListening(false); }
  function dismiss() { recognition.current?.abort(); recognition.current = null; setListening(false); dialogRef.current?.close(); setOpen(false); setStatus(null); triggerRef.current?.focus(); }
  return <div className="voiceAnswerControl">
    <button ref={triggerRef} type="button" className="voiceMicButton" disabled={disabled}
      aria-label="Speak a draft answer" aria-expanded={open} onClick={() => { if (open) dismiss(); else setOpen(true); }}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>
      </svg>
    </button>
    {open && <dialog ref={dialogRef} className="voiceAnswerReview" aria-label="Voice response draft"
      onCancel={(event) => { event.preventDefault(); dismiss(); }} onClose={() => { if (open) dismiss(); }}>
      <strong>Speak an answer</strong>
      <label className="voiceConsent"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
        <span>Your browser's speech service may process audio. Studigo does not store the recording. Only enable with appropriate consent.</span>
      </label>
      <div className="voiceReviewActions">
        {listening ? <button type="button" onClick={stop}>Stop recording</button> :
          <button type="button" disabled={!acknowledged || disabled} onClick={start}>{transcript ? "Retry speech" : "Start speaking"}</button>}
        <button type="button" onClick={dismiss}>Close</button>
      </div>
      {status && <p role="status">{status}</p>}
      {transcript && <><label htmlFor="voice-transcript">Review and edit what was heard</label>
        <textarea id="voice-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)}
          aria-label="Edit speech transcript" rows={3}/>
        <button type="button" disabled={!transcript.trim()} onClick={() => {
          onUse(transcript.trim()); dismiss();
        }}>Use transcript in answer field</button>
        <p className="voiceReviewNote">This fills your answer. It does not submit or grade anything.</p>
      </>}
    </dialog>}
  </div>;
}
