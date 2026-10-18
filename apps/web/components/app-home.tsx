"use client";

import "./app-home.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createFirstRoomAction } from "@/lib/actions/rooms";
import {
  FIRST_RUN_STEPS,
  SAMPLE,
  SAMPLE_LABEL,
  canLeaveMaterial,
  nextFirstRunStep,
  resumeFirstRun,
  roomTitleFromGuess,
  type FirstRunStep,
  type SampleGoal,
  roomEntryForFirstRun
} from "@/lib/first-run";
import type { HomeNext } from "@/lib/home-next";
import { ROOM_THEMES, saveRoomTheme, useRoomTheme, type RoomTheme } from "@/lib/room-theme";
import { LEAP_KEY } from "@/components/companion/companion";
import { StudigoStage, type StageHandle } from "@/components/companion/stage";

/** Fired when a room is opened from Home, so Studigo can leap toward it. */
export const LEAP_EVENT = "studigo:leap";
const foundationUi = process.env.NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI === "1";
type LeapDetail = { left: number; top: number; width: number; height: number };

/** Call from anything on Home that opens a room. He lands in his window on the other side. */
export function announceLeap(from: Element) {
  const r = from.getBoundingClientRect();
  try { window.sessionStorage.setItem(LEAP_KEY, "1"); } catch { /* storage is optional */ }
  window.dispatchEvent(new CustomEvent<LeapDetail>(LEAP_EVENT, { detail: { left: r.left, top: r.top, width: r.width, height: r.height } }));
}

function Sill() {
  return <span className="stageSill" aria-hidden="true"><span className="railLed" /><span className="railBrand">studigo</span></span>;
}

/** Home, with rooms: Studigo on his stage, what is next, and how far along the room is. */
export function HomeHero({ next }: { next: HomeNext }) {
  const [theme] = useRoomTheme(next.roomId);
  const stage = useRef<StageHandle>(null);
  const nextAction = next.mode === "materials" ? "Open Materials" : next.mode === "quiz" ? "Start a quiz" : next.mode === "cards" ? "Review flashcards" : "Open Learn";

  useEffect(() => {
    stage.current?.react("wave", 1700);
    const onLeap = (event: Event) => { void stage.current?.leapTo((event as CustomEvent<LeapDetail>).detail); };
    window.addEventListener(LEAP_EVENT, onLeap);
    return () => window.removeEventListener(LEAP_EVENT, onLeap);
  }, []);

  return (
    <section className="homeHero" data-tone={theme} data-ui={foundationUi ? "phase3" : undefined} aria-labelledby="home-title">
      <div className="stageScreen homeStage">
        <StudigoStage ref={stage} size={184} />
        <Sill />
      </div>
      <div className="homeSay">
        <span className="tinyLabel">{foundationUi ? "YOUR STUDY SPACE / NEXT STEP" : "UP NEXT"}</span>
        <h1 className="pageTitle" id="home-title">{next.title} is up next.</h1>
        <p className="pageLede">{next.line}</p>
      </div>
      <div className="nextUp">
        <div className="nextUpText">
          <span className="tinyLabel">{foundationUi ? "01 / " : "NEXT UP · "}{next.title.toUpperCase()}</span>
          <h2>{next.heading}</h2>
          <p>{next.note}</p>
          {next.progress && <p className="nextUpProgress">{next.progress}</p>}
        </div>
        <Link
          className="buttonPrimary"
          href={`/app/rooms/${next.roomId}?mode=${next.mode}`}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => announceLeap(event.currentTarget)}
        >
          {next.door ? "Resume" : foundationUi ? nextAction : "Continue"} <span aria-hidden="true">{foundationUi && !next.door ? "↗" : "→"}</span>
        </Link>
      </div>
    </section>
  );
}

const FIRST_RUN_KEY = "studigo-first-run";
const FIRST_RUN_PATH_KEY = "studigo-first-run-path";

