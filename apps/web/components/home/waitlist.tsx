"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type State = "idle" | "sending" | "success" | "error";

export function StudigoWaitlist() {
  const video = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState(false);
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || !motion) {
      element?.pause();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void element.play().catch(() => setMotion(false));
      else element.pause();
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => { observer.disconnect(); element.pause(); };
  }, [motion]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setState("sending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "studigo-learning", email: String(values.get("email") || "").trim(), consent: values.get("consent") === "on", source: "homepage" }),
      });
      const result = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
      if (!response.ok || result?.ok !== true) throw new Error("Waitlist is unavailable");
      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="studigoWaitlist" id="waitlist" aria-labelledby="studigo-waitlist-title">
      <div className="wrap studigoWaitlistGrid">
        <div className="studigoWaitlistCopy">
          <span className="kicker">THE IPHONE &amp; IPAD BETA</span>
          <h2 id="studigo-waitlist-title">Your class material, <em>in your pocket.</em></h2>
          <p>Bring the guide, slides, and notes you were actually given. Studigo turns them into a Study Room that teaches, quizzes, and shows the page behind an answer.</p>
          <form onSubmit={submit} className="studigoWaitlistForm">
            <label htmlFor="studigo-beta-email">Email for your beta invitation</label>
            <div className="studigoWaitlistFields"><input id="studigo-beta-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={state === "sending"} /><button className="buttonPrimary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Joining…" : "Join the beta list"}</button></div>
            <label className="studigoWaitlistConsent"><input name="consent" type="checkbox" required disabled={state === "sending"} /> Email me about the Studigo beta and my invitation. If this is for a child, use a parent or guardian email.</label>
            <p className="studigoWaitlistFeedback" role="status" aria-live="polite">{state === "success" ? "You're on the list. Watch your inbox for a beta invitation." : state === "error" ? "We couldn't add you yet. Please try again later." : "The web Study Room is already open. This list is for the iPhone and iPad beta."}</p>
          </form>
        </div>
        <div className="studigoWaitlistVisual">
          <video ref={video} loop muted playsInline preload="none" poster="/waitlist/studigo-poster.webp" aria-label="A study guide opens, revealing colored sections of the learner's material"><source src="/waitlist/studigo-loop.mp4" type="video/mp4" /></video>
          <button type="button" className="studigoWaitlistMotion" aria-label={motion ? "Pause waitlist motion" : "Play waitlist motion"} aria-pressed={motion} onClick={() => setMotion(value => !value)}>{motion ? "Pause motion" : "Play motion"}</button>
        </div>
      </div>
    </section>
  );
}
