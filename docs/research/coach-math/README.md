# Coach Math: source study and implementation contract

**Status:** research and design only; no Coach behavior, dependencies, routes, database schema, or UI changed.
**Date:** 2026-10-18
**Product lane:** Upload the material you are studying. Studigo teaches it, practices it with you, and helps you correct what you missed.
**Scope of this addition:** Make the *existing Coach* capable of working through math problems, generating related practice, and explaining one justified step at a time. **Not** a separate Mathway clone, a universal photo-homework solver, or a new learning-mode menu.

## Non-negotiable learner outcome

When a Study Room includes math, a student should be able to:

1. Ask Coach to help with a problem from their materials, or a clearly related practice problem.
2. See the equation and its intended method confirmed before any questionable interpretation is used.
3. Receive an accurate next step, one manageable action/question at a time.
4. Attempt that step and receive specific feedback on *where* the reasoning changed.
5. Ask for a hint, another example, a simpler explanation, the full worked solution, or more practice without losing the pending problem.
6. Practice an equivalent new problem and revisit the same error later; mastery changes only through the established evidence pipeline.

**Example:** A guide teaches solving linear equations. For 2x + 3 = 11, Coach asks what to remove from both sides first. The learner answers “divide by 2.” Coach explains why subtracting 3 must come first, demonstrates that single transformation if needed, then asks the learner to perform it. Coach does not unload all algebra rules, invent teacher instructions, or count a revealed answer as mastery.

## Investigation method and evidence boundary

This study follows the **Reverse Engineer Anything (REA)** investigation discipline: define an observable behavior, identify the input and output contracts, trace the available implementation, keep evidence tied to source locations, label inferences, and translate only the useful behavior into Studigo's current architecture.

- REA project: https://github.com/morluto/rea
- REA documentation: https://github.com/morluto/rea#how-rea-works
- **What was actually done:** GitHub source/document inspection for the two open repositories; public product-page inspection for Chegg and Mathway; inspection of Studigo's existing engineering/product contracts and Coach code.
- **What was not done:** No REA CLI/MCP instrumentation or binary analysis, browser-network capture, private-app access, proprietary solver decompilation, accuracy benchmark, or execution of external projects. The available local Node version (22.16.0) is below REA's documented 22.19+ Node 22 minimum. Consequently, this is an **REA-style evidence review**, not a claim that the REA tool was run.
- **Evidence grades:** OBSERVED = present in inspected source or official public description; INFERRED = plausible architecture, not independently verified; PROPOSED = Studigo implementation choice.
- No protected answers, proprietary source code, credentials, scraping, or bypass of paid access were used. This is behavioral and open-source comparison, not copying.

## Target 1: Google / mathsteps (open source)

Repository: https://github.com/google/mathsteps
Primary evidence: https://github.com/google/mathsteps/blob/master/README.md and https://github.com/google/mathsteps/wiki/How-to-use-mathsteps

**OBSERVED**

- Exposes operations for simplifying expressions, solving equations, and factoring polynomials.
- Returns a *sequence* of transitions, not only a final result.
- Step objects expose prior state, change type, resulting state, and substeps. For example, its public usage documents an ADD_POLYNOMIAL_TERMS change.
- Uses structured mathematical expression trees (Math.js ASTs), so the program works on parsed math rather than arbitrary prose.
- The repository was archived on 2024-08-29 and is read-only; its license is Apache-2.0.

**Studigo takeaway:** Treat the solver's output as a **typed, verifiable sequence of transformations**: before -> rule -> after, with optional substeps. Coach can disclose these progressively and explain them in words selected for the student. A correct final numerical answer alone is insufficient to coach a mistake.

**Cautions:** An archived package should not become a required runtime dependency without a maintained-alternative evaluation, security review, coverage tests, and license notices. Its existence does not prove that every equation type or solution step is supported or pedagogically ideal.

## Target 2: filipdomkc / FormulaDecoder (open source)

Repository: https://github.com/filipdomkc/FormulaDecoder
Primary evidence:
- https://github.com/filipdomkc/FormulaDecoder/blob/main/README.md
- https://github.com/filipdomkc/FormulaDecoder/blob/main/server/main.py
- https://github.com/filipdomkc/FormulaDecoder/blob/main/server/utilityoop.py
- https://github.com/filipdomkc/FormulaDecoder/blob/main/server/requirements.txt

**OBSERVED**

