# Problem Statement — Coach "Give me N questions"

## Symptom (what the user reports)

When a learner opens the Studigo **Coach** and asks for a set of practice
questions — e.g. *"give me 10 questions"* — the coach does **not** return 10
questions. Instead it **self-narrates**: it repeats or paraphrases the
customization options the learner selected ("here's how I'll help you...")
without ever producing the requested questions.

Expected behavior: a request for *N* questions yields *N* distinct,
source-grounded practice questions (respecting the learner's selected topics,
difficulty, and format), or an explicit "not in your materials" response when
the evidence is missing — never a description of the coach's own configuration.

## Why this matters

This is the core companion promise: *"What do I need to know, do I understand
it, and what should I practice next?"* A coach that describes itself instead of
generating practice fails the primary learner question and makes the product
feel like a settings screen rather than a tutor.

## Scope

- **Affected surface:** the Coach conversation (`coach` mode) inside a Study
  Room, and the fixture mirror of it used for account-free testing
  (`/dev/study?mode=coach` → `/api/dev/coach`).
- **Grounding rule is not in question.** The fix must keep course-grounded
  answers grounded by default and must not fabricate citations or test scope.
- **Constraint:** TypeScript/Next.js monorepo only. No Python runtime, no
  separate ML service. Direct model-provider calls stay inside `packages/ai`.

## Root causes identified during investigation

1. **Intent was never routed.** A literal request like *"give me 10 questions"*
   has almost no content words to retrieve against. RAG returned nothing, the
   grounding gate refused, and the refusal/narration path ran instead of a
   question-generation path. The coach had no notion of *"this message is a
   request to generate a practice set"* vs *"this is a grounded question about
   the material."*

2. **No single decision layer.** Topic selection, grounded generation,
   formatting, and citation assembly were separate steps with no orchestrator
   deciding intent → topics → generate → format → cite as one pipeline.

3. **Near-duplicate collapse in generation.** Even once generation ran, the
   dedup logic (Jaccard over stop-word-filtered tokens) correctly collapsed
   questions that differed only by an index number, so "10 questions" could
   return far fewer. Early test fixtures produced near-identical prompts and
   masked this as a "dedup bug" when the real gap was fixtures that did not
   represent genuinely distinct material.

4. **Sandbox model transport.** The sandbox dev server historically could not
   see `OPENAI_API_KEY` (it is injected into the v0-managed server, not into
   Bash-spawned processes), which surfaced as `OPENAI_API_KEY is not
   configured` and, after the AI-Gateway fallback was added, as a `403 AI
   Gateway requires a credit card` in the sandbox. Both are
   **environment/billing limitations of the preview sandbox**, not defects in
   the coach logic. On the deployed Vercel app `OPENAI_API_KEY` is present and
   the direct OpenAI path runs.

## Current status

- Intent routing into practice generation is **implemented** in the production
  engine (`apps/web/lib/engine.ts`) and the recommendation engine
  (`apps/web/lib/recommendation-engine.ts`), and verified by unit +
  end-to-end pipeline tests (25 tests, green 10× consecutively).
- Reaching the **generation step** (rather than the narration path) is
  reproducible via the fixture coach surface — the original narration bug is
  gone on both the production and fixture paths.
- The remaining friction is **sandbox-only** model transport (see root cause 4).
  Live-site verification with real generation is the open item.

See [`ATTEMPTED_FIXES.md`](ATTEMPTED_FIXES.md) for the chronological log of
changes and what each one proved or ruled out.