const GOAL_LABEL: Record<SampleGoal, string> = {
  understand: "Understand",
  prepare: "Prepare for a test",
  practice: "Practice"
};

function objectiveFor(goal: SampleGoal, topicTitle: string) {
  const name = topicTitle.trim() || "this topic";
  if (goal === "prepare") return `Prepare for a test on ${name}.`;
  if (goal === "practice") return `Practice ${name}.`;
  return `Understand ${name}.`;
}

/**
 * Home, with no rooms yet. Order: sample or own file, correct subject and topic,
 * pick a goal, answer one question, then optionally name and color the room.
 * `fixture` runs the flow without creating anything (local preview only).
 */
export function FirstRoomSetup({ fixture = false }: { fixture?: boolean }) {
  const router = useRouter();
  const stage = useRef<StageHandle>(null);
  const [step, setStep] = useState<FirstRunStep>("material");
  const [materialPath, setMaterialPath] = useState<"sample" | "own">("sample");
  const [subject, setSubject] = useState<string>(SAMPLE.subject);
  const [topic, setTopic] = useState<string>(SAMPLE.topic);
  const [goal, setGoal] = useState<SampleGoal>(SAMPLE.goalChoices[0]);
  const goalButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [response, setResponse] = useState("");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<RoomTheme>("teal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepIndex = FIRST_RUN_STEPS.indexOf(step);

  useEffect(() => { stage.current?.react("wave", 1700); }, []);
  useEffect(() => {
    try {
      const savedPath = window.localStorage.getItem(FIRST_RUN_PATH_KEY);
      if (savedPath === "own") {
        setMaterialPath("own");
        setSubject("");
        setTopic("");
      }
      setStep(resumeFirstRun(window.localStorage.getItem(FIRST_RUN_KEY)));
    } catch { /* first-run state still works without browser storage */ }
  }, []);
  // Each later step starts at its heading, for keyboard and screen-reader users.
  useEffect(() => { if (step !== "material") headingRef.current?.focus({ preventScroll: true }); }, [step]);

  function go(next: FirstRunStep) {
    setStep(next);
    try { window.localStorage.setItem(FIRST_RUN_KEY, next); } catch { /* storage is optional */ }
  }
  function back() {
    if (stepIndex <= 0) return;
    go(FIRST_RUN_STEPS[stepIndex - 1]);
  }
  function chooseSample() {
    setMaterialPath("sample");
    try { window.localStorage.setItem(FIRST_RUN_PATH_KEY, "sample"); } catch { /* optional */ }
    setSubject(SAMPLE.subject);
    setTopic(SAMPLE.topic);
    setGoal(SAMPLE.goalChoices[0]);
    const next = nextFirstRunStep("material");
    if (next) go(next);
  }
  function onGoalKey(event: KeyboardEvent<HTMLDivElement>) {
    const choices = SAMPLE.goalChoices;
    const at = choices.indexOf(goal);
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    let next = at;
    if (direction) next = (at + direction + choices.length) % choices.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = choices.length - 1;
    else return;
    event.preventDefault();
    setGoal(choices[next]);
    goalButtons.current[next]?.focus();
  }

  function chooseOwn() {
    if (!canLeaveMaterial("")) return;
    // An uploaded study guide has not been read. Never give this path the
    // civics sample's topic or a fabricated answer/grade.
    setMaterialPath("own");
    setSubject("");
    setTopic("");
    setResponse("");
    try { window.localStorage.setItem(FIRST_RUN_PATH_KEY, "own"); } catch { /* optional */ }
    const next = nextFirstRunStep("material");
    if (next) go(next);
  }
  const swatches = useRef<Array<HTMLButtonElement | null>>([]);
  function pickTheme(id: RoomTheme) {
    setTheme(id);
    stage.current?.react("celebrate", 800);
  }
  /** The same arrow keys as the color picker in Room Settings (a grid of three columns). */
  function onSwatchKey(event: KeyboardEvent<HTMLDivElement>) {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 3 : event.key === "ArrowUp" ? -3 : 0;
    if (!move) return;
    event.preventDefault();
    const at = (ROOM_THEMES.findIndex((item) => item.id === theme) + move + ROOM_THEMES.length) % ROOM_THEMES.length;
    pickTheme(ROOM_THEMES[at].id);
    swatches.current[at]?.focus();
  }
  async function finish(event: MouseEvent<HTMLButtonElement>) {
    if (busy) return;
    const button = event.currentTarget;
    setBusy(true); setError(null);
    if (fixture) { setError("Preview only: this would create the room and open it."); setBusy(false); return; }
    const data = new FormData();
    data.set("title", title.trim());
    data.set("subject", subject.trim());
    data.set("topic", topic.trim());
    data.set("objective", objectiveFor(goal, topic));
    try {
      const result = await createFirstRoomAction(data);
      if (!result.roomId) { setError(result.error ?? "The room could not be created. Try again."); setBusy(false); return; }
      try {
        window.localStorage.removeItem(FIRST_RUN_KEY);
        window.localStorage.removeItem(FIRST_RUN_PATH_KEY);
      } catch { /* storage is optional */ }
      saveRoomTheme(result.roomId, theme);
      announceLeap(button);
      void stage.current?.leapTo(button.getBoundingClientRect());
      router.push(roomEntryForFirstRun(result.roomId, materialPath));
    } catch {
      setError("The room could not be created. Check your connection and try again.");
      setBusy(false);
    }
  }
  const previewTitle = title.trim() || roomTitleFromGuess(subject, topic);

  return (
    <section className="firstRoom" data-tone={theme} data-ui={foundationUi ? "phase3" : undefined} aria-label="Set up your first Study Room">
      <div className="stageScreen firstRoomStage">
        <StudigoStage ref={stage} size={210} />
        <Sill />
      </div>

      <form className="firstRoomBody" onSubmit={(event) => event.preventDefault()}>
        <div className="firstRoomBar">
          {stepIndex > 0
            ? <button type="button" className="firstRoomBack" onClick={back} disabled={busy}><span aria-hidden="true">‹</span> Back</button>
            : <span />}
          <span className="firstRoomDots" role="img" aria-label={`Step ${stepIndex + 1} of ${FIRST_RUN_STEPS.length}`}>
            {FIRST_RUN_STEPS.map((item, index) => <i key={item} data-on={index === stepIndex || undefined} data-past={index < stepIndex || undefined} />)}
          </span>
        </div>

        {step === "material" && (
          <>
            <span className="tinyLabel">HI, I'M STUDIGO</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>Start with something to study.</h1>
            <p className="pageLede">Each Study Room holds one set of material. Use a short sample, or add your own file later. A room name is not required.</p>
            <span className="tinyLabel">{SAMPLE_LABEL}</span>
            <button className="buttonPrimary" type="button" onClick={chooseSample}>Use the sample <span aria-hidden="true">→</span></button>
            <button className="ghostButton" type="button" onClick={chooseOwn}>I'll add my own file</button>
          </>
        )}

        {step === "correction" && (
          <>
            <span className="tinyLabel">{SAMPLE_LABEL}</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>{materialPath === "own" ? "What are you studying?" : "Does this look right?"}</h1>
            <p className="pageLede">{materialPath === "own" ? "Add a subject or topic if you know it. Both can wait until you upload your file." : "Subject and topic start filled in. Change them if you want. You can leave either one blank."}</p>
            <label className="field">
              <span>Subject</span>
              <input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} autoComplete="off" />
            </label>
            <label className="field">
              <span>Topic</span>
              <input name="topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={160} autoComplete="off" />
            </label>
            <button className="buttonPrimary" type="button" onClick={() => { const next = nextFirstRunStep("correction"); if (next) go(next); }}>Next <span aria-hidden="true">→</span></button>
          </>
        )}

        {step === "goal" && (
          <>
            <span className="tinyLabel">STEP 3 OF {FIRST_RUN_STEPS.length}</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>What do you want from this room?</h1>
            <p className="pageLede">Pick one. A test date is not required.</p>
            <div role="radiogroup" aria-label="Goal" onKeyDown={onGoalKey}>
              {SAMPLE.goalChoices.map((choice) => (
                <button key={choice} ref={(node) => { goalButtons.current[SAMPLE.goalChoices.indexOf(choice)] = node; }} type="button" role="radio" tabIndex={goal === choice ? 0 : -1} className={goal === choice ? "buttonPrimary" : "ghostButton"} aria-checked={goal === choice} onClick={() => setGoal(choice)}>
                  {GOAL_LABEL[choice]}
                </button>
              ))}
            </div>
            <button className="buttonPrimary" type="button" onClick={() => { const next = nextFirstRunStep("goal"); if (next) go(next); }}>Next <span aria-hidden="true">→</span></button>
          </>
        )}

        {step === "lesson" && (materialPath === "own" ? (
          <>
            <span className="tinyLabel">YOUR MATERIAL / NEXT STEP</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>Your first lesson starts with your file.</h1>
            <p className="pageLede">Open Materials after creating this room to upload your notes or study guide. Studigo will read your source before offering a lesson or checking an answer.</p>
            <button className="buttonPrimary" type="button" onClick={() => go("optional")}>
              Next <span aria-hidden="true">→</span>
            </button>
          </>
        ) : (
          <>
            <span className="tinyLabel">{SAMPLE_LABEL}</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>Try one question.</h1>
            <p className="pageLede">Any response continues. This does not change mastery.</p>
            {SAMPLE.facts.map((fact) => <p className="hintText" key={fact}>{fact}</p>)}
            <p><strong>{SAMPLE.question}</strong></p>
            <label className="field">
              <span>Your response</span>
              <textarea name="response" value={response} onChange={(event) => setResponse(event.target.value)} rows={3} />
            </label>
            <button className="buttonPrimary" type="button" disabled={!response.trim()} onClick={() => { const next = nextFirstRunStep("lesson"); if (next && response.trim()) go(next); }}>Next <span aria-hidden="true">→</span></button>
          </>
        ))}

        {step === "optional" && (
          <>
            <span className="tinyLabel">OPTIONAL</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>{materialPath === "own" ? "Ready to add your file." : "Name and color can wait."}</h1>
            <p className="pageLede">{materialPath === "own" ? "Choose a name or color, or skip these. Your room will open directly to Materials." : "Skip this and the room still opens. Nothing here is required."}</p>
            <label className="field">
              <span>Room name <small>(optional)</small></span>
              <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder={previewTitle} autoComplete="off" />
            </label>
            <div className="cdSwatches" role="radiogroup" aria-label="Room color" onKeyDown={onSwatchKey}>
              {ROOM_THEMES.map((item, index) => (
                <button key={item.id} ref={(node) => { swatches.current[index] = node; }} type="button" role="radio" className="cdSwatch" data-tone={item.id} aria-checked={theme === item.id} tabIndex={theme === item.id ? 0 : -1} onClick={() => pickTheme(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="roomCard firstRoomPreview" data-tone={theme} aria-hidden="true">
              <span className="roomCardMeta">YOUR FIRST ROOM</span>
              <strong>{previewTitle}</strong>
            </div>
            {error && <p className="formError" role="alert">{error}</p>}
            <button className="ghostButton" type="button" onClick={finish} disabled={busy}>Skip</button>
            <button className="buttonPrimary" type="button" onClick={finish} disabled={busy}>
              {busy ? "Creating your room…" : materialPath === "own" ? "Open Materials" : "Open my Study Room"} <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </form>
    </section>
  );
}
