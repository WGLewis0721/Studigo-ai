# Studigo Study Method Library

This document is the product-facing evidence library for the study methods Studigo should teach, recommend, and implement.

The goal is not to turn Studigo into a catalog of study hacks. The goal is to use methods with credible learning-science support, describe where the evidence is strongest, and avoid presenting a product heuristic as a scientific law.

## Evidence labels

- **Strong default** — supported by converging experimental evidence, reviews, or meta-analyses and appropriate as a default Studigo behavior.
- **Strong in context** — strong evidence in particular domains or conditions; use when those conditions match.
- **Useful support** — can help, but should usually support rather than replace retrieval/practice.
- **Do not lead with** — familiar technique with limited or inconsistent evidence as a primary learning strategy.

Studigo should cite the underlying research in any future public "why this method?" explanation. It should never claim that one fixed schedule, question count, or workflow is universally optimal.

## 1. Retrieval practice / practice testing

**Evidence:** Strong default.

**What it is:** Attempt to retrieve an answer from memory before looking at the source.

**Why Studigo should use it:** Practice tests are not only assessment. Retrieval itself can strengthen later retention. A meta-analysis found a reliable advantage for testing over restudy, and classic experiments found larger delayed-retention benefits from testing than from repeated studying.

**Studigo implementation:**

- Quiz, Practice Test, Flashcards, and Weak Areas should require recall before revealing the answer.
- Free recall and short answer should be used when appropriate, not only recognition.
- Give corrective feedback after the attempt.
- Use prior performance to decide what comes back next.

**Example — biology:**

Prompt: "Without looking, explain the difference between mitosis and meiosis."

After the learner answers, Studigo compares the response with the uploaded material, identifies missing distinctions, cites the relevant pages, and schedules the concept for another retrieval attempt.

**Research:**

- Roediger, H. L., & Karpicke, J. D. (2006). *Test-enhanced learning: Taking memory tests improves long-term retention.* Psychological Science, 17(3), 249–255. DOI: https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Rowland, C. A. (2014). *The effect of testing versus restudy on retention: A meta-analytic review of the testing effect.* Psychological Bulletin, 140(6), 1432–1463. DOI: https://doi.org/10.1037/a0037559
- Karpicke, J. D., & Blunt, J. R. (2011). *Retrieval practice produces more learning than elaborative studying with concept mapping.* Science, 331(6018), 772–775. DOI: https://doi.org/10.1126/science.1199327

## 2. Spaced practice

**Evidence:** Strong default.

**What it is:** Revisit material across separated study sessions rather than massing all practice into one sitting.

**Why Studigo should use it:** A large quantitative review found robust spacing effects across hundreds of experiments. Applied classroom research also supports distributed practice, although the best interval depends on the retention goal and material.

**Studigo implementation:**

- Flashcards and Weak Areas should resurface material over time.
- Study Plan should distribute high-priority topics across available days.
- A missed day should reschedule intelligently instead of treating the plan as failed.
- Do not present "1 day, 3 days, 7 days" or any other fixed cadence as a universal scientific optimum. It can be a starting heuristic that adapts to performance and test date.

**Example — history:**

Instead of reviewing Reconstruction for 45 minutes once, Studigo schedules shorter retrieval rounds today, later in the week, and again before the test, with the exact cadence adjusted by recall performance.

**Research:**

- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). *Distributed practice in verbal recall tasks: A review and quantitative synthesis.* Psychological Bulletin, 132(3), 354–380. DOI: https://doi.org/10.1037/0033-2909.132.3.354
- Mawson, R. D., & Kang, S. H. K. (2025). *The distributed practice effect on classroom learning: A meta-analytic review of applied research.* Behavioral Sciences, 15(6), 771. DOI: https://doi.org/10.3390/bs15060771

## 3. Interleaved practice

**Evidence:** Strong in context.

**What it is:** Mix related problem types or categories so the learner must identify the correct strategy rather than repeating the same procedure in a block.

