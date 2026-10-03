import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import "./home.css";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";
import { HomeMotion } from "@/components/home/home-motion";
import { MeetPortrait } from "@/components/home/meet-portrait";
import { StudigoWaitlist } from "@/components/home/waitlist";
import "./waitlist.css";

export const metadata: Metadata = {
  title: "Studigo: the study companion built from your class",
  description:
    "Drop in the study guide, slides and notes you were given. Studigo turns them into a Study Room that teaches you, quizzes you, and shows the page behind every answer.",
  openGraph: {
    title: "Studigo: the study companion built from your class",
    description: "Give it your class. Get a study companion that teaches, quizzes, and shows the page behind every answer.",
    type: "website"
  }
};

/* Runs while the HTML is parsed, before the page hydrates: a returning visitor
   never sees the intro flash, and the overlay can never trap the page if the
   page script fails to take over. */
const INTRO_GUARD = `(function(){var el=document.getElementById("homeIntro");if(!el)return;var off=function(){el.setAttribute("data-state","off")};try{if(sessionStorage.getItem("studigo.intro")==="1"||window.scrollY>40){off();return}}catch(e){}el.setAttribute("data-t",String(performance.now()));var skip=el.querySelector("button");if(skip)skip.addEventListener("click",function(){el.setAttribute("data-skipped","1");if(!el.getAttribute("data-live"))off()});setTimeout(function(){if(!el.getAttribute("data-live"))off()},6000)})();`;

const delay = (ms: number) => ({ ["--d" as string]: `${ms}ms` }) as CSSProperties;

const shells = ["teal", "blueberry", "grape", "kiwi", "berry"];

const loop: Array<{ n: string; glyph: GlyphName; tone: string; title: string; copy: string }> = [
  { n: "01", glyph: "materials", tone: "teal", title: "Your material", copy: "Study guide, slides, notes, textbook." },
  { n: "02", glyph: "plan", tone: "blueberry", title: "Your Study Room", copy: "One place per test, in its own color." },
  { n: "03", glyph: "coach", tone: "tangerine", title: "It teaches and quizzes", copy: "Coach, Learn, Quiz, Flashcards." },
  { n: "04", glyph: "mastery", tone: "kiwi", title: "It tracks what you know", copy: "From real answers, not clicks." },
  { n: "05", glyph: "ask", tone: "grape", title: "It shows its sources", copy: "Every answer links to the page." }
];

const traits = [
  { k: "A", title: "He watches", copy: "Tap anywhere and he looks there." },
  { k: "B", title: "He reads along", copy: "Start typing and he peers into the answer field." },
  { k: "C", title: "He reacts", copy: "Get one right and he bursts out of his window. Miss one and he tells you to try the next." },
  { k: "D", title: "He gets out of the way", copy: "Drag him to another corner, or send him back to his seat." }
];

const modes: Array<{ n: string; tone: string; name: string; line: string; screen: ReactNode }> = [
  {
    n: "01", tone: "coach", name: "Coach", line: "A tutor that waits for your answer.",
    screen: (
      <>
        <div className="msBubble msCoach"><span className="msKicker">COACH · PRACTICE</span><p>Ice melts into water. Is that a <strong>physical</strong> change or a <strong>chemical</strong> change?</p></div>
        <div className="msBubble msYou">Physical. It is still water.</div>
        <div className="msBubble msCoach"><span className="msKicker">COACH · PRACTICE</span><p><strong>Exactly.</strong> You can freeze it back into ice.</p></div>
      </>
    )
  },
  {
    n: "02", tone: "ask", name: "Learn", line: "The guide, walked in the right order.",
    screen: (
      <div className="msBubble msCoach msWide">
        <span className="msKicker">LEARN · FROM YOUR MATERIALS</span>
        <p><strong>Matter is anything that has mass and takes up space.</strong></p>
        <h4>The idea</h4>
        <ul><li>You describe matter by its properties</li><li>A physical property can be observed without changing the substance</li></ul>
        <span className="msTicket"><i>1</i>Science study guide<b>page 2</b></span>
      </div>
    )
  },
  {
    n: "03", tone: "quiz", name: "Quiz", line: "Say how sure you are. Then find out.",
    screen: (
      <>
        <p className="msPrompt">Which change of state happens when a liquid turns into a gas?</p>
        <div className="msChoice"><i>A</i>Melting</div>
        <div className="msChoice msPicked"><i>B</i>Evaporation</div>
        <div className="msChoice"><i>C</i>Condensation</div>
        <div className="msSure"><span>Guessing</span><span>Fairly sure</span><span className="on">Confident</span></div>
      </>
    )
  },
  {
    n: "04", tone: "cards", name: "Flashcards", line: "Cards that come back right before you forget.",
    screen: (
      <>
        <div className="msCard"><small>FRONT</small><strong>Evaporation</strong><small>Tap to flip</small></div>
        <div className="msRate"><span>Missed it</span><span>Hard</span><span className="on">Got it</span></div>
      </>
    )
  }
];

