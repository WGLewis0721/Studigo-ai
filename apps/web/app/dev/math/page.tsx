import { notFound } from "next/navigation";
import { MATH_FAMILIES, checkMathAnswer, generateMathProblems, mathAnswerText, seededRandom } from "@/lib/learning";
import { mathPrompt } from "@/lib/math-copy";
import { mathPresentation, mathSolution } from "@/lib/math-practice";
import { MathFigure, MathSteps, MathText } from "@/components/room/math-visual";

// Synthetic fixture for code-generated math practice. Local development only; nothing is stored.
// ?seed=7 draws a different problem for each family. ?family=rect_area shows one family.
export default async function MathFixture({ searchParams }: { searchParams: Promise<{ seed?: string; family?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { seed, family: only } = await searchParams;
  const random = seededRandom(Number.parseInt(seed ?? "1", 10) || 1);

  return (
    <main className="pageWrap" style={{ display: "grid", gap: 28, padding: 24 }}>
      <p>Local visual fixture · one problem per math family · answers below are graded by the real checker</p>
      {MATH_FAMILIES.filter((family) => !only || family === only).map((family) => {
        const [problem] = generateMathProblems(family, 1, random);
        const answer = mathAnswerText(problem);
        return (
          <section className="quizMode" key={family}>
            <span className="tinyLabel">{family} · Math practice</span>
            <MathFigure {...mathPresentation(problem)} />
            <h2 className="quizPrompt">
              <MathText text={mathPrompt(problem)} filled="" />
            </h2>
            <MathSteps steps={mathSolution(problem)} />
            <ul style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {[answer, `${answer}0`, "abc", "0.33"].map((typed) => (
                <li key={typed}>
                  <code>{typed}</code> → {JSON.stringify(checkMathAnswer(problem, typed))}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
