"use client";

import { useState, type FormEvent } from "react";

type State = "idle" | "sending" | "success" | "error";

export function StudigoWaitlist() {
  const [state, setState] = useState<State>("idle");

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
        body: JSON.stringify({ name: String(values.get("name") || "").trim(), email: String(values.get("email") || "").trim(), website: String(values.get("website") || ""), consent: values.get("consent") === "on" }),
      });
      const result = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
      if (!response.ok || result?.ok !== true) throw new Error("Waitlist is unavailable");
      // The Sheet is the record. The alert is best-effort and cannot change signup status.
      void fetch("https://formsubmit.co/ajax/graymattertechllc@gmail.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `[Studigo] New beta waitlist signup: ${String(values.get("email") || "").trim()}`,
          _template: "table", _captcha: "false",
          _replyto: String(values.get("email") || "").trim(),
          product: "Studigo",
          name: String(values.get("name") || "").trim(),
          email: String(values.get("email") || "").trim(),
        }),
      }).catch(() => {});
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
            <label htmlFor="studigo-beta-name">Your name</label>
            <input className="studigoWaitlistName" id="studigo-beta-name" name="name" type="text" autoComplete="name" placeholder="Your name" maxLength={100} required disabled={state === "sending"} />
            <label htmlFor="studigo-beta-email">Email for your beta invitation</label>
            <input className="studigoWaitlistTrap" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="studigoWaitlistFields"><input id="studigo-beta-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={state === "sending"} /><button className="buttonPrimary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Joining…" : "Join the beta list"}</button></div>
            <label className="studigoWaitlistConsent"><input name="consent" type="checkbox" required disabled={state === "sending"} /> Email me about the Studigo beta and my invitation. If this is for a child, use a parent or guardian email.</label>
            <p className="studigoWaitlistFeedback" role="status" aria-live="polite">{state === "success" ? "You're on the list. Watch your inbox for a beta invitation." : state === "error" ? "We couldn't add you yet. Please try again later." : "The web Study Room is already open. This list is for the iPhone and iPad beta."}</p>
          </form>
        </div>
      </div>
    </section>
  );
}
