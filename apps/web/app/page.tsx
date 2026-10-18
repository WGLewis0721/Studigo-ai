import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import "./home.css";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";
import { HomeMotion } from "@/components/home/home-motion";
import { StudigoWordmark } from "@/components/studigo-wordmark";
import { MeetPortrait } from "@/components/home/meet-portrait";
import { StudigoWaitlist } from "@/components/home/waitlist";
import "./waitlist.css";

export const metadata: Metadata = {
  title: "Studigo: He's on your team",
  description:
    "Bring your notes, slides, or study guide from class. Studigo helps you figure out the hard parts and practice what you've learned.",
  openGraph: {
    title: "Studigo: He's on your team",
    description: "Your study buddy. Let's learn together with Studigo.",
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
  { n: "01", glyph: "materials", tone: "teal", title: "Bring your materials", copy: "Study guides, slides, worksheets, or notes." },
  { n: "02", glyph: "plan", tone: "blueberry", title: "Make a Study Room", copy: "Keep everything for one test together." },
  { n: "03", glyph: "coach", tone: "tangerine", title: "Learn and practice", copy: "Get help, explore topics, and test yourself." },
  { n: "04", glyph: "mastery", tone: "kiwi", title: "See what sticks", copy: "Your answers show what needs more practice." },
  { n: "05", glyph: "ask", tone: "grape", title: "Check the source", copy: "Go back to the page behind an answer." }
];

const traits = [
  { k: "A", title: "He watches", copy: "Tap anywhere and he looks there." },
  { k: "B", title: "He reads along", copy: "When you type, he looks over at your answer." },
  { k: "C", title: "He cheers you on", copy: "Get an answer right and he celebrates. Miss one and he nudges you to keep going." },
  { k: "D", title: "He makes room", copy: "Move him to another corner or send him back to his seat." }
];

const modes: Array<{ n: string; tone: string; name: string; line: string; screen: ReactNode }> = [
  {
    n: "01", tone: "coach", name: "Coach", line: "Work through a question with a little help.",
    screen: (
      <>
        <div className="msBubble msCoach"><span className="msKicker">COACH · PRACTICE</span><p>Ice melts into water. Is that a <strong>physical</strong> change or a <strong>chemical</strong> change?</p></div>
        <div className="msBubble msYou">Physical. It is still water.</div>
        <div className="msBubble msCoach"><span className="msKicker">COACH · PRACTICE</span><p><strong>Exactly.</strong> You can freeze it back into ice.</p></div>
      </>
    )
  },
  {
    n: "02", tone: "ask", name: "Learn", line: "Pick an Explore quest and take it one idea at a time.",
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
    n: "03", tone: "quiz", name: "Quiz", line: "Check your answers and how sure you are.",
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
    n: "04", tone: "cards", name: "Flashcards", line: "Review the terms you need to remember.",
    screen: (
      <>
        <div className="msCard"><small>FRONT</small><strong>Evaporation</strong><small>Tap to flip</small></div>
        <div className="msRate"><span>Missed it</span><span>Hard</span><span className="on">Got it</span></div>
      </>
    )
  }
];

const sources = [
  { rank: "01", type: "study_guide", name: "Teacher study guide", note: "Tells Studigo what to cover." },
  { rank: "02", type: "teacher_material", name: "Teacher handouts", note: "What your teacher explained." },
  { rank: "03", type: "presentation", name: "Slides", note: "The lessons from class." },
  { rank: "04", type: "worksheet", name: "Worksheets", note: "The kind of questions to expect." },
  { rank: "05", type: "student_notes", name: "Your notes", note: "The parts you wrote down." },
  { rank: "06", type: "textbook", name: "Textbook", note: "Helps explain the topic." }
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
  preload("/brand/studigo-official-wordmark.svg", { as: "image" });

  return (
    <div className="home" data-tone="tangerine">
      {/* The intro: the device wakes up, Studigo leaps in, then he jumps into the phone. */}
      <div className="intro" id="homeIntro" suppressHydrationWarning>
        <div className="introScreen" id="homeIntroScreen" aria-hidden="true"><Sill className="introSill" /></div>
        <button className="introSkip" id="homeIntroSkip" type="button">Skip intro</button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: INTRO_GUARD }} />

      <a className="homeSkipLink" href="#home-main">Skip to content</a>
      <header className="nav">
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

      <main id="home-main">
        <section className="hero" id="top" data-room="teal">
          <div className="wrap heroGrid">
            <div className="heroCopy">
              <span className="eyebrow rv"><i aria-hidden="true" />Your study buddy</span>
              <div className="heroLogo rv" style={delay(80)}>
                <StudigoWordmark className="heroWordmark" />
              </div>
              <h1 className="heroTitle rv" style={delay(170)}>He&apos;s on your team.</h1>
              <p className="heroInvite rv" style={delay(220)}>Let&apos;s learn together.</p>
              <p className="lede rv" style={delay(280)}>
                Bring your notes, slides, or study guide from class. Studigo helps you figure out
                the hard parts and practice what you&apos;ve learned.
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
                <div><dt>STUDY BUDDY</dt><dd>Studigo. He joins every Study Room.</dd></div>
              </dl>
            </div>

            <div className="heroProduct rv" style={delay(200)}>
              <div className="plinth" aria-hidden="true" />
              <div className="phoneFrame" id="homePhoneFrame" aria-label="Studigo Explore on an iPhone">
                <div className="phoneGlass">
                  <div className="phoneStatus" aria-hidden="true">
                    <span className="phoneClock">9:41</span>
                    <span className="phoneIsland" />
                    <span className="phoneSignals">
                      <svg width="17" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
                      <svg width="15" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.1-1.2A10.3 10.3 0 0 0 8.5.6C5.8.6 3.3 1.7 1.4 3.5l1.1 1.2c1.6-1.5 3.7-2.4 6-2.4Zm0 3.5c1.4 0 2.7.5 3.7 1.4l1.1-1.2a7.1 7.1 0 0 0-9.6 0l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.4c-.7 0-1.3.3-1.8.7l1.8 1.9 1.8-1.9c-.5-.4-1.1-.7-1.8-.7Z"/></svg>
                      <svg width="25" height="12" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="19" height="9" rx="2.2" fill="currentColor"/><rect x="24" y="4.2" width="2" height="4.6" rx="1" fill="currentColor" opacity=".45"/></svg>
                    </span>
                  </div>
                  <iframe id="homePhone" src="/demo/room?mode=learn" title="Interactive Studigo Explore demo using the real Study Room interface with example classroom material" loading="eager" />
                  <span className="phoneHomeBar" aria-hidden="true" />
                </div>
              </div>
              <span className="float floatGuide" aria-hidden="true"><small>STUDY GUIDE · SETS THE SCOPE</small><strong>Science study guide.pdf</strong></span>
              <span className="float floatCite" aria-hidden="true"><i>1</i>Example lesson</span>
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
              <h2 className="rv" style={delay(60)} id="meet-title">You've got a study buddy.</h2>
              <p className="secLede rv" style={delay(120)}>
                Studigo has his own little spot in your Study Room. He looks over when you tap,
                follows along while you work, and cheers when you get something right.
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
                <span className="coarseOnly">Tap him on the right. He reacts.</span>
              </p>
            </div>
          </div>
        </section>

        <section className="sec modes" id="modes" data-guide="center" data-say="Same pages. Four ways in." aria-labelledby="modes-title">
          <div className="wrap">
            <div className="secHead">
              <span className="kicker rv">03 / ONE ROOM, FOUR WAYS TO STUDY</span>
              <h2 className="rv" style={delay(60)} id="modes-title">Four ways to study. One set of class notes.</h2>
              <p className="secLede rv" style={delay(120)}>Coach, Explore, Quiz, and Flashcards all work from the materials you bring.</p>
            </div>
            <div className="modesGrid">
              <ol className="modeSteps">
                {modes.map((mode) => (
                  <li key={mode.n} className="modeStep" data-tone={mode.tone} data-mode={mode.name}>
                    <button className="modeText modeChoose" type="button" aria-pressed={mode.n === "01"} aria-label={`Show ${mode.name} in the iPad demo`}>
                      <span className="modeNum">{mode.n}</span><span className="modeName" role="heading" aria-level={3}>{mode.name}</span><span className="modeDescription">{mode.line}</span>
                    </button>
                    <div className="modeScreen">{mode.screen}</div>
                  </li>
                ))}
              </ol>
              <div className="modeStage">
                <div className="modeDevice" id="homeModeDevice" data-tone="coach">
                  <span className="modeTabletCamera" aria-hidden="true" />
                  <iframe
                    id="homeModeIframe"
                    className="modeTabletScreen"
                    src="/demo/room?mode=coach"
                    title="Interactive iPad Study Room demo. Choose a mode to see the actual Studigo interface."
                    loading="lazy"
                  />
                  <span className="modeTabletHome" aria-hidden="true" />
                </div>
                <p className="modeStageCaption">Try the sample Study Room. No account or uploads needed.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="colorField sources" id="sources" data-tone="teal" data-guide="read" data-say="I read what your teacher handed out." aria-labelledby="sources-title">
          <div className="wrap sourcesGrid">
            <div className="fieldCopy">
              <span className="kicker rv">04 / SOURCES</span>
              <h2 className="rv" style={delay(60)} id="sources-title">Start with what your teacher gave you.</h2>
              <p className="rv" style={delay(120)}>
                Your teacher&apos;s study guide sets what to cover. Handouts, slides, and notes
                help explain the ideas. A textbook can help too, but it doesn&apos;t add new test topics.
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
              <h2 className="rv" style={delay(60)} id="mastery-title">See what you&apos;ve learned. And what needs work.</h2>
              <p className="rv" style={delay(120)}>
                Your quiz answers and flashcard reviews show what you&apos;ve practiced.
                Topics you haven&apos;t tried stay unpracticed. If you felt sure but got
                an answer wrong, Studigo marks it as something to revisit.
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
              <h2 className="rv" style={delay(60)} id="evidence-title">See where the answer came from.</h2>
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
              <h2 className="rv" style={delay(60)} id="parents-title">Their work. Their progress.</h2>
              <p className="secLede rv" style={delay(120)}>
                Studigo helps students do the thinking themselves. Here is what he handles and what stays in their hands.
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
              <h2 className="rv" style={delay(60)} id="faq-title">Your class comes first.</h2>
              <p className="secLede rv" style={delay(120)}>
                Studigo works from the files you bring. He doesn&apos;t replace your teacher
                or add topics that aren&apos;t in your study guide.
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
              <h2 className="rv" id="cta-title">Ready for the next chapter?</h2>
              <p className="rv" style={delay(80)}>
                Bring your study guide, ask about the tricky parts, and see the page behind each answer.
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
        <span className="footMeta">YOUR STUDY BUDDY</span>
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
