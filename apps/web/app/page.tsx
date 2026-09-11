import Link from "next/link";

const capabilities = [
  ["Ask Studigo", "Grounded answers from your uploaded study materials."],
  ["Learn", "Walk through the study guide one concept at a time."],
  ["Quiz", "Generate practice from the exact material you need to know."],
  ["Mastery", "Track weak areas and what you have already learned."]
];

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brandMark" aria-label="Studigo home">S</div>
        <strong>Studigo</strong>
        <span className="navSpacer" />
        <Link href="/api/health" className="textLink">System health</Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">YOUR AI STUDY COMPANION</div>
        <h1>One place for what you need to learn.</h1>
        <p className="lede">
          Add the study guide, textbook, notes, worksheets, and class files. Studigo turns them into a grounded tutor that can teach, quiz, and help you prepare.
        </p>
        <div className="heroActions">
          <button className="primary" type="button">Create a Study Room</button>
          <button className="secondary" type="button">Add study material</button>
        </div>
      </section>

      <section className="roomPreview" aria-label="Study room preview">
        <div>
          <div className="roomKicker">SCIENCE · WEATHER UNIT</div>
          <h2>Storms & Severe Weather</h2>
          <p>Test readiness</p>
        </div>
        <div className="score">71%</div>
        <div className="progressTrack"><span style={{ width: "71%" }} /></div>
        <div className="topicGrid">
          <span className="done">✓ Weather instruments</span>
          <span className="done">✓ Clouds</span>
          <span className="working">◐ Thunderstorms</span>
          <span>○ Tornado formation</span>
          <span>○ Weather safety</span>
          <span>○ Vocabulary</span>
        </div>
      </section>

      <section className="capabilityGrid">
        {capabilities.map(([title, body]) => (
          <article className="capability" key={title}>
            <div className="capabilityIcon">{title.slice(0, 1)}</div>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <footer className="footer">
        <span>Studigo foundation scaffold</span>
        <span>Grounded study, not generic answers.</span>
      </footer>
    </main>
  );
}