**Why Studigo should use it:** Classroom mathematics experiments have shown substantial delayed-test benefits from interleaving. The method is especially relevant when the learner must discriminate between similar problem types or choose among strategies.

**Studigo implementation:**

- Practice Test should mix already-introduced topics and question types.
- Math/science problem practice should avoid long runs where every problem announces the same method.
- Early instruction can still use a small blocked set while a student is first learning a procedure, then transition to interleaving.

**Example — math:**

Instead of 10 consecutive area-of-a-circle problems, Studigo mixes circle area, circumference, rectangle area, and triangle area so the student must first decide which relationship applies.

**Research:**

- Rohrer, D., Dedrick, R. F., Burgess, K. (2014). *The benefit of interleaved mathematics practice is not limited to superficially similar kinds of problems.* Psychonomic Bulletin & Review, 21(5), 1323–1330. DOI: https://doi.org/10.3758/s13423-014-0588-3
- Rohrer, D., Dedrick, R. F., Hartwig, M. K., & Cheung, C.-N. (2020). *A randomized controlled trial of interleaved mathematics practice.* Journal of Educational Psychology, 112(1), 40–52. DOI: https://doi.org/10.1037/edu0000367

## 4. Corrective feedback

**Evidence:** Strong default when practice can expose the learner to wrong answers.

**What it is:** After an attempt, tell the learner what was correct, what was wrong, and what the source supports.

**Why Studigo should use it:** Retrieval is useful, but practice without correction can leave errors unresolved. Research on multiple-choice testing found that feedback increased correct retention and reduced later intrusion of wrong alternatives.

**Studigo implementation:**

- Every scored question should have source-grounded feedback.
- Wrong answers should explain the misconception, not merely show a red X.
- Low-confidence correct answers can still receive reinforcement because uncertainty itself is useful information.
- Feedback should cite the student's source when possible.

**Example — chemistry:**

Student chooses an incorrect definition of an ionic bond. Studigo says which part is wrong, gives the source-grounded correction, shows the relevant page, and then asks a nearby transfer question rather than immediately repeating the same stem.

**Research:**

- Butler, A. C., & Roediger, H. L. (2008). *Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing.* Memory & Cognition, 36(3), 604–616. DOI: https://doi.org/10.3758/MC.36.3.604
- Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2008). *Correcting a metacognitive error: Feedback increases retention of low-confidence correct responses.* Journal of Experimental Psychology: Learning, Memory, and Cognition, 34(4), 918–928. DOI: https://doi.org/10.1037/0278-7393.34.4.918

## 5. Self-explanation

**Evidence:** Useful support / moderate utility.

**What it is:** Explain why a fact, step, or principle makes sense in the learner's own words.

**Why Studigo should use it:** Self-explanation research shows that stronger learners often generate explanations that connect steps to principles, and prompts can improve understanding. The evidence base is meaningful but less general than retrieval and spacing.

**Studigo implementation:**

- Learn mode should ask "Why does this step work?" and "Explain this back to me."
- Use it after worked examples and before showing another explanation.
- Keep these formative checks unscored so the learner can expose confusion without penalty.

**Example — physics:**

After a worked force problem, Studigo asks: "Why did we use the net force rather than the largest single force?" The learner's explanation determines the follow-up.

**Research:**

- Chi, M. T. H., Bassok, M., Lewis, M. W., Reimann, P., & Glaser, R. (1989). *Self-explanations: How students study and use examples in learning to solve problems.* Cognitive Science, 13(2), 145–182. DOI: https://doi.org/10.1016/0364-0213(89)90002-5
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). *Improving students' learning with effective learning techniques.* Psychological Science in the Public Interest, 14(1), 4–58. DOI: https://doi.org/10.1177/1529100612453266

## 6. Worked examples → faded practice

**Evidence:** Strong in context, especially for novices learning procedures.

**What it is:** Study a fully worked solution, then solve increasingly incomplete versions until the learner can perform the procedure independently.