- Implements a Photomath-inspired flow: uploaded image -> OpenCV grayscale/blur/threshold -> contour boxes -> Tesseract character reading -> equation reconstruction -> SymPy solver -> response.
- The FastAPI upload handler keeps image processing, parsing, and solving as separately named operations (ImageProcessor, EquationParser, Solver).
- Recognizes exponents heuristically from character position and inserts multiplication for certain adjacent symbols.
- This is a student/demo project, not demonstrated production-ready math OCR.
- **Security caution:** the inspected solver uses Python eval for some expressions and sympify on a constructed input string. **Never copy these approaches for untrusted student input.** Use an allowlisted math grammar, bounded parsing, and sandbox-free/eval-free symbolic operations with strict resource limits.

**Studigo takeaway:** Keep recognition, interpretation, validation, and explanation distinct; always display an ambiguous recognized equation for confirmation. However, **photo capture is not part of the initial Coach math milestone**. Existing uploaded image/PDF extraction already serves the Study Room; do not add an independent camera solver or Python OCR microservice for this feature.

## Target 3: Chegg Study (closed source, public behavior only)

Official product: https://www.chegg.com/study

**OBSERVED:** Chegg markets step-by-step solutions and expert-verified responses, alongside study/practice tools. Its public site describes a large bank of expert-verified solutions.

**INFERRED, not established by source inspection:** A searchable content library with indexing and editorial/expert workflows is a reasonable explanation for its historically answer-centered user experience. Its internal retrieval design, verification pipeline, current AI components, schema, and economics are not publicly verified here.

**Studigo takeaway:** The valuable pattern is **specific explanations tied to a concrete question**, with provenance and reviewability. Studigo should not build a general answer bank or reproduce textbook-answer catalogs. The student's **own teacher guide and room materials** remain the curriculum boundary.

## Target 4: Mathway (closed source, public behavior only)

Official product: https://www.mathway.com/Algebra

**OBSERVED:** Mathway accepts typed problems or photo input, allows math-subject selection, and displays step-by-step methods across several subjects. It advertises dedicated calculators. Mathway is linked from Chegg's public site.

**INFERRED, not established by source inspection:** A structured parser plus subject-specific rule-based/symbolic solving and a step-presentation layer is one plausible implementation. Its exact algorithms, proprietary math engine, OCR architecture, and reliability cannot be confirmed by a public landing page.

**Studigo takeaway:** Solve/verify the math separately from natural-language tutoring, **without** inheriting the generic “paste homework, get answer” product behavior. When the student struggles, return to the required next action rather than simply repeating an answer.

## Cross-target comparison

| Target | Demonstrated public strength | Reusable idea | Avoid |
| --- | --- | --- | --- |
| mathsteps | Transformations with identifiable rules and substeps | Verified step trace | Depending on an archived library by default |
| FormulaDecoder | Image -> parse -> solver pipeline | Clear stage contracts; confirmation of ambiguity | Untrusted eval/sympify; premature photo-solver UI |
| Chegg | Expert-verified explanations for specific questions | Source-linked worked explanations | Answer catalog, paywall/scraping, off-syllabus answers |
| Mathway | Typed/photo problems and method-oriented solutions | Dedicated verification and step decomposition | One-click answer dumping as Coach's default |

## Integration with Studigo as it actually exists

Studigo already has most of the controlling architecture. **Extend it; do not create a second tutor.**

| Existing owner | Verified location | Responsibility for math |
| --- | --- | --- |
| Product/course scope | docs/PRODUCT.md; apps/web/lib/retrieval.ts; packages/ai/src/grounding.ts | Study guide first, source/page provenance, abstain when teacher-specific content is missing |
| Coach state machine and semantic responses | packages/ai/src/coach.ts | Keep pending question, clarification, hints, retries, and learner controls |
| Math problem and practice generation | packages/ai/src/study.ts; existing Coach generation route | Generate schema-validated variants tied to the current topic; no unsourced new curriculum |
| Deterministic progression and scaffold policy | packages/learning/; apps/web/lib/coach-director.ts; apps/web/lib/coach-render.ts | Own the next question, support level, difficulty, and advancement |
| Explanation mode/level | packages/learning/src/preferences.ts; apps/web/lib/coach-preferences.ts; apps/web/lib/explain-level.ts | Preserve Show me / Coach me / Challenge me and Simpler / Standard / Deeper |
| Language-floor guard | packages/ai/src/coach-language.ts | One concept and one main question per turn; plain language without reducing the reasoning task |
| Mastery evidence | apps/web/lib/coach-learning-events.ts; packages/learning/ | Store real attempts, hint use, and errors; never award mastery for mere answer exposure |
| Private learner data | Supabase Auth/RLS/Storage | Reuse room/owner scoping, revisions, idempotency, privacy controls |

### Proposed internal pipeline (not yet implemented)

