import Link from "next/link";

const trail = [
  { title: "Weather instruments", detail: "8 / 8 concepts", state: "mastered" },
  { title: "Clouds & fronts", detail: "6 / 6 concepts", state: "mastered" },
  { title: "Thunderstorms", detail: "4 / 6 concepts", state: "active" },
  { title: "Tornado formation", detail: "Up next", state: "next" },
  { title: "Weather safety", detail: "Not started", state: "locked" }
];

const modes = [
  { icon: "?", name: "Ask", copy: "Explain anything from your materials." },
  { icon: "✦", name: "Learn", copy: "Walk the guide in the right order." },
  { icon: "✓", name: "Quiz", copy: "Practice exactly what is testable." },
  { icon: "↗", name: "Mastery", copy: "Find weak spots before test day." }
];

function StudigoBuddy() {
  return (
    <svg className="buddy" viewBox="0 0 420 420" role="img" aria-label="Studigo study companion">
      <defs>
        <filter id="buddy-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#19243d" floodOpacity=".16" />
        </filter>
      </defs>
      <g filter="url(#buddy-shadow)">
        <path className="buddyEar buddyEarLeft" d="M122 128 88 45c-4-11 9-21 18-14l74 57Z" />
        <path className="buddyEar buddyEarRight" d="m298 128 34-83c4-11-9-21-18-14l-74 57Z" />
        <path className="buddyBody" d="M210 84c91 0 151 63 151 153 0 82-57 138-151 138S59 319 59 237C59 147 119 84 210 84Z" />
        <path className="buddyBelly" d="M210 209c57 0 96 36 96 89 0 42-35 77-96 77s-96-35-96-77c0-53 39-89 96-89Z" />
        <ellipse className="buddyEye" cx="154" cy="196" rx="15" ry="19" />
        <ellipse className="buddyEye" cx="266" cy="196" rx="15" ry="19" />
        <circle className="buddyEyeGlow" cx="159" cy="190" r="5" />
        <circle className="buddyEyeGlow" cx="271" cy="190" r="5" />
        <path className="buddyMouth" d="M182 235c17 15 39 15 56 0" />
        <path className="buddyBook" d="M147 278c22-9 43-8 63 5v55c-20-13-41-14-63-5Zm126 0c-22-9-43-8-63 5v55c20-13 41-14 63-5Z" />
        <path className="buddyBookLine" d="M210 283v55" />
      </g>
      <g className="buddySparkles" aria-hidden="true">
        <path d="m58 126 5 13 13 5-13 5-5 13-5-13-13-5 13-5Z" />
        <path d="m356 191 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" />
        <circle cx="331" cy="116" r="5" />
      </g>
    </svg>
  );
}