**Why Studigo should use it:** Worked-example research supports examples during early skill acquisition, particularly when the example makes the conceptual structure visible and is paired closely with practice.

**Studigo implementation:**

- For procedural math/science content, Learn mode can show one grounded worked example.
- The next example removes one or more steps and asks the learner to complete them.
- Transition to independent retrieval/problem solving rather than leaving the learner in example-reading mode.

**Example — algebra:**

1. Studigo shows a complete two-step equation solution with each transformation justified.
2. The next problem provides the first transformation but asks the learner to finish.
3. The third problem is independent.

**Research:**

- Atkinson, R. K., Derry, S. J., Renkl, A., & Wortham, D. (2000). *Learning from examples: Instructional principles from the worked examples research.* Review of Educational Research, 70(2), 181–214. DOI: https://doi.org/10.3102/00346543070002181

## 7. Elaborative interrogation

**Evidence:** Useful support / moderate utility.

**What it is:** Ask why a stated fact or relationship is true and connect it to prior knowledge.

**Studigo implementation:**

- Use after a learner can recall the basic fact.
- Prefer "why/how" questions that can be answered from the uploaded sources.
- Do not let elaboration silently introduce unsupported outside facts in grounded mode.

**Example — earth science:**

Fact: "Warm air can hold more water vapor than cold air."

Prompt: "Why does that matter for cloud formation when air rises and cools?"

**Research:**

- Dunlosky et al. (2013), DOI: https://doi.org/10.1177/1529100612453266

## 8. Concept mapping / synthesis

**Evidence:** Useful support, not the default replacement for retrieval.

**What it is:** Organize relationships among concepts visually or hierarchically.

**Studigo implementation:**

- Use a concept map as a synthesis/output activity after the learner has retrieved core ideas.
- Let the learner build or complete missing links rather than passively viewing a finished map.
- Do not treat concept-map viewing as equivalent to practice testing.

**Evidence note:** Karpicke & Blunt (2011) found retrieval practice outperformed elaborative concept mapping in their science-text experiments. That does not make concept maps useless; it means Studigo should not substitute passive mapping for retrieval practice.

## 9. Rereading, highlighting, and summarization

**Evidence:** Do not lead with as standalone methods.

These can support comprehension and navigation, but a major review rated rereading, highlighting/underlining, and summarization lower than practice testing and distributed practice as general-purpose learning techniques.

**Studigo implementation:**

- Highlighting should become input to an active task: "You highlighted this. Can you explain it without looking?"
- Summaries should be followed by retrieval questions.
- Re-reading should be targeted to a demonstrated gap, not used as the primary study loop.

**Research:**

- Dunlosky et al. (2013), DOI: https://doi.org/10.1177/1529100612453266

## Product mapping

| Studigo surface | Primary learning method | Supporting method |
| --- | --- | --- |
| Learn | Self-explanation | Worked examples, elaboration |
| Quiz | Retrieval practice | Corrective feedback |
| Flashcards | Retrieval practice | Spacing |
| Practice Test | Retrieval practice | Interleaving, feedback |
| Weak Areas | Retrieval practice | Adaptive spacing |
| Study Plan | Distributed practice | Priority/coverage balancing |
| Cram Mode | Retrieval + coverage triage | Feedback; no claim of replacing spaced study |
| Downloaded Study Guide | Structured reference | Retrieval prompts embedded in the guide |

## Guardrails

1. Grounded-mode study methods may change *how* Studigo teaches, not *what* the student's sources say.
2. The research library informs defaults; individual performance should inform adaptation.
3. Do not expose "evidence-based" as a vague marketing badge. Tie claims to a method and source.
4. Do not promise an exact optimal interval without individualized evidence.
5. Do not confuse ease with effectiveness. Several effective methods feel harder than rereading.
6. Studigo should support accessibility and learner preference in presentation without pretending that unsupported "learning styles" require different factual instruction.