1. **Ground.** Identify a mathematical objective from the room's study guide and supporting pages. Honor the teacher's method and grade scope; mathematical identities may be used as verification tools without inventing source claims.
2. **Interpret.** For typed expressions, parse using a constrained allowlist: numbers, variables, arithmetic operators, parentheses, supported equations. Do not evaluate code or treat OCR text as executable input. If parsing is uncertain, ask the student to confirm.
3. **Plan/solve.** Produce candidate steps (rule identifier, before expression, after expression, intermediate constraints/domain) using a narrow symbolic backend or verified rule library. Evaluate maintained options rather than adding a new language/runtime by assumption.
4. **Verify.** Independently check mathematical equivalence or solution-set preservation, domains, roots, and any required constraints. For risky transformations (division by a variable, squaring, cancellation), verify domain effects and check candidates in the *original* equation. If verification fails, stop, repair, or ask for help; never confidently narrate unverified algebra.
5. **Coach.** The existing adaptive director selects support and task demand; Coach exposes only the *appropriate next step*, diagnostic feedback, or a worked example as requested. The model supplies wording, not correctness authority.
6. **Practice.** Generate a near-transfer example of the *same skill*, with bounded difficulty and teacher-aligned method, validate that a solution exists and the worked trace is correct, then issue it through the existing Coach encounter flow.
7. **Remember.** Record attempts and misconceptions idempotently and feed them to the existing weak-area/rematch schedule. Present missed-question review through existing Study Room surfaces, not an extra mastery database.

**Minimal proposed contract**, to be evaluated against the current typed schemas before coding: a problem has room/topic/source references, canonical expression, domain, expected skill, and optional teacher method; a step has before, rule, after, explanation, verification status, and a stable sequence index; an encounter has a stable ID, one pending step, hints used, learner attempt, and result. New fields are a *proposal*, not an assertion that those types exist.

### Cognitive load and existing settings are hard requirements

These axes must remain independent:

- **Explanation level** controls wording only: Simpler = short, familiar sentences and defined course terms; Standard = material's language and concise causal explanation; Deeper = more precise supported connections. The same mathematics, rubric, and teacher scope apply to all three.
- **Coach mode** controls delivery: **Show me** starts with one worked step/example and then invites a try; **Coach me** defaults to a prompt/hint then student attempt; **Challenge me** gives a problem with less upfront support, but can scaffold on struggle. An explicit request to see the full solution can be honored without awarding earned mastery.
- **Reasoning difficulty** remains the deterministic director's choice based on actual attempts; never infer a student's capacity only from age, grade label, or chosen reading level.
- **Scaffolding** adjusts on observed struggle: diagnose the exact misconception, ask for one smaller action, give one hint/example, recheck. A wrong sign when subtracting is not evidence the student needs an entire new lesson about all algebra.
- **Response budget:** Default to **one mathematical transformation and one main question per Coach turn**. Avoid six consecutive derivation steps, multi-part interrogations, and a wall of equations. A “show all steps” action can deliberately expand the display while keeping explanations visually chunked and accessible.
- **Do not abandon the room's configured preferences.** Per-turn requests for simpler wording or an example affect the current reply; they must not silently reset the persisted explanation level, teaching method, mastery, or question difficulty.
- **Use the actual content.** If the room only covers single-variable linear equations, do not spring calculus or quadratic-formula problems on the student. If the teacher prefers balancing both sides, preserve that method rather than silently introducing an alternate shortcut.

### Representative Coach behavior

**Student:** “Help me solve 2x + 3 = 11.”

**Coach me / Simpler:** “We want x alone. What should we subtract from both sides?”

**Student:** “2.”

**Coach:** “Subtracting 2 would leave 2x + 1. Try removing the +3 first. What should you subtract?”

**Show me / Standard:** “First subtract 3 from each side: 2x = 8. What operation would isolate x now?”

**Challenge me / Deeper:** “Solve 2x + 3 = 11 and justify each inverse operation. Begin with your first step.”

These are **design examples**, not outputs from a tested Coach or symbolic solver. Every level retains the same correct operations and grading criteria; only the delivery differs.

## Phased engineering work (future work, not completed)

**M1 — Text-first math Coach.** Support a bounded, well-tested set: arithmetic, fractions, signed numbers, one-variable linear equations, and introductory polynomial/factoring tasks *only when supported by the uploaded material*. Resolve actual baseline generation/grading behavior first. Reuse existing APIs/Director/preferences. Add a typed verification adapter only for demonstrated gaps; no new UI page or photo endpoint.