const sources = [
  { rank: "01", type: "study_guide", name: "Teacher study guide", note: "Sets the scope. Always wins." },
  { rank: "02", type: "teacher_material", name: "Teacher handouts", note: "The class's own explanations." },
  { rank: "03", type: "presentation", name: "Slides", note: "What was actually taught." },
  { rank: "04", type: "worksheet", name: "Worksheets", note: "The kind of questions to expect." },
  { rank: "05", type: "student_notes", name: "Your notes", note: "Your words, kept." },
  { rank: "06", type: "textbook", name: "Textbook", note: "Explains, never expands the test." }
];

const tiles = [
  { t: "Weather instruments", v: 96, s: "mastered" },
  { t: "Air pressure & wind", v: 88, s: "mastered" },
  { t: "Clouds", v: 81, s: "mastered" },
  { t: "Air masses & fronts", v: 64, s: "learning" },
  { t: "Thunderstorms", v: 52, s: "learning" },
  { t: "Weather maps", v: 38, s: "learning" },
  { t: "Tornado formation", v: 12, s: "blind" },
  { t: "Hurricanes", v: 0, s: "new" }
];

/* Every line here restates a rule in docs/PRODUCT.md. Do not add a promise the product does not keep. */
const grownUps = [
  { topic: "STUDYING", does: "Asks the question, then waits.", doesMore: "Coach checks the answer they give.", doesnt: "Count minutes or clicks.", doesntMore: "Only their own answers move mastery." },
  { topic: "ANSWERS", does: "Answers from the class's own files.", doesMore: "The page it came from is shown.", doesnt: "Guess.", doesntMore: "If the material doesn't cover it, Studigo says so." },
  { topic: "SCOPE", does: "Follows the teacher's study guide.", doesMore: "It outranks every other file.", doesnt: "Add to the test.", doesntMore: "A textbook can explain. It can't add chapters." },
  { topic: "FILES", does: "Keeps uploads private.", doesMore: "They belong to the student's account.", doesnt: "Put files on public links.", doesntMore: "Originals open only for the signed-in student." }
];

const faqs = [
  {
    q: "Will it make up answers?",
    a: "When the material does not support an answer, Studigo says so. When it can answer, the page or section is part of the response."
  },
  {
    q: "Which file takes priority?",
    a: "Your teacher's study guide is the map. Supporting class handouts, worksheets, slides, notes, and textbooks help explain it without silently changing what you need to study."
  },
  {
    q: "Are my uploads private?",
    a: "Study material belongs to you. Files stay private to your account and are used to make your own Study Room useful."
  }
];

const Sill = ({ className }: { className: string }) => (
  <span className={className} aria-hidden="true"><span className="railLed" /><span className="railBrand">studigo</span></span>
);

