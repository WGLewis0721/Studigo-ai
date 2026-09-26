import Link from "next/link";
import "./home.css";
import { StudigoMascot } from "@/components/studigo-mascot";
import { ModeGlyph, type GlyphName } from "@/components/mode-glyph";
import { HeroStage } from "@/components/home/hero-stage";
import { ModeShowcase } from "@/components/home/mode-showcase";

const loop: Array<{ n: string; glyph: GlyphName; tone: string; title: string; copy: string }> = [
  { n: "01", glyph: "materials", tone: "teal", title: "Your material", copy: "Study guide, slides, notes, textbook." },
  { n: "02", glyph: "plan", tone: "blueberry", title: "Your Study Room", copy: "One place per test, in its own color." },
  { n: "03", glyph: "coach", tone: "tangerine", title: "It teaches and quizzes", copy: "Coach, Learn, Quiz, Flashcards." },
  { n: "04", glyph: "mastery", tone: "kiwi", title: "It tracks what you know", copy: "From real answers, not clicks." },
  { n: "05", glyph: "ask", tone: "grape", title: "It shows its sources", copy: "Every answer links to the page." }
];

const sources = [
  { rank: "01", type: "study_guide", name: "Teacher study guide", note: "Sets the scope. Always wins." },
  { rank: "02", type: "teacher_material", name: "Teacher handouts", note: "The class's own explanations." },
  { rank: "03", type: "presentation", name: "Slides", note: "What was actually taught." },
  { rank: "04", type: "worksheet", name: "Worksheets", note: "The kind of questions to expect." },
  { rank: "05", type: "student_notes", name: "Your notes", note: "Your words, kept." },
  { rank: "06", type: "textbook", name: "Textbook", note: "Explains — never expands the test." }
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

export default function HomePage() {
  return (
    <main className="home">
      <header className="homeNav">
        <div className="homeNavBar">
          <Link className="wordmark" href="/" aria-label="Studigo home">
            <StudigoMascot size={34} mark />
            <span>Studigo</span>
          </Link>
          <nav className="homeNavLinks" aria-label="Primary navigation">
            <a href="#modes">Modes</a>
            <a href="#sources">Sources</a>
            <a href="#mastery">Mastery</a>
            <Link href="/login">Sign in</Link>
          </nav>
          <Link className="buttonPrimary homeNavCta" href="/signup">Start free</Link>
        </div>
      </header>

      <HeroStage />

      <section className="wrap loopStrip" aria-label="How Studigo works">
        <ol>
          {loop.map((step) => (
            <li key={step.n} data-tone={step.tone}>
              <span className="keycap"><ModeGlyph name={step.glyph} size={20} /></span>
              <span className="loopNum">{step.n}</span>
              <b>{step.title}</b>
              <small>{step.copy}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="sourcesField" id="sources" data-tone="teal" aria-labelledby="sources-title">
        <div className="wrap sourcesGrid">
          <div className="sourcesCopy">
            <span className="sectionKicker">SOURCES</span>
            <h2 id="sources-title">Feed it the real stuff.</h2>
            <p>
              Studigo doesn&apos;t guess what your test covers. It reads what your teacher handed out,
              ranks it, and keeps the study guide in charge — the textbook can explain, but it
              can&apos;t quietly add chapters.
            </p>
            <ul className="sourcesPromises">
              <li>Private to your account</li>
              <li>Open the original any time</li>
              <li>PDF, slides, docs, photos of handouts</li>
            </ul>
          </div>
          <div className="sourceBay" aria-label="Source priority, highest first">
            <span className="sourceSlot" aria-hidden="true" />
            <ol className="sourceStackList">
              {sources.map((source) => (
                <li key={source.rank} data-source={source.type}>
                  <span className="cartRank">{source.rank}</span>
                  <b>{source.name}</b>
                  <small>{source.note}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="wrap modesSection" id="modes" aria-labelledby="modes-title">
        <div className="sectionHead">
          <span className="sectionKicker">ONE ROOM, EVERY WAY TO STUDY</span>
          <h2 id="modes-title">Every mode has its own color. They all read the same pages.</h2>
        </div>
        <ModeShowcase />
      </section>

      <section className="masteryField" id="mastery" data-tone="kiwi" aria-labelledby="mastery-title">
        <div className="wrap masteryGrid">
          <div className="masteryCopy">
            <span className="sectionKicker">MASTERY</span>
            <h2 id="mastery-title">It knows what you know. Not how long you stared.</h2>
            <p>
              Mastery moves only with saved quiz answers and flashcard recall. Unpracticed topics
              count as zero, and confident-but-wrong answers get flagged as blind spots — so the
              number means something the night before.
            </p>
            <dl className="masteryLegend">
              <div><dt><i className="lg-mastered" /> Strong</dt><dd>Answered right, more than once</dd></div>
              <div><dt><i className="lg-learning" /> Needs work</dt><dd>Practiced, still slipping</dd></div>
              <div><dt><i className="lg-blind" /> Blind spot</dt><dd>You were sure — and wrong</dd></div>
            </dl>
          </div>
          <div className="masteryDevice" role="img" aria-label="Illustrative mastery map for a sample weather unit: 71 percent ready, three topics strong, tornado formation flagged as a blind spot.">
            <div className="mdHead">
              <div>
                <small>SAMPLE UNIT · ILLUSTRATIVE</small>
                <b>Weather Unit</b>
              </div>
              <span className="mdRing">
                <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" pathLength={100} className="mdTrack" /><circle cx="60" cy="60" r="50" pathLength={100} className="mdValue" /></svg>
                <strong>71%</strong>
              </span>
            </div>
            <div className="mdTiles">
              {tiles.map((tile) => (
                <span key={tile.t} className={`mdTile mdTile-${tile.s}`} style={{ ["--v" as string]: `${tile.v}%` }}>
                  <b>{tile.t}</b>
                  <small>{tile.s === "blind" ? "Blind spot" : tile.s === "new" ? "Not practiced" : `${tile.v}%`}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wrap evidenceSection" aria-labelledby="evidence-title">
        <div className="sectionHead">
          <span className="sectionKicker">RECEIPTS</span>
          <h2 id="evidence-title">Every answer comes with the page it came from.</h2>
        </div>
        <div className="evidenceGrid" aria-hidden="true">
          <div className="evAnswer">
            <span className="evKicker">FROM YOUR MATERIALS</span>
            <p className="evQ">What does a barometer measure?</p>
            <p>
              Air pressure. Your guide says falling pressure usually means stormy weather is on the
              way, and rising pressure means clearer skies.
            </p>
            <span className="evTicket"><i>1</i><span>Weather study guide</span><b>page 3</b><em>↗</em></span>
          </div>
          <div className="evPage">
            <span className="evPageTab">Weather study guide · page 3</span>
            <span className="evLine" /><span className="evLine short" />
            <span className="evHighlight">A barometer measures air pressure. Falling pressure often signals stormy weather.</span>
            <span className="evLine" /><span className="evLine" /><span className="evLine short" />
            <span className="evLine" /><span className="evLine mid" />
            <span className="evLine" /><span className="evLine" /><span className="evLine short" />
          </div>
          <div className="evMissing">
            <span className="evKicker evKickerWarn">NOT IN YOUR MATERIALS</span>
            <p className="evQ">How do hurricanes get their names?</p>
            <p>Nothing you&apos;ve uploaded covers that, so Studigo won&apos;t guess. Add the chapter, or check with your teacher.</p>
          </div>
        </div>
      </section>

      <section className="wrap faqSection" id="questions" aria-labelledby="faq-title">
        <div className="faqIntro">
          <span className="sectionKicker">THE IMPORTANT BIT</span>
          <h2 id="faq-title">Your class material stays the point.</h2>
          <p>Studigo is designed to help you work from the files you upload, not replace your teacher or quietly expand the assignment.</p>
        </div>
        <div className="faqList">
          {faqs.map((item, index) => (
            <details className="faqItem" key={item.q} open={index === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="ctaField" data-tone="tangerine" aria-labelledby="cta-title">
        <div className="wrap ctaGrid">
          <div>
            <h2 id="cta-title">Tonight&apos;s chapter, already read.</h2>
            <p>Start a room with the guide you were handed. Ask it the thing you&apos;re stuck on and see where the answer comes from.</p>
            <Link className="buttonPrimary ctaKey" href="/signup">Start studying — free <span aria-hidden="true">→</span></Link>
          </div>
          <div className="ctaArt" aria-hidden="true">
            <StudigoMascot state="welcome" size={220} />
          </div>
        </div>
      </section>

      <footer className="wrap homeFooter">
        <Link className="wordmark" href="/">
          <StudigoMascot size={32} mark />
          <span>Studigo</span>
        </Link>
        <p>Study from your material. Know where every answer came from.</p>
        <span className="footerMeta">AI STUDY COMPANION</span>
      </footer>
    </main>
  );
}
