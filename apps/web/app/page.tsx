import { StudigoMascot } from "@/components/studigo-mascot";
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
          <StudigoMascot size={40} mark />
          <span>Studigo</span>
        </Link>
        <nav className="mainNav" aria-label="Primary navigation">
          <a href="#workspace">Study rooms</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/login">Sign in</Link>
        </nav>
        <Link className="navCta" href="/app">Start studying <span>↗</span></Link>
      </header>

      <section className="hero wrap">
        <div className="heroCopy">
          <div className="eyebrow"><span className="eyebrowDot" /> BUILT FROM YOUR ACTUAL CLASS MATERIAL</div>
          <h1>Your study pile just became a <em>study partner.</em></h1>
          <p className="heroLede">
            Drop in the study guide, textbook, notes, and worksheets. Studigo turns the material you already have into one grounded companion that teaches, quizzes, cites, and keeps track of what actually sticks.
          </p>
          <div className="heroActions">
            <Link className="buttonPrimary" href="/signup">Build a Study Room <span>→</span></Link>
            <a className="buttonQuiet" href="#workspace">See the study experience</a>
          </div>
          <div className="proofLine" aria-label="Product principles">
            <span><i>01</i> Your sources first</span>
            <span><i>02</i> Answers with receipts</span>
            <span><i>03</i> Weak spots surfaced</span>
          </div>
        </div>

        <div className="heroVisual productPreview" aria-label="Example study session">
          <div className="sessionSheet">
            <div className="sheetTopline"><span>FIELD NOTES / 01</span><span>EXAMPLE SESSION</span></div>
            <h2>The weather unit.<br /><em>Making sense, finally.</em></h2>
            <p className="sheetQuestion">Why does a supercell start to rotate?</p>
            <p className="sheetAnswer">Wind changes speed and direction with height. An updraft tilts that rotation upright. <sup>[1]</sup></p>
            <div className="sheetSource"><span>01</span> Your textbook · page 214 <span>↗</span></div>
            <div className="sheetRule" />
            <span className="tinyLabel">YOUR NEXT STEP</span>
            <p className="sheetNext">Explain it in your own words.</p>
            <Link className="buttonPrimary" href="/signup">Try your own materials <span>→</span></Link>
          </div>
          <div className="heroCompanion">
            <StudigoMascot state="sources" size={150} priority />
            <p>Your material.<br /><strong>My full attention.</strong></p>
          </div>
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

        <p className="tinyLabel">ILLUSTRATIVE WORKSPACE · SAMPLE MATERIALS AND PROGRESS</p>
        <div className="workspaceFrame">
          <aside className="workspaceRail">
            <div className="miniWordmark"><StudigoMascot size={40} mark /></div>
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
                  <StudigoMascot size={40} mark />
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
          <Link className="buttonPrimary dark" href="/signup">Create your first room <span>→</span></Link>
        </div>
      </section>

      <footer className="siteFooter wrap">
        <Link className="wordmark" href="/"><StudigoMascot size={40} mark /><span>Studigo</span></Link>
        <p>Study from your material. Know where every answer came from.</p>
        <span className="footerMeta">AI STUDY COMPANION · FOUNDATION V1</span>
      </footer>
    </main>
  );
}
