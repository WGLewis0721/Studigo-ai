# Golden pre-redesign checkpoint — 2026-10-15

This checkpoint preserves the last production application *before* the Phase 3 room-by-room visual overhaul. It changes documentation and captures only; it does not alter application code, data, authentication, flags, or deployment configuration.

## Source of truth

- Application baseline: `62715fda381cf00d844dd61649e048d1be1d4d35` on `main` (Coach arithmetic example merge, PR #153).
- Production Vercel deployment observed READY: `dpl_DL3wsjbgSu6LvKG82B7p7zDbJJyU`, source SHA `62715fd`.
- Canonical public URL observed: https://studigo-ai.vercel.app/ .
- Public room demo: https://studigo-ai.vercel.app/demo/index.html . The demo uses sample Science content and is **not** a signed-in learner account.
- The golden merge commit and `rollback/studigo-ui-golden-20261015` ref must point to the same application tree plus these captures. Record the exact resulting SHA in the release/PR handoff.

## Captures

| Image | Evidence | Limitation |
| --- | --- | --- |
| [Production landing](./production-landing.jpg) | Public production landing, full-page browser capture | Scroll-triggered reveal sections appear blank in this one unscrolled capture; use the live page or scroll through when comparing those sections. |
| [Coach demo](./coach-demo.jpg) | Public mobile demo, Science / Matter and Its Properties, Coach entry state | Synthetic content, not proof of live grading or persistence. |
| [Learn demo](./learn-demo.jpg) | Public mobile demo, Learn entry state | Synthetic content, not proof of retrieval/citations. |
| [Materials demo](./materials-demo.jpg) | Public mobile demo, upload/source list state | Synthetic files, not proof of upload processing. |

These are visual references, not golden assertions about server-side behavior. Preserve the semantics underneath redesign: course-grounded Learn, the Coach grading/follow-up protocol and gauge, private materials, practice, progress, and plan.

## Rollback contract

1. Stop rollout and identify the exact failing redesign deployment/commit.
2. Prefer disabling the affected room flag if that restores the previous UI without a code deploy.
3. If code rollback is needed, use the immutable checkpoint `rollback/studigo-ui-golden-20261015` to create a **revert PR** or promote its known-good Vercel deployment. Do not force-reset `main`.
4. Verify branch SHA, required CI checks, Vercel READY status, canonical URL route health, and a representative learner flow before treating a rollback as complete.
5. Database migrations or external state introduced after this checkpoint are **not** reversed merely by reverting UI code. Assess them separately.

## Gate before redesign agents

- [ ] Golden PR CI / required checks green.
- [ ] Golden Vercel status success. A documentation-only ignored build may have a CANCELED deployment object; confirm the ignored-build-step reason rather than treating it as a READY preview.
- [ ] Golden PR merged; existing production deployment remains READY at application baseline SHA `62715fd`, with the canonical alias and public routes rendering. The documentation-only merge may intentionally skip a new deployment.
- [ ] Rollback branch created at and read back as exact golden SHA.
- [ ] No application-code delta in golden PR.
- [ ] Captures and this rollback note present in the merged tree.

The checklist is intentionally left unchecked in the committed artifact: the release operator must verify it against live status and report results in the PR/handoff.