**M2 — Step diagnosis and validated practice.** Identify first incorrect transformation versus a merely incorrect final answer; generate and independently check similar problems; record hint use and misconceptions; provide focused rematches.

**M3 — Narrow expansion if evaluations justify it.** Expand to additional math classes (including quadratics) and/or confirm equations recognized from *existing uploaded worksheets*; only after accuracy, latency, cost, safety, and human usability evidence. No standalone camera homework solver by default.

## Acceptance criteria and verification plan

Nothing below has been executed; these are release gates for the later implementation.

1. **Correctness:** Curated golden examples cover integer/fraction arithmetic, sign errors, distributive property, one-step/two-step linear equations, factoring, two-root equations, unsolvable/infinite-solution cases, and extraneous roots. All recorded steps must validate; an unverified step must not be presented as verified.
2. **Honest uncertainty:** Ambiguous notation (for example “2/3x”), failed OCR, unsupported techniques, and weak retrieval must request clarification or state the limitation instead of guessing.
3. **Scope:** The same input under two different Study Rooms never leaks sources, topic requirements, or generated problems; teacher study guide controls topic scope.
4. **Pedagogy:** Separate evaluation for Show me / Coach me / Challenge me crossed with Simpler / Standard / Deeper. Explanation-level changes do **not** change math truth, task/rubric, or the persisted preference.
5. **Overload:** Default turn contains one main question/target step; the existing language-floor checks pass. When a student repeatedly struggles, Coach reduces the *next step's size/support burden* without mechanically downgrading the reading preference or faking mastery.
6. **State:** “Hint,” “why?,” “show me,” “I don't know,” “another one,” and typed answers preserve/resolve the correct pending encounter; retrying a submission never double-counts progress or spend.
7. **Practice:** Generated problems are on-topic, solvable, nonduplicate where practicable, and checked before delivery. Incorrect intermediate work receives actionable feedback, not blanket “wrong.”
8. **Safety:** No eval/exec of equation text, no uncontrolled symbolic complexity/DoS, no unauthorized access to uploads, no private data in logs, and no second model/provider path outside the existing cost/guard boundary.
9. **Field test:** Evaluate with a novice learner and a more advanced learner; measure whether they can *take the next step independently* and explain an error, not merely view the correct final answer.
10. **Release discipline:** Targeted unit tests + adversarial math tests + current Coach tests/evals + real-user flow check. Verify AI cost/latency and rollback. Do not mark complete from this document or a mocked success.

## Decisions and explicit non-goals

- Keep **Coach** as the sole student-facing math-tutoring surface.
- Keep existing explanation-level and Coach-mode settings; do **not** introduce a dedicated “Mathway mode.”
- Keep source-grounded Study Room scope and the current deterministic learning evidence.
- **Do not** add Chegg answer retrieval, textbook-solution scraping, handwriting erasure, an independent photo-to-answer service, an answer marketplace, or a fresh mastery system.
- Do not add SymPy, mathsteps, a Python service, or a new UI workflow just because the reviewed examples used them. First evaluate a small integration against the actual code and tests.

## Source register

- **REA method:** https://github.com/morluto/rea — published analysis/evidence workflow and runtime prerequisites (methodology only).
- **Open-source solver:** https://github.com/google/mathsteps and https://github.com/google/mathsteps/wiki/How-to-use-mathsteps — change types, AST-based transformations, archived repository; license https://github.com/google/mathsteps/blob/master/LICENSE.
- **Open-source image pipeline:** https://github.com/filipdomkc/FormulaDecoder — README; server/main.py; server/utilityoop.py; server/requirements.txt (including unsafe eval risk).
- **Chegg observed product:** https://www.chegg.com/study — public study/verified-answer descriptions only.
- **Mathway observed product:** https://www.mathway.com/Algebra — typed/photo entry and visible step-by-step product claims only.
- **Studigo source of truth:** /AGENTS.md; /ENGINEERING.md; /docs/PRODUCT.md; /packages/ai/src/coach.ts; /packages/ai/src/coach-language.ts; /packages/ai/src/study.ts; /packages/learning/src/preferences.ts; /apps/web/lib/coach-director.ts; /apps/web/lib/coach-render.ts; /apps/web/lib/coach-preferences.ts; /apps/web/lib/explain-level.ts.

**Bottom line:** Copy the *engineering pattern*, not the products: verified symbolic steps from mathsteps, explicit recognition/parsing separation from FormulaDecoder, question-specific explanations from Chegg, and progressive method display from Mathway. Keep Studigo's differentiation: Coach teaches **the student, on their materials, at a manageable pace**, with deterministic correctness and durable learning evidence.
