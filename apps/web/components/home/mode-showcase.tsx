"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";
import { StudigoMascot } from "@/components/studigo-mascot";

type ModeId = "coach" | "learn" | "quiz" | "cards";

const MODES: Array<{ id: ModeId; glyph: GlyphName; name: string; color: string; headline: string; copy: string }> = [
  {
    id: "coach", glyph: "coach", name: "Coach", color: "Tangerine",
    headline: "A tutor that waits for your answer.",
    copy: "It asks, listens, and nudges the exact gap — then picks your next rep. Styles range from Socratic to straight-up worked examples."
  },
  {
    id: "learn", glyph: "learn", name: "Learn", color: "Blueberry",
    headline: "The guide, walked in the right order.",
    copy: "Topics come from your teacher's study guide, in its order and its words. Every explanation links back to where it came from."
  },
  {
    id: "quiz", glyph: "quiz", name: "Quiz", color: "Dandelion",
    headline: "Say how sure you are. Then find out.",
    copy: "Rating your confidence is how you submit. Confident-and-wrong gets flagged as a blind spot, so it doesn't follow you into the test."
  },
  {
    id: "cards", glyph: "cards", name: "Flashcards", color: "Grape",
    headline: "Cards that come back right before you forget.",
    copy: "Written from your material, fixable in one tap, and scheduled by how well you actually knew them."
  }
];

/** Oversized views of the real modes, each in its own color. Illustrative content. */
export function ModeShowcase() {
  const [active, setActive] = useState<ModeId>("coach");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mode = MODES.find((item) => item.id === active) ?? MODES[0];

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = MODES.findIndex((item) => item.id === active);
    const next = (index + step + MODES.length) % MODES.length;
    setActive(MODES[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="modeShowcase" data-tone={active}>
      <div className="modeTabs" role="tablist" aria-label="Study modes" onKeyDown={onTabKey}>
        {MODES.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            type="button"
            role="tab"
            id={`mode-tab-${item.id}`}
            aria-selected={active === item.id}
            aria-controls="mode-panel"
            tabIndex={active === item.id ? 0 : -1}
            data-tone={item.id}
            className="modeTab"
            onClick={() => setActive(item.id)}
          >
            <span className="keycap"><ModeGlyph name={item.glyph} size={20} /></span>
            <span className="modeTabText">
              <b>{item.name}</b>
              <small>{item.color}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="modeStage" role="tabpanel" id="mode-panel" aria-labelledby={`mode-tab-${active}`}>
        <div className="modeStageCopy" key={`copy-${active}`}>
          <h3>{mode.headline}</h3>
          <p>{mode.copy}</p>
          <span className="exampleTag">Example session</span>
        </div>
        <div className="modeStageView" key={`view-${active}`} aria-hidden="true">
          {active === "coach" && <CoachView />}
          {active === "learn" && <LearnView />}
          {active === "quiz" && <QuizView />}
          {active === "cards" && <CardsView />}
        </div>
      </div>
    </div>
  );
}

function CoachView() {
  return (
    <div className="mvScreen mvCoach">
      <div className="mvCoachHead">
        <StudigoMascot state="explain" size={64} />
        <div>
          <b>Coach · Socratic</b>
          <small>Topic: Air masses &amp; fronts</small>
        </div>
      </div>
      <p className="mvBubble mvBubbleCoach">When the cold front arrives, which air mass ends up on top — and why?</p>
      <p className="mvBubble mvBubbleYou">The warm air, because it&apos;s lighter?</p>
      <p className="mvBubble mvBubbleCoach">
        Right direction. <b>Lighter</b> is the key word — can you say what makes warm air lighter? Your guide
        uses the word <em>density</em>.
      </p>
      <span className="mvTicket"><i>2</i>Weather study guide <b>p. 4</b></span>
    </div>
  );
}

function LearnView() {
  const topics = [
    { n: "01", t: "Air pressure and wind", s: "mastered" },
    { n: "02", t: "Air masses and fronts", s: "open" },
    { n: "03", t: "Thunderstorms", s: "learning" },
    { n: "04", t: "Tornado formation", s: "new" }
  ];
  return (
    <div className="mvScreen mvLearn">
      {topics.map((topic) => (
        <div key={topic.n} className={`mvTopic mvTopic-${topic.s}`}>
          <span className="mvMarker">{topic.s === "mastered" ? "✓" : topic.n}</span>
          <div>
            <b>{topic.t}</b>
            {topic.s === "open" && (
              <>
                <p>An air mass takes on the temperature and moisture of where it forms. A front is the boundary where two of them meet.</p>
                <span className="mvTicket"><i>1</i>Weather study guide <b>p. 2</b></span>
              </>
            )}
          </div>
          {topic.n === "02" && <span className="mvOnTest">ON THE TEST</span>}
        </div>
      ))}
    </div>
  );
}

function QuizView() {
  return (
    <div className="mvScreen mvQuiz">
      <span className="mvQuizProgress"><i /></span>
      <small className="mvLabel">QUESTION 3 OF 5 · MULTIPLE CHOICE</small>
      <p className="mvPrompt">Which instrument measures air pressure?</p>
      <div className="mvChoices">
        <span className="mvChoice"><i>A</i>Anemometer</span>
        <span className="mvChoice mvChoiceOn"><i>B</i>Barometer</span>
        <span className="mvChoice"><i>C</i>Hygrometer</span>
      </div>
      <small className="mvLabel">HOW SURE ARE YOU?</small>
      <div className="mvConfidence">
        <span>Guessing</span>
        <span>Fairly sure</span>
        <span className="mvConfidenceOn">Confident</span>
      </div>
    </div>
  );
}

function CardsView() {
  return (
    <div className="mvCards">
      <div className="mvCard">
        <small>FRONT</small>
        <b>Occluded front</b>
        <small>Tap to flip</small>
      </div>
      <div className="mvRatings">
        <span>Missed it</span>
        <span>Hard</span>
        <span className="mvRatingOn">Got it</span>
      </div>
    </div>
  );
}