function ProgressRing() {
  return (
    <div className="progressRing" aria-label="71 percent test ready">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ringTrack" cx="60" cy="60" r="49" />
        <circle className="ringValue" cx="60" cy="60" r="49" pathLength="100" />
      </svg>
      <div className="ringLabel"><strong>71%</strong><span>ready</span></div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main>
      <header className="siteHeader wrap">
        <Link className="wordmark" href="/" aria-label="Studigo home">
          <span className="wordmarkGlyph">S<span>✦</span></span>
          <span>Studigo</span>
        </Link>
        <nav className="mainNav" aria-label="Primary navigation">
          <a href="#workspace">Study rooms</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/api/health">System</Link>
        </nav>
        <button className="navCta" type="button">Start studying <span>↗</span></button>
      </header>

      <section className="hero wrap">
        <div className="heroCopy">
          <div className="eyebrow"><span className="eyebrowDot" /> BUILT FROM YOUR ACTUAL CLASS MATERIAL</div>
          <h1>Your study pile just became a <em>study partner.</em></h1>
          <p className="heroLede">
            Drop in the study guide, textbook, notes, and worksheets. Studigo turns the material you already have into one grounded companion that teaches, quizzes, cites, and keeps track of what actually sticks.
          </p>
          <div className="heroActions">
            <button className="buttonPrimary" type="button">Build a Study Room <span>→</span></button>
            <a className="buttonQuiet" href="#workspace">See the study experience</a>
          </div>
          <div className="proofLine" aria-label="Product principles">
            <span><i>01</i> Your sources first</span>
            <span><i>02</i> Answers with receipts</span>
            <span><i>03</i> Weak spots surfaced</span>
          </div>
        </div>

        <div className="heroVisual" aria-label="Studigo companion illustration">
          <div className="fieldNote noteTop"><span>STUDY GUIDE</span><strong>18 things to know</strong><small>highest priority source</small></div>
          <div className="fieldNote noteRight"><span>TEXTBOOK</span><strong>Ch. 7 · Weather</strong><small>supporting context</small></div>
          <div className="companionHalo" />
          <StudigoBuddy />
          <div className="buddyCaption"><span className="statusPing" /> Studigo is ready to study</div>
          <div className="scribbleArrow" aria-hidden="true">↘</div>
        </div>
      </section>

      <section className="statementBand" aria-label="Studigo promise">
        <div className="wrap statementInner">
          <p>Less hunting through tabs.</p>
          <span>✦</span>
          <p>More actually learning.</p>
          <span>✦</span>
          <p>No generic AI guesswork.</p>
        </div>
      </section>

      <section className="workspaceSection wrap" id="workspace">
        <div className="sectionIntro">
          <div>
            <span className="sectionNumber">01 / THE STUDY ROOM</span>
            <h2>A home base that knows what matters.</h2>
          </div>
          <p>The study guide sets the destination. Your class materials provide the evidence. Studigo keeps the next useful action obvious.</p>
        </div>

        <div className="workspaceFrame">
          <aside className="workspaceRail">
            <div className="miniWordmark"><span>S✦</span></div>
            <div className="railNav">
              <button className="railItem active" type="button"><span>⌂</span> Home</button>
              <button className="railItem" type="button"><span>□</span> Rooms</button>
              <button className="railItem" type="button"><span>◫</span> Library</button>
            </div>
            <div className="roomList">
              <span className="railLabel">STUDY ROOMS</span>
              <button className="roomLink selected" type="button"><i className="roomColor science" /> Science</button>
              <button className="roomLink" type="button"><i className="roomColor ela" /> ELA</button>
              <button className="roomLink" type="button"><i className="roomColor math" /> Math</button>
            </div>
            <button className="profileChip" type="button"><span>WL</span><small>My study profile</small></button>
          </aside>

          <div className="workspaceMain">
            <div className="workspaceTopbar">
              <div><span className="crumb">SCIENCE / WEATHER UNIT</span><strong>Storms & Severe Weather</strong></div>
              <button className="iconButton" type="button" aria-label="More options">•••</button>
            </div>

            <div className="studyCanvas">
              <section className="masteryPanel">
                <div className="panelHeading">
                  <div><span className="tinyLabel">TEST READINESS</span><h3>Keep the streak moving.</h3></div>
                  <ProgressRing />
                </div>
                <div className="trail" aria-label="Learning trail">
                  {trail.map((item, index) => (
                    <div className={`trailStep ${item.state}`} key={item.title}>
                      <div className="trailMarker"><span>{item.state === "mastered" ? "✓" : index + 1}</span></div>
                      <div className="trailCopy"><strong>{item.title}</strong><small>{item.detail}</small></div>
                      {item.state === "active" && <button type="button">Continue →</button>}
                    </div>
                  ))}
                </div>
              </section>

              <aside className="askPanel">
                <div className="askHeader">
                  <div className="buddyMini">S✦</div>
                  <div><strong>Ask Studigo</strong><span>grounded in 6 sources</span></div>
                </div>
                <div className="studentBubble">Why do tornadoes usually form from supercells?</div>
                <div className="answerBubble">
                  <span className="answerKicker">FROM YOUR MATERIALS</span>
                  <p>Supercells can create strong rotating updrafts. When that rotation tightens and stretches vertically, it can help produce the rotating column that becomes a tornado.</p>
                  <div className="sourceStack">
                    <span><i>1</i> Study Guide · #8</span>
                    <span><i>2</i> Textbook · p. 214</span>
                  </div>
                </div>
                <div className="askComposer"><span>Ask about this unit…</span><button type="button" aria-label="Send question">↑</button></div>
              </aside>
            </div>

            <div className="modeDock">
              {modes.map((mode) => (
                <button className="modeItem" type="button" key={mode.name}>
                  <span className="modeIcon">{mode.icon}</span>
                  <span><strong>{mode.name}</strong><small>{mode.copy}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="howSection" id="how-it-works">
        <div className="wrap howGrid">
          <div className="howLead">
            <span className="sectionNumber">02 / HOW IT WORKS</span>
            <h2>Feed the companion. Build the course brain.</h2>
            <p>Studigo does not start with the entire internet. It starts with the things your teacher actually gave you.</p>
          </div>
          <div className="sourceMap" aria-label="Source priority model">
            <div className="sourceRow priorityOne"><span>01</span><div><strong>Teacher study guide</strong><small>What the test is actually asking for</small></div><b>PRIMARY</b></div>
            <div className="sourceRow"><span>02</span><div><strong>Teacher files & worksheets</strong><small>Class language, examples, assignments</small></div></div>
            <div className="sourceRow"><span>03</span><div><strong>Assigned textbook</strong><small>Deep explanations and supporting context</small></div></div>
            <div className="sourceRow"><span>04</span><div><strong>Your notes</strong><small>What you captured in class</small></div></div>
          </div>
        </div>
      </section>

      <section className="dropSection wrap">
        <div className="dropArt" aria-hidden="true">
          <div className="paper paperBack">CHAPTER 07</div>
          <div className="paper paperMid">MY NOTES</div>
          <div className="paper paperFront"><span>STUDY GUIDE</span><strong>Weather Unit</strong><i>✓ Tornadoes<br/>✓ Fronts<br/>○ Safety</i></div>
        </div>
        <div className="dropCopy">
          <span className="sectionNumber">03 / START WITH WHAT YOU HAVE</span>
          <h2>One upload away from a better study session.</h2>
          <p>PDFs, class handouts, notes, and textbook chapters belong together. Keep the originals downloadable while Studigo builds the learning layer on top.</p>
          <button className="buttonPrimary dark" type="button">Create your first room <span>→</span></button>
        </div>
      </section>

      <footer className="siteFooter wrap">
        <Link className="wordmark" href="/"><span className="wordmarkGlyph">S<span>✦</span></span><span>Studigo</span></Link>
        <p>Study from your material. Know where every answer came from.</p>
        <span className="footerMeta">AI STUDY COMPANION · FOUNDATION V1</span>
      </footer>
    </main>
  );
}
