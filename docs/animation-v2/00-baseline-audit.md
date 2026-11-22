# Phase 0 — Baseline audit

**PASS · 2026-11-21.** Continuation starts at Phase 1. This is an inventory of the existing implementation and recovered work. Runtime acceptance belongs to later gates.

## Recovery and rollback anchor

Fetched and independently queried `refs/heads/feat/studigo-animation-v2`. The local branch and remote both started at `62cebe84c2d2248a2e6f39eecc825984fc9ca411` (0 ahead, 0 behind). The checked-out branch already included the no-swap change `15f7213` and puppet art `c1561eb`.

- The Claude orchestration worktree `animation-v2-phases-6bfd86` was clean at the same commit. The Phase 0 agent worktree `agent-a40b92336407dbb60` was one commit behind and had two untracked PNGs. Both are [recovered here](evidence/phase0/) with SHA-256 matches against the originals.
- The puppet art worktree matched `c1561eb`. The Rive installer worktree was clean with no project source. The foundation worktree was clean in Git and contained the three approved films in its ignored reference workspace.
- No `.riv`, `.rev`, `.rml`, or `rive.yaml` was found in Git history or the scoped local project and upload search. No unpublished animation V2 commits or stashes were found. The preexisting untracked `design/living-companion/evidence/character-tech-research.md` remains in the primary worktree and is excluded from takeover commits.
- Baseline rollback is a build from `62cebe8` on an isolated checkout, or a revert of the future integration commits. On the existing build, `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION=off` selects the sprite path and `NEXT_PUBLIC_STUDIGO_COMPANION=off` disables the Study Room mount. These are build-time flags. Test all three paths during integration.

## Live runtime and contracts

| Owner | Current behavior and reuse |
| --- | --- |
| `components/companion/companion.tsx` and Room `workspace.tsx` | Reactive mount, room scoping, settings and `useCompanion().event(name, payload?)` / `thinking(on)`. Keep these boundaries and the silent default outside the provider. |
| `engine.ts` and `companion.css` | Floating and strip placement, drag, sizing, keyboard and touch, pet/poke, speech, calm mode, growth, outfit selection, seat, hide/bring-back, and cleanup. Preserve the host and presentation rules when replacing the drawing path. |
| `lib/companion-motion/` | Pure director, springs, expression channels, beat priorities, visemes, mesh landmarks, and outfit URLs. Reuse outcome mappings and the existing behavioral semantics. Visual tracks migrate at later gates. |
| `rig-renderer.ts` | WebGL texture mesh and shader, rendered over the front artwork or a dressed texture. The current engine creates the director with `drawings: false`, so it no longer requests pose swaps in motion mode. The renderer still contains legacy drawing support. |
| `renderers.ts` | WebP sprite fallback for motion-off, missing WebGL, lost context and failed assets. The engine parks and restores the rig on context recovery. |
| `stage.tsx`, `figure.tsx`, `studigo-mascot.tsx` | Separate full-body sprite stage (Home and onboarding), inline static figure (auth, cards, quiz rewards), and marks or illustrations (header seat, Coach, Learn, composer, loading, error, Cram reward). Public demo frames use the Study Room preset routes. Inventory each in Phase 7. |

Quiz and flashcards emit through the bridge after committed results. Guided Learn and Coach use the same provider. The typed list in `companion-logic.ts` covers correct, wrong, blindspot, set completion, flashcards, fast correct, stall, hint, mission completion and session return. Stall carries a level. The companion is presentation-only. Existing deterministic learning and reward owners stay in charge. Outfit unlocks and the saved choice are managed by the existing growth/preferences code.

## Reference assets and observed defects

- Brand authority is [the mascot bible](../brand/mascot/README.md). Production reference art includes the waist-up `center.webp`, the full-body `full/center.webp`, the approved pose sets, seven outfit variants, and the registered armless plate and two arm cutouts in `puppet/`. Source sprites and the build script live in `design/companion-demo/`. [Asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md).
- The recovered owner recording sheets document the earlier hybrid: [portrait swap and ghosting](evidence/phase0/sheet1-swap-and-ghost.png), [mirroring and flame discontinuity](evidence/phase0/sheet2-mirror-flame-jump.png). These frames are historic defect evidence. The baseline code already bypasses pose swaps in normal motion mode, while a flattened face, shallow deformation and the separate full-body path remain limitations.
- Three original approved films match the recorded LC-0 SHA-256 values. They are in the ignored `design/living-companion/workspace/references/approved-concept-videos/` of the foundation worktree. The tracked manifest and existing hydration script are the restoration route. The new V1 observation log records the motion reference independently of these baseline defects.

## Checks, risks and next dependency

- Scoped Git reference, history, worktree, file and checksum checks completed. Existing regression owners are `apps/web/lib/companion-*.test.ts` and `scripts/lc-{rollback,calm,companion}-qa.mjs` against the development Study Room. This audit did not rerun product QA.
- Historical [browser evidence](../../design/living-companion/evidence/LC-cross-browser.md) records Chromium passing its baseline run, a roughly 2 fps headless WebKit result, a report-only CSP console issue, Firefox emulated drag failures and the later bring-back race fix. Those are baseline observations. Safari on desktop, iPhone Safari and iPad Safari remain unverified.
- Rive CLI 1.10.0 is available and `rive doctor` reported an authenticated session. Android tooling is absent. There is no local canonical Rive project at the baseline.
- Principal risks are identity drift, disconnects at part seams, foot sliding, changed interaction mapping, lost outfit or growth state, reload or context-loss regressions, and Safari pacing. Keep the legacy renderer available throughout validation.
- Next dependency is Phase 1, with V1 frame analysis and the canonical structural views. No Rive rig milestone has passed.
