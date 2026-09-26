"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { MascotVideoTracker } from "@/components/mascot/MascotVideoTracker";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";

const SHELLS = [
  { id: "blueberry", name: "Blueberry" },
  { id: "tangerine", name: "Tangerine" },
  { id: "grape", name: "Grape" },
  { id: "kiwi", name: "Kiwi" },
  { id: "berry", name: "Berry" }
] as const;

type Shell = (typeof SHELLS)[number]["id"];

const DIAL: Array<{ id: GlyphName; name: string }> = [
  { id: "learn", name: "Learn" },
  { id: "coach", name: "Coach" },
  { id: "quiz", name: "Quiz" },
  { id: "cards", name: "Cards" }
];

/**
 * The hero is the product, presented as a personal device. Choosing a shell
 * color recolors the whole stage — the same thing that makes each real Study
 * Room recognizable. Everything inside the device is illustrative.
 */
export function HeroStage() {
  const [shell, setShell] = useState<Shell>("blueberry");
  const swatchRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onPickerKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = SHELLS.findIndex((item) => item.id === shell);
    const next = (index + step + SHELLS.length) % SHELLS.length;
    setShell(SHELLS[next].id);
    swatchRefs.current[next]?.focus();
  }

  return (
    <section className="heroStage" data-tone={shell} aria-labelledby="hero-title">
      <div className="wrap heroGrid">
        <div className="heroCopy">
          <span className="heroEyebrow reveal" style={{ ["--d" as string]: "0ms" }}>
            <i aria-hidden="true" /> The study companion built from your class
          </span>
          <h1 id="hero-title" className="heroTitle">
            <span className="reveal" style={{ ["--d" as string]: "80ms" }}>Give it your class.</span>
            <span className="reveal" style={{ ["--d" as string]: "180ms" }}>
              Get a study <em>companion.</em>
            </span>
          </h1>
          <p className="heroLede reveal" style={{ ["--d" as string]: "300ms" }}>
            Drop in the study guide, slides and notes you were actually given. Studigo turns them
            into your own Study Room — it teaches you, quizzes you, keeps track of what you know,
            and shows the exact page behind every answer.
          </p>
          <div className="heroActions reveal" style={{ ["--d" as string]: "400ms" }}>
            <Link className="buttonPrimary heroCta" href="/signup">
              Build your first Study Room <span aria-hidden="true">→</span>
            </Link>
            <a className="buttonQuiet" href="#modes">See it work</a>
          </div>
        </div>

        <div className="heroProduct">
          <div
            className="heroDevice"
            role="img"
            aria-label="Illustrative Studigo Study Room: the Coach explains why cold fronts cause thunderstorms and cites page 3 of the teacher's study guide."
          >
            <span className="deviceHandle" />
            <div className="deviceShell">
              <div className="deviceScreen">
                <div className="dsTop">
                  <span className="dsRoom"><i className="roomGem" /> Weather Unit</span>
                  <span className="dsDial">
                    {DIAL.map((item) => (
                      <span key={item.id} className={item.id === "coach" ? "dsKey dsKeyActive" : "dsKey"} data-tone={item.id}>
                        <ModeGlyph name={item.id} size={15} />
                        <b>{item.name}</b>
                      </span>
                    ))}
                  </span>
                </div>
                <div className="dsBody">
                  <div className="dsThread">
                    <p className="dsStudent">Why do cold fronts cause thunderstorms?</p>
                    <div className="dsAnswer">
                      <span className="dsKicker">FROM YOUR MATERIALS</span>
                      <p>
                        The cold air slides under the warm air and shoves it up fast. Warm, wet air
                        rising quickly builds tall clouds — that&apos;s where the storms start.
                      </p>
                      <span className="dsTicket"><i>1</i>Weather study guide <b>p. 3</b></span>
                    </div>
                    <p className="dsNext"><b>Your turn</b> What happens to the warm air as it rises?</p>
                  </div>
                  <div className="dsSide">
                    <MascotVideoTracker size={128} priority />
                    <div className="dsMeter">
                      <span>Fronts &amp; storms</span>
                      <span className="dsBar"><i /></span>
                      <small>64% · example</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="deviceChin">
                <span className="deviceLed" />
                <span className="deviceBrand">studigo</span>
                <span className="deviceGrille" />
              </div>
            </div>

            <span className="floatSource floatGuide">
              <small>STUDY GUIDE · SETS THE SCOPE</small>
              <strong>Weather Unit review.pdf</strong>
            </span>
            <span className="floatSource floatSlides">
              <small>SLIDES</small>
              <strong>Fronts &amp; air masses</strong>
            </span>
            <span className="floatCite">
              <i>1</i> Cited · page 3, paragraph 2
            </span>
          </div>

          <div className="shellPicker">
            <span className="shellPickerLabel" id="shell-picker-label">Every Study Room gets its own color</span>
            <div className="shellSwatches" role="radiogroup" aria-labelledby="shell-picker-label" onKeyDown={onPickerKey}>
              {SHELLS.map((item, index) => (
                <button
                  key={item.id}
                  ref={(node) => { swatchRefs.current[index] = node; }}
                  type="button"
                  role="radio"
                  aria-checked={shell === item.id}
                  tabIndex={shell === item.id ? 0 : -1}
                  className="shellSwatch"
                  data-tone={item.id}
                  onClick={() => setShell(item.id)}
                >
                  <i aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
