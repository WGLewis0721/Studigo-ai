"use client";

import "./app-home.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { createFirstRoomAction } from "@/lib/actions/rooms";
import type { HomeNext } from "@/lib/home-next";
import { ROOM_THEMES, saveRoomTheme, useRoomTheme, type RoomTheme } from "@/lib/room-theme";
import { LEAP_KEY } from "@/components/companion/companion";
import { StudigoStage, type StageHandle } from "@/components/companion/stage";

/** Fired when a room is opened from Home, so Studigo can leap toward it. */
export const LEAP_EVENT = "studigo:leap";
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

  useEffect(() => {
    stage.current?.react("wave", 1700);
    const onLeap = (event: Event) => { void stage.current?.leapTo((event as CustomEvent<LeapDetail>).detail); };
    window.addEventListener(LEAP_EVENT, onLeap);
    return () => window.removeEventListener(LEAP_EVENT, onLeap);
  }, []);

  return (
    <section className="homeHero" data-tone={theme} aria-labelledby="home-title">
      <div className="stageScreen homeStage">
        <StudigoStage ref={stage} size={184} />
        <Sill />
      </div>
      <div className="homeSay">
        <span className="tinyLabel">UP NEXT</span>
        <h1 className="pageTitle" id="home-title">{next.title} is up next.</h1>
        <p className="pageLede">{next.line}</p>
      </div>
      <div className="nextUp">
        <div className="nextUpText">
          <span className="tinyLabel">NEXT UP · {next.title.toUpperCase()}</span>
          <h2>{next.heading}</h2>
          <p>{next.note}</p>
          {next.progress && <p className="nextUpProgress">{next.progress}</p>}
        </div>
        <Link
          className="buttonPrimary"
          href={`/app/rooms/${next.roomId}?mode=${next.mode}`}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => announceLeap(event.currentTarget)}
        >
          Continue <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

const STEPS = 3;

/**
 * Home, with no rooms yet: Studigo walks a new learner through their first
 * Study Room. It asks for a name and, if they know it, a test date. Nothing else.
 * `fixture` runs the flow without creating anything (local preview only).
 */
export function FirstRoomSetup({ fixture = false }: { fixture?: boolean }) {
  const router = useRouter();
  const stage = useRef<StageHandle>(null);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [testDate, setTestDate] = useState("");
  const [theme, setTheme] = useState<RoomTheme>("teal");
  const [did, setDid] = useState({ poke: false, pet: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { stage.current?.react("wave", 1700); }, []);
  // Each step starts at its heading, for keyboard and screen-reader users.
  useEffect(() => { if (step > 1) headingRef.current?.focus({ preventScroll: true }); }, [step]);

  function next(event: FormEvent) {
    event.preventDefault();
    if (step === 1 && !title.trim()) return;
    setStep((value) => Math.min(STEPS, value + 1));
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
    if (testDate) data.set("testDate", testDate);
    try {
      const result = await createFirstRoomAction(data);
      if (!result.roomId) { setError(result.error ?? "The room could not be created. Try again."); setBusy(false); return; }
      saveRoomTheme(result.roomId, theme);
      announceLeap(button);
      void stage.current?.leapTo(button.getBoundingClientRect());
      router.push(`/app/rooms/${result.roomId}`);
    } catch {
      setError("The room could not be created. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="firstRoom" data-tone={theme} aria-label="Set up your first Study Room">
      <div className="stageScreen firstRoomStage">
        <StudigoStage ref={stage} size={210} onTouch={(kind) => setDid((value) => ({ ...value, [kind]: true }))} />
        <Sill />
      </div>

      <form className="firstRoomBody" onSubmit={next}>
        <div className="firstRoomBar">
          {step > 1
            ? <button type="button" className="firstRoomBack" onClick={() => setStep((value) => value - 1)} disabled={busy}><span aria-hidden="true">‹</span> Back</button>
            : <span />}
          <span className="firstRoomDots" role="img" aria-label={`Step ${step} of ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, index) => <i key={index} data-on={index + 1 === step || undefined} data-past={index + 1 < step || undefined} />)}
          </span>
        </div>

        {step === 1 && (
          <>
            <span className="tinyLabel">HI, I&apos;M STUDIGO</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>What&apos;s your next test?</h1>
            <p className="pageLede">Each Study Room holds one test&apos;s worth of material. I study with you, using your own class files.</p>
            <label className="field">
              <span>Room name</span>
              <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Biology Midterm" autoComplete="off" enterKeyHint="next" />
            </label>
            <label className="field">
              <span>Test date <small>(if you know it)</small></span>
              <input name="testDate" type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} />
            </label>
            <button className="buttonPrimary" type="submit" disabled={!title.trim()}>Next <span aria-hidden="true">→</span></button>
          </>
        )}

        {step === 2 && (
          <>
            <span className="tinyLabel">STEP 2 OF {STEPS}</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>Pick a color for this room.</h1>
            <p className="pageLede">It tints the whole room, so you always know where you are.</p>
            <div className="cdSwatches" role="radiogroup" aria-label="Room color" onKeyDown={onSwatchKey}>
              {ROOM_THEMES.map((item, index) => (
                <button key={item.id} ref={(node) => { swatches.current[index] = node; }} type="button" role="radio" className="cdSwatch" data-tone={item.id} aria-checked={theme === item.id} tabIndex={theme === item.id ? 0 : -1} onClick={() => pickTheme(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
            <div className="roomCard firstRoomPreview" data-tone={theme} aria-hidden="true">
              <span className="roomCardMeta">YOUR FIRST ROOM</span>
              <strong>{title.trim() || "Your room"}</strong>
            </div>
            <button className="buttonPrimary" type="submit">Next <span aria-hidden="true">→</span></button>
          </>
        )}

        {step === 3 && (
          <>
            <span className="tinyLabel">STEP 3 OF {STEPS}</span>
            <h1 className="pageTitle" ref={headingRef} tabIndex={-1}>I&apos;ll keep you company.</h1>
            <p className="pageLede">Try it now. I react to you.</p>
            <ul className="firstRoomTry">
              <li data-done={did.poke || undefined}><i aria-hidden="true">✓</i><div><b>Tap me</b><span>I&apos;m ticklish.</span></div></li>
              <li data-done={did.pet || undefined}><i aria-hidden="true">✓</i><div><b>Pet me</b><span>Press and slide across me.</span></div></li>
            </ul>
            <p className="hintText">Next you add your study guide. I only teach from what you give me, and I show the page each answer came from.</p>
            {error && <p className="formError" role="alert">{error}</p>}
            <button className="buttonPrimary" type="button" onClick={finish} disabled={busy}>
              {busy ? "Creating your room…" : "Open my Study Room"} <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </form>
    </section>
  );
}