export default function HomePage() {
  // The first two poses the intro needs; the rest load with the page script.
  preload("/mascot/companion/full/leap.webp", { as: "image" });
  preload("/mascot/companion/full/wave.webp", { as: "image" });

  return (
    <div className="home" data-tone="tangerine">
      {/* The intro: the device wakes up, Studigo leaps in, then he jumps into the phone. */}
      <div className="intro" id="homeIntro" suppressHydrationWarning>
        <div className="introScreen" id="homeIntroScreen" aria-hidden="true"><Sill className="introSill" /></div>
        <button className="introSkip" id="homeIntroSkip" type="button">Skip intro</button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: INTRO_GUARD }} />

      <header className="nav">
        <a className="wordmark" href="#top" aria-label="Studigo home"><span className="wmLed" aria-hidden="true" />Studigo</a>
        <nav className="navLinks" aria-label="Primary navigation">
          <a href="#meet">Meet Studigo</a>
          <a href="#modes">Modes</a>
          <a href="#sources">Sources</a>
          <a href="#mastery">Mastery</a>
          <a href="#parents">Parents</a>
        </nav>
        <Link className="navSign" href="/app" prefetch={false}>Sign in</Link>
        <Link className="buttonPrimary navCta" href="/signup">Start free</Link>
      </header>

      <main>
        <section className="hero" id="top" data-room="teal">
          <div className="wrap heroGrid">
            <div className="heroCopy">
              <span className="eyebrow rv"><i aria-hidden="true" />The study companion built from your class</span>
              <h1 className="heroTitle">
                <span className="rv" style={delay(80)}>Give it your class.</span>
                <span className="rv" style={delay(170)}>Get a study <em>companion.</em></span>
              </h1>
              <p className="lede rv" style={delay(280)}>
                Drop in the study guide, slides and notes you were actually given. Studigo turns them into
                your own Study Room. It teaches you, quizzes you, keeps track of what you know, and shows
                the exact page behind every answer.
              </p>
              <div className="heroActions rv" style={delay(370)}>
                <Link className="buttonPrimary heroCta" href="/signup">Start studying for free <span aria-hidden="true">→</span></Link>
                <a className="buttonQuiet" href="#modes">See it work</a>
              </div>
              <dl className="spec rv" style={delay(460)}>
                <div>
                  <dt>ROOM COLOR</dt>
                  <dd>
                    <div className="shells" role="radiogroup" aria-label="Every Study Room gets its own color" id="homeShells">
                      {shells.map((tone, index) => (
                        <button key={tone} type="button" role="radio" aria-checked={index === 0} data-tone={tone} data-shell={tone}>
                          <i aria-hidden="true" /><span>{tone[0].toUpperCase() + tone.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                  </dd>
                </div>
                <div><dt>WORKS FROM</dt><dd>Your study guide, slides, notes and textbook</dd></div>
                <div><dt>COMPANION</dt><dd>Studigo. He comes with every room.</dd></div>
              </dl>
            </div>

            <div className="heroProduct rv" style={delay(200)}>
              <div className="plinth" aria-hidden="true" />
              <div className="phoneFrame" id="homePhoneFrame">
                <iframe id="homePhone" src="/demo/index.html?embed" title="Interactive Studigo demo: a Science Study Room with Studigo in his window" loading="eager" />
              </div>
              <span className="float floatGuide" aria-hidden="true"><small>STUDY GUIDE · SETS THE SCOPE</small><strong>Science study guide.pdf</strong></span>
              <span className="float floatCite" aria-hidden="true"><i>1</i>Cited · page 2</span>
              <span className="float floatLive"><b aria-hidden="true" />Try it. Tap around.</span>
            </div>
          </div>
        </section>

        <section className="wrap loop" aria-label="How Studigo works" data-guide="wave" data-say="Hi. I'm coming with you.">
          <ol>
            {loop.map((step, index) => (
              <li key={step.n} className="rv" style={delay(index * 70)} data-tone={step.tone}>
                <span className="keycap"><ModeGlyph name={step.glyph} size={20} /></span>
                <span className="loopNum">{step.n}</span>
                <b>{step.title}</b>
                <small>{step.copy}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="sec meet" id="meet" data-guide="center" aria-labelledby="meet-title">
          <div className="wrap meetGrid">
            <MeetPortrait />
            <div className="meetCopy">
              <span className="kicker rv">02 / MEET STUDIGO</span>
              <h2 className="rv" style={delay(60)} id="meet-title">He studies with you.</h2>
              <p className="secLede rv" style={delay(120)}>
                Studigo lives in a small window inside your Study Room. He is not a chat avatar. He pays
                attention to what you are doing.
              </p>
              <ul className="traits">
                {traits.map((trait, index) => (
                  <li key={trait.k} className="rv" style={delay(160 + index * 60)}>
                    <span>{trait.k}</span>
                    <div><b>{trait.title}</b><p>{trait.copy}</p></div>
                  </li>
                ))}
              </ul>
              <p className="meetHint rv" style={delay(400)}>
                <i aria-hidden="true" />
                <span className="fineOnly">Move your cursor. He is following it.</span>
                <span className="coarseOnly">Tap him on the right. He reacts.</span>
              </p>
            </div>
          </div>
        </section>

        <section className="sec modes" id="modes" data-guide="center" data-say="Same pages. Four ways in." aria-labelledby="modes-title">
          <div className="wrap">
            <div className="secHead">
              <span className="kicker rv">03 / ONE ROOM, EVERY WAY TO STUDY</span>
              <h2 className="rv" style={delay(60)} id="modes-title">Every mode has its own color. They all read the same pages.</h2>
            </div>
            <div className="modesGrid">
              <ol className="modeSteps">
                {modes.map((mode) => (
                  <li key={mode.n} className="modeStep" data-tone={mode.tone} data-mode={mode.name}>
                    <div className="modeText"><span className="modeNum">{mode.n}</span><h3>{mode.name}</h3><p>{mode.line}</p></div>
                    <div className="modeScreen">{mode.screen}</div>
                  </li>
                ))}
              </ol>
              <div className="modeStage" aria-hidden="true">
                <div className="modeDevice" id="homeModeDevice" data-tone="coach">
                  <div className="mdBar"><i className="roomGem" data-tone="teal" /><b>Science</b><span id="homeModeName">Coach</span></div>
                  <div className="mdRail"><span className="railLed" /><span className="railBrand">studigo</span></div>
                  <div className="mdHost" id="homeModeHost" />
                  <div className="mdChin"><span className="railLed" /><span className="railBrand">studigo</span><span className="mdGrille" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="colorField sources" id="sources" data-tone="teal" data-guide="read" data-say="I read what your teacher handed out." aria-labelledby="sources-title">
          <div className="wrap sourcesGrid">
            <div className="fieldCopy">
              <span className="kicker rv">04 / SOURCES</span>
              <h2 className="rv" style={delay(60)} id="sources-title">Feed it the real stuff.</h2>
              <p className="rv" style={delay(120)}>
                Studigo doesn&apos;t guess what your test covers. It reads what your teacher handed out,
                ranks it, and keeps the study guide in charge. The textbook can explain, but it
                can&apos;t quietly add chapters.
              </p>
              <ul className="promises rv" style={delay(180)}>
                <li>Private to your account</li>
                <li>Open the original any time</li>
                <li>PDF, slides, docs, photos of handouts</li>
              </ul>
            </div>
            <ol className="sourceBay" aria-label="Source priority, highest first">
              {sources.map((source, index) => (
                <li key={source.rank} className="rv" style={delay(index * 70)} data-source={source.type}>
                  <span>{source.rank}</span>
                  <b>{source.name}</b>
                  <small>{source.note}</small>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="sec mastery" id="mastery" data-tone="kiwi" data-guide="celebrate" data-say="Only real answers move this." aria-labelledby="mastery-title">
          <div className="wrap masteryGrid">
            <div className="fieldCopy">
              <span className="kicker rv">05 / MASTERY</span>
              <h2 className="rv" style={delay(60)} id="mastery-title">It knows what you know. Not how long you stared.</h2>
              <p className="rv" style={delay(120)}>
                Mastery moves only with saved quiz answers and flashcard recall. Unpracticed topics
                count as zero, and confident-but-wrong answers get flagged as blind spots, so the
                number means something the night before.
              </p>
              <dl className="legend rv" style={delay(180)}>
                <div><dt><i className="lg-mastered" />Strong</dt><dd>Answered right, more than once</dd></div>
                <div><dt><i className="lg-learning" />Needs work</dt><dd>Practiced, still slipping</dd></div>
                <div><dt><i className="lg-blind" />Blind spot</dt><dd>You were sure and wrong</dd></div>
              </dl>
            </div>
            <div className="masteryDeck mapDevice rv" role="img" aria-label="Illustrative mastery map for a sample weather unit: 71 percent ready, three topics strong, tornado formation flagged as a blind spot.">
              <div className="mdHead">
                <div><span className="tinyLabel">SAMPLE UNIT · ILLUSTRATIVE</span><b>Weather Unit</b></div>
                <span className="mapRing">
                  <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" pathLength={100} className="mapTrack" /><circle cx="60" cy="60" r="50" pathLength={100} className="mapValue" /></svg>
                  <strong>71%</strong>
                </span>
              </div>
              <div className="mapTiles">
                {tiles.map((tile) => (
                  <span key={tile.t} className={`mdTile${tile.s === "mastered" ? "" : ` mdTile-${tile.s}`}`} style={{ ["--v" as string]: `${tile.v}%` }}>
                    <b>{tile.t}</b>
                    <small>{tile.s === "blind" ? "Blind spot" : tile.s === "new" ? "Not practiced" : `${tile.v}%`}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="sec evidence" data-guide="center" data-say="Every answer shows its page." aria-labelledby="evidence-title">
          <div className="wrap">
            <div className="secHead">
              <span className="kicker rv">06 / RECEIPTS</span>
              <h2 className="rv" style={delay(60)} id="evidence-title">Every answer comes with the page it came from.</h2>
            </div>
            <div className="evGrid" aria-hidden="true">
              <div className="evCard rv">
                <span className="evKicker">FROM YOUR MATERIALS</span>
                <p className="evQ">What does a barometer measure?</p>
                <p>Air pressure. Your guide says falling pressure usually means stormy weather is on the way, and rising pressure means clearer skies.</p>
                <span className="msTicket evTicket"><i>1</i>Weather study guide<b>page 3</b></span>
              </div>
              <div className="evPage rv" style={delay(90)}>
                <span className="evTab">Weather study guide · page 3</span>
                <span className="evLine" /><span className="evLine short" />
                <span className="evMark">A barometer measures air pressure. Falling pressure often signals stormy weather.</span>
                <span className="evLine" /><span className="evLine" /><span className="evLine short" />
                <span className="evLine" /><span className="evLine mid" />
              </div>
              <div className="evCard evMissing rv" style={delay(180)}>
                <span className="evKicker evWarn">NOT IN YOUR MATERIALS</span>
                <p className="evQ">How do hurricanes get their names?</p>
                <p>Nothing you&apos;ve uploaded covers that, so Studigo won&apos;t guess. Add the chapter, or check with your teacher.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec grownups" id="parents" data-guide="center" data-say="This part is for your grown-up." aria-labelledby="parents-title">
          <div className="wrap grownGrid">
            <div>
              <span className="kicker rv">07 / FOR THE GROWN-UPS</span>
              <h2 className="rv" style={delay(60)} id="parents-title">Built so the studying stays theirs.</h2>
              <p className="secLede rv" style={delay(120)}>
                Parent or teacher? Here is what Studigo does with your student, and what it leaves alone.
              </p>
            </div>
            <ul className="grownSheet rv" style={delay(120)}>
              <li className="grownHead" aria-hidden="true"><span /><span className="gDoes">IT DOES</span><span className="gDoesnt">IT DOESN&apos;T</span></li>
              {grownUps.map((row) => (
                <li key={row.topic}>
                  <span className="grownTopic">{row.topic}</span>
                  <p className="does"><i aria-hidden="true">✓</i><span className="gLabel">IT DOES</span><b>{row.does}</b>{row.doesMore}</p>
                  <p className="doesnt"><i aria-hidden="true">✕</i><span className="gLabel">IT DOESN&apos;T</span><b>{row.doesnt}</b>{row.doesntMore}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sec faq" id="questions" data-guide="center" aria-labelledby="faq-title">
          <div className="wrap faqGrid">
            <div>
              <span className="kicker rv">08 / THE IMPORTANT BIT</span>
              <h2 className="rv" style={delay(60)} id="faq-title">Your class material stays the point.</h2>
              <p className="secLede rv" style={delay(120)}>
                Studigo is designed to help you work from the files you upload, not replace your teacher
                or quietly expand the assignment.
              </p>
            </div>
            <div className="faqList">
              {faqs.map((item, index) => (
                <details key={item.q} className="rv" style={delay(index * 70)} open={index === 0}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <StudigoWaitlist />

        <section className="colorField cta" id="start" data-tone="tangerine" data-guide="cta" aria-labelledby="cta-title">
          <div className="wrap ctaGrid">
            <div>
              <h2 className="rv" id="cta-title">Tonight&apos;s chapter, already read.</h2>
              <p className="rv" style={delay(80)}>
                Start a room with the guide you were handed. Ask it the thing you&apos;re stuck on and see
                where the answer comes from.
              </p>
              <Link className="buttonPrimary ctaKey rv" style={delay(160)} href="/signup">Start studying for free <span aria-hidden="true">→</span></Link>
            </div>
            <div className="ctaSpot" id="homeCtaSpot" aria-hidden="true"><Sill className="ctaSill" /></div>
          </div>
        </section>
      </main>

      <footer className="wrap foot">
        <a className="wordmark" href="#top"><span className="wmLed" aria-hidden="true" />Studigo</a>
        <p>Study from your material. Know where every answer came from.</p>
        <span className="footMeta">AI STUDY COMPANION</span>
      </footer>

      {/* Studigo on the page: he leaps out of the phone when you scroll and reacts to each section. */}
      <div className="guide" id="homeGuide" hidden role="button" tabIndex={-1} aria-label="Studigo. Tap to play, stroke to pet.">
        <button className="guideSay" id="homeGuideSay" type="button" hidden />
        <span className="guideShadow" aria-hidden="true" />
        <div className="guideBody" id="homeGuideBody" />
        <div className="guideFx" id="homeGuideFx" aria-hidden="true" />
      </div>

      <HomeMotion />
    </div>
  );
}
