---
kb_schema_version: 1
ui_dimension: learning_tradition
ui_id: tradition-japanese
ui_label: Japanese-inspired
alignment_type: composite
match_strength: partial
canonical_paradigms:
  - japanese_structured_problem_solving
retrieval_tags:
  - problem_solving
  - compare_strategies
  - learner_reasoning
  - reflection
  - lesson_summary
best_for:
  - mathematics_problem_solving
  - strategy_comparison
  - conceptual_reasoning
avoid_when:
  - representing_as_universal_japanese_pedagogy
  - pure_procedural_drill
---

# Japanese-Inspired → Japanese Structured Problem Solving

## Current Studigo definition

**Description:** Mastery, careful modeling, steady improvement.

**Instruction:** "Use a Japanese-inspired lesson rhythm: make the goal explicit, study one worked method carefully, ask the learner to explain the reasoning, practice a small progression, and reflect on one improvement. Treat errors as information, not failure."

## Real-world alignment

The closest documented classroom paradigm is the **Japanese structured problem-solving lesson** used extensively in mathematics education.

However, the current Studigo instruction is only a **partial match**.

A commonly documented Japanese problem-solving sequence is:

1. present a problem;
2. students work on it;
3. compare and discuss multiple strategies/solutions (`neriage`);
4. teacher summarizes (`matome`).

The current Studigo phrase **"study one worked method carefully"** is more explicit-instruction oriented than the canonical structured-problem-solving sequence, which often delays teacher exposition so students first generate approaches.

Do not describe this option as "Lesson Study." Lesson Study (`jugyō kenkyū`) is primarily a teacher professional-learning process, not a direct tutoring script for a student.

## Canonical definition

Japanese structured problem solving organizes learning around a carefully chosen problem, learner-generated approaches, comparison/discussion of strategies, and a teacher synthesis that makes the mathematical idea explicit.

## Best-fit use cases

- Mathematics where more than one strategy is plausible.
- Comparing representations or methods.
- Building reasoning around why a method works.
- Learners who can attempt a problem before being shown the solution.

## Cautions

- Do not stereotype Japanese schooling as one homogeneous method.
- The cited paradigm is strongest in mathematics.
- If Studigo models the complete method first, it is no longer closely following the classic problem-solving sequence.
- Individual AI tutoring cannot reproduce the collective classroom `neriage` phase exactly; it can simulate strategy comparison by presenting contrasting valid approaches after the learner attempts.

## Example

**Problem:** Find `23 × 14`.

Studigo first asks the learner to try or predict a representation. After the attempt, it compares the learner's method with another valid decomposition, asks what is common between them, and summarizes the distributive structure.

## Recommended coaching rules

For higher fidelity to the real-world paradigm:

- Start with a worthwhile problem before giving the method.
- Ask the learner to attempt or anticipate a solution.
- Compare at least two plausible strategies when source material permits.
- Ask what the strategies have in common.
- End with a concise synthesis.
- Use worked modeling only when the learner lacks prerequisites or remains blocked.

## Sources

- Miyakawa, T., et al. (2025). *Collective problem-solving in Japanese primary mathematics lessons.* Educational Studies in Mathematics, 119, 421–443. https://doi.org/10.1007/s10649-025-10400-5
- Fujii, T. (2015). *The Critical Role of Task Design in Lesson Study* — discussion of Japanese structured problem solving. Springer. https://link.springer.com/chapter/10.1007/978-3-319-09629-2_9
- Stigler, J. W., & Hiebert, J. (1999). *The Teaching Gap.* Free Press.
