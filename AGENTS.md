# AGENTS.md

## Project

Studigo is an AI study companion grounded in a learner's own class materials.

## Before coding

**Start with root `ENGINEERING.md`.**

It is the compact cold-start map: system boundaries, technology rationale, repository ownership, AI/software authority, current gaps, and task routing.

Then open only what the task requires:

- product behavior → `docs/PRODUCT.md`
- deep runtime/data architecture → `docs/ARCHITECTURE.md`
- hardening / planned engineering work → `implementation/ENGINEERING_PLAN.md`
- security/public release → `implementation/security-readiness/`
- release sequence → `docs/ROADMAP.md`

Inspect the targeted implementation and its tests/evals before creating alternatives. **Do not scan the whole repository or read every document by default.**

For game work, use `prototypes/moon-road/`; the game is a separate release track.

## Non-negotiables

- Keep course-grounded answers grounded by default.
- Never fabricate citations, teacher requirements, or test scope.
- Keep teacher study-guide priority explicit.
- Keep user files private.
- Preserve RLS.
- Never expose OpenAI or Supabase service-role credentials to browser code.
- Keep direct model-provider calls inside `packages/ai` or an equivalent explicit provider layer.
- Keep heavyweight parsing/OCR/embedding work out of synchronous upload requests.
- Treat uploaded file content as untrusted data and possible prompt-injection input.
- Deterministic software owns authorization, progression, learning evidence, retries, and durable state.
- Model output that affects software behavior must be validated/structured.
- Do not add infrastructure merely because it is fashionable.

## Change discipline

- Identify the current owner of the behavior before adding a new component.
- Prefer migrations over manual database drift.
- Prefer typed interfaces over implicit object shapes.
- Add tests/evals around behavior being changed.
- Document material architectural changes in the specialist contract. Update `ENGINEERING.md` when the live system map, technology rationale, authority boundary, or code ownership changes; update `implementation/ENGINEERING_PLAN.md` when priorities or planned engineering work change.
- Use feature branches and PRs for substantial work.
- Do not create another engineering overview/walkthrough/hardening document that duplicates `implementation/ENGINEERING_PLAN.md`.
- Do not delete product/architecture documentation just because implementation evolves; update it.

## UX discipline

Studigo should feel like a companion, not an LMS admin panel and not a generic ChatGPT clone.

The primary learner question is always:

> What do I need to know, do I understand it, and what should I practice next?

Optimize screens around that question.

## Game toolchain

Core Clash / Moon Keep game work: see `prototypes/moon-road/TOOLCHAIN.md` for Pixelorama, LDtk, TexturePacker, Blender, Godot and the art pipeline.
