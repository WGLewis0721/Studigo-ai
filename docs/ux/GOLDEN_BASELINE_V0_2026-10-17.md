# Studigo V0 — Production golden baseline (2026-10-17)

**Status:** golden source and production deployment VERIFIED; multi-width screenshots will be attached by the Phase 3 visual evidence CI workflow for this PR.  
**Scope of ad hoc V0:** archive the current working production version and its visual state for rollback, then advance to V1. **No general UI/UX defect audit or redesign in V0.**

## Frozen rollback anchors

| Anchor | Verified value |
|---|---|
| GitHub repository | `WGLewis0721/Studigo-ai` |
| Golden source commit | [`726b1e7b061109b9c31b658f37fb97da0722e8d0`](https://github.com/WGLewis0721/Studigo-ai/commit/726b1e7b061109b9c31b658f37fb97da0722e8d0) |
| Frozen branch | [`golden/pre-v1-2026-10-17-726b1e7`](https://github.com/WGLewis0721/Studigo-ai/tree/golden/pre-v1-2026-10-17-726b1e7) |
| Production Vercel deployment | `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`, `READY` |
| Production deployment URL | `https://studigo-do3mj5lnl-gray-matter5.vercel.app` |
| Production aliases at freeze | `https://studigo-ai.vercel.app` and `https://studigo-ai-gray-matter5.vercel.app` |
| GitHub post-merge checks | `build`, `validate`, `deploy`, `report-build-status`: all `success` |
| UX/brand reference | `docs/DESIGN_SYSTEM.md`, `docs/brand/STUDIGO_OFFICIAL_BRAND_BOARD.png`, `docs/ux/FOUNDATIONAL_UX_PRINCIPLES.md`, `design/ASSET_INVENTORY.json` |

The frozen branch points to the **unchanged golden commit**, separate from later documentation/V1 commits. Do not advance or rewrite this branch. Its code snapshot is restorable; deleted Supabase user uploads and accounts from the previous owner-approved reset are **not** recoverable by a Vercel code rollback.

## Screenshot proof and limits

The [Phase 3 visual evidence CI workflow](https://github.com/WGLewis0721/Studigo-ai/actions/workflows/phase3-visual-evidence.yml) captures, at 320×720, 390×844, 820×1180 and 1440×900:

- Synthetic fixture representations of Study Room sections including Coach, Materials, Quiz, Cards, Practice Test, Progress, Plan, Cram and the accepted Learn → Explore journey. These are generated from actual app code on the golden source tree (the V0 PR changes no runtime component). They are clearly **synthetic**, not authenticated real learner rooms or evidence of real student outcomes.
- The **live public** landing page and sign-up screen at the published production domain, captured separately using Chromium and marked with the production deployment identity. No personal student data, credentials or authenticated content are recorded.
- `report.json` for the synthetic four-width regression suite: browser version, source-tree hash, snapshot filenames, overflow checks and failures.
- `golden-public-manifest.json`: production URL, fixed golden source SHA, captured viewport, route/status and screenshot names.

**Retention:** the CI artifact is retained for 90 days on the golden baseline PR; download and archive it separately if long-lived pixel reference is required. The immutable source/production deployment anchors and this rollback runbook are the long-lived recovery authority. Screenshot baselines complement source control; screenshots alone cannot restore functionality.

### Visual acceptance gate

The CI run must be **green**, with both the four-width synthetic fixture and real public-page capture. Link the completed CI run/artifact here before advancing V1. **V0 is not finished if screenshots or the production-deployment identity are unverified.**

## Rollback runbook (V1 or later)

**Trigger:** a V1 or later release demonstrably breaks production navigation, Learn, sign-in, or critical student workflow.

1. Freeze new merges; collect failing route/device screenshots and commit SHA.
2. In Vercel, rollback **the Studigo production project** to Ready deployment `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn` via the supported project rollback action. The rollback target must match SHA `726b1e7`.
3. Verify the production alias now serves the golden deployment; check `/`, `/signup`, then verify signed-in navigation/source access with a disposable authorized test account if available.
4. If code history also needs reverting, open a targeted revert PR against current main, or restore from frozen `golden/pre-v1-2026-10-17-726b1e7`. **Do not force-reset main or silently overwrite later migrations.**
5. Review Supabase schema/API compatibility before any code rollback that crosses a future database migration; never assume restoring code restores deleted user records.
6. Record rollback deployment ID, evidence and follow-up fix. Do not claim the rollback was exercised merely because its target and API were verified.

**Golden verification versus rollback rehearsal:** the production deployment is confirmed Ready with aliases and the GitHub commit/checks confirmed. No production rollback has been executed; doing so now would unnecessarily interrupt the working app.

## Handoff

Once screenshot CI and this record are green, begin **V1 — shared controls/navigation** on a fresh branch from the then-current `main`. In V1, first compare existing production `workspace.tsx`, `mode-header.tsx`, `use-collapsing-tab-bar.ts`, `mode-glyph.tsx` and Learn action dock against the foundational UX pillars; implement small reusable, accessible changes with tests. Do not import `feature/phase3-ui-foundation` wholesale or begin V2.
