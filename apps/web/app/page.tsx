import { StudigoMascot } from "@/components/studigo-mascot";
import { MascotVideoTracker } from "@/components/mascot/MascotVideoTracker";
import Link from "next/link";

const benefits = [
  {
    n: "01",
    tone: "teal",
    title: "It knows which source wins",
    copy: "The teacher's guide sets the destination. Worksheets, textbook and notes rank underneath it, so the answer matches the class rather than the internet."
  },
  {
    n: "02",
    tone: "coral",
    title: "Receipts, every time",
    copy: "Page numbers you can open. If Studigo cannot ground a claim in your material, it says so instead of inventing one."
  },
  {
    n: "03",
    tone: "lavender",
    title: "Revision that aims itself",
    copy: "Readiness moves with what you get right. Tomorrow's session opens on the topic you keep dropping."
  }
];

const modes = [
  { name: "Ask", tone: "coral", copy: "Explain anything from your materials." },
  { name: "Learn", tone: "volt", copy: "Walk the guide in the right order." },
  { name: "Quiz", tone: "sun", copy: "Flashcards, practice tests, cram sessions." },
  { name: "Mastery", tone: "lavender", copy: "Find weak spots before test day." }
];

const steps = [
  { n: "01", tone: "teal", title: "Upload what you were given", copy: "Study guide, chapter, worksheets, your notes." },
  { n: "02", tone: "coral", title: "Studigo ranks and reads it", copy: "It maps topics and works out what the test is asking." },
  { n: "03", tone: "lavender", title: "You study, it keeps score", copy: "Readiness moves and the plan follows it." }
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
    <main>
      <div className="fmField fmHeroField">
        <div className="fmGridTexture" aria-hidden="true" />
        <div className="fmSpotlight" aria-hidden="true" />

        <header className="siteHeader wrap fmNav">
          <Link className="wordmark" href="/" aria-label="Studigo home">
            <StudigoMascot size={40} mark />
            <span>Studigo</span>
          </Link>
          <nav className="mainNav" aria-label="Primary navigation">
            <a href="#tools">Study rooms</a>
            <a href="#how-it-works">How it works</a>
            <Link href="/login">Sign in</Link>
          </nav>
          <Link className="navCta" href="/app">Start free <span>↗</span></Link>
        </header>

        <section className="wrap fmHero">
          <div className="fmHeroCopy">
            <div className="fmEyebrow"><span className="fmEyebrowDot" /> BUILT FROM YOUR ACTUAL CLASS MATERIAL</div>
            <h1 className="fmTitle">
              Your study pile just became a <em>study partner.</em>
            </h1>
            <p className="fmLede">
              Drop in the study guide, the textbook chapter, your notes. Studigo reads what your teacher actually assigned and turns it into one companion that explains, quizzes and cites.
            </p>
            <div className="fmActions">
              <Link className="fmButton" href="/signup">Build your first Study Room <span>→</span></Link>
              <a className="fmQuiet" href="#how-it-works">See how it works</a>
            </div>
          </div>

          <div className="fmStage">
            <div className="fmDisc" aria-hidden="true" />
            <MascotVideoTracker size={420} priority />
            <div className="fmChip fmChipSource">
              <span className="fmChipLabel fmCoral">SOURCE 01 · PRIMARY</span>
              <strong>Teacher study guide</strong>
            </div>
            <div className="fmChip fmChipCited">
              <span className="fmChipLabel fmLavender">CITED</span>
              <span className="fmChipBody">Textbook · page 214, paragraph 3</span>
            </div>
          </div>
        </section>
      </div>

      <div className="fmPromise" aria-label="Studigo promise">
        <div className="wrap fmPromiseInner">
          <p>Your sources first.</p>
          <span aria-hidden="true">/</span>
          <p>Answers with receipts.</p>
          <span aria-hidden="true">/</span>
          <p>Weak spots surfaced.</p>
        </div>
      </div>

      <section className="wrap fmBenefits" id="benefits">
        <h2 className="fmSectionTitle">Not a chatbot with a textbook taped to it.</h2>
        <div className="fmBenefitsGrid">
          <div className="fmBenefitList">
            {benefits.map((item) => (
              <div className="fmBenefit" key={item.n}>
                <span className={`fmNumeral fm-${item.tone}`}>{item.n}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </div>
            ))}
          </div>

          <aside className="fmReadiness" aria-label="Example test readiness">
            <span className="fmReadinessLabel">SAMPLE UNIT · ILLUSTRATIVE PROGRESS</span>
            <div className="fmReadinessValue">71%</div>
            <div className="fmReadinessTrack"><div className="fmReadinessFill" /></div>
            <ul className="fmReadinessList">
              <li><span>Weather instruments</span><span className="fmVolt">Mastered</span></li>
              <li><span>Clouds &amp; fronts</span><span className="fmVolt">Mastered</span></li>
              <li><span>Thunderstorms</span><span className="fmDim">4 of 6</span></li>
              <li><span className="fmSun">Tornado formation</span><span className="fmSun">Up next</span></li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="fmTools" id="tools">
        <div className="wrap">
          <div className="fmToolsHead">
            <h2>One room. Four ways in.</h2>
            <p>Every mode reads the same sources, so you never re-explain your class.</p>
          </div>
          <div className="fmToolsGrid">
            {modes.map((mode) => (
              <div className="fmTool" key={mode.name}>
                <div className={`fmToolName fm-${mode.tone}`}>{mode.name}</div>
                <p>{mode.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap fmSteps" id="how-it-works">
        <span className="fmKicker">HOW IT WORKS</span>
        <h2 className="fmSectionTitle fmStepsTitle">Three steps, then it is just studying.</h2>
        <div className="fmStepsGrid">
          {steps.map((step) => (
            <div className={`fmStep fmStep-${step.tone}`} key={step.n}>
              <span className={`fmNumeral fm-${step.tone}`}>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap fmFaq" id="questions">
        <div className="fmFaqIntro">
          <span className="fmKicker">THE IMPORTANT BIT</span>
          <h2 className="fmSectionTitle">Your class material stays the point.</h2>
          <p>Studigo is designed to help you work from the files you upload, not replace your teacher or quietly expand the assignment.</p>
        </div>
        <div className="fmFaqList">
          {faqs.map((item, index) => (
            <details className="fmFaqItem" key={item.q} open={index === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="fmField fmCtaField" id="start">
        <div className="fmGridTexture" aria-hidden="true" />
        <div className="wrap fmCta">
          <div>
            <h2>Tonight&apos;s chapter, already read.</h2>
            <p>Start a room with the guide you were handed. Ask it the thing you are stuck on and see where the answer comes from.</p>
            <Link className="fmButton" href="/signup">Start studying — free <span>→</span></Link>
          </div>
          <div className="fmCtaArt" aria-hidden="true">
            <div className="fmDisc fmDiscSmall" />
            <StudigoMascot state="welcome" size={260} />
          </div>
        </div>
      </section>

      <footer className="siteFooter wrap">
        <Link className="wordmark" href="/">
          <StudigoMascot size={40} mark />
          <span>Studigo</span>
        </Link>
        <p>Study from your material. Know where every answer came from.</p>
        <span className="footerMeta">AI STUDY COMPANION</span>
      </footer>
    </main>
  );
}
