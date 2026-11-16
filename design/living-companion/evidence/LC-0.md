# LC-0 evidence: post-Phase-3 baseline

Status: PARTIAL. Code and deployment facts are recorded below. Screenshots, signed-in flows, geometry measurements, and the film archive still need a human or a network route.

## Task
LC-0 from `implementation/LIVING_COMPANION_V1_PLAN.md`: record the baseline SHA, production SHA, screenshots at five widths, nav→strip→rail geometry, flags, and archive of the three approved films with SHA-256.

## Baseline SHAs
| Item | Value | How verified |
|---|---|---|
| `main` (origin) | `056066fb2b13a0fe8a529bee74c630ea7c43e723` ("Make guided Learn checks varied and proportional to reading (#266)") | `git ls-remote origin main` on 2026-11-15 |
| Vercel production, newest READY deployment | `056066fb…` (deployment `dpl_7HvgGoe85BkxjhuMWi8LbhYYmzxZ`, project `studigo-ai`, team `gray-matter5`, state READY, target production, `isRollbackCandidate: true`) | Vercel `list_deployments`, target=production, state=READY |
| Prior production deployments | `5b1beb62…` (dpl_B4ywMs9…, "Add selectable topic scope to practice modes"), `53c3762a…` (dpl_3RpP32Q…, "Keep desktop room controls open while hovered") | Same query. Both are later than `056066f` by creation time only if ordering differs; the list is newest-first by `created`, so `056066f` is the newest. |

Production SHA matches `main`. Rollback anchor for the plan is this SHA.

## Companion code on the baseline (read, not run)
| Item | Location | Note |
|---|---|---|
| Event union | `apps/web/lib/companion-logic.ts:128` | Six events: `correct`, `wrong`, `blindspot`, `setDone`, `cardGood`, `cardMiss`. No `stall`, `hit`, or `miss`. |
| Event emitters | `quiz-panel.tsx:174,185`, `cards-panel.tsx:194-196` | Emitted after grading or rating. Coach and Learn send only `thinking(on)`. |
| Prefs | `companion-logic.ts:168-180` | `{speech, seated, tuck, dock, scale}`. `dock` is one of four corners. |
| Engine | `apps/web/components/companion/engine.ts`, 724 lines | Pose swap through 15 entries in `WINDOW_POSES`. Idle heartbeat. Drag, resize, seat, tuck. |
| Pose sprites | `apps/web/public/mascot/companion/` | 13 waist-up WebP files, plus `mark.jpg` and `full/`. The two left diagonals have no file of their own: `MIRRORED` maps `up-left`→`up-right` and `down-left`→`down-right` (`companion-logic.ts:39`). |
| Full-body sprites | `apps/web/public/mascot/companion/full/` | 11 WebP files. Used by Home stage, not the window. |
| Kill switch | `companion.tsx:60` | `NEXT_PUBLIC_STUDIGO_COMPANION=off` removes him. |
| Strip slot | `mode-header.tsx:105-108,205` | `StudigoRail` is `aria-hidden` decoration. No strip slot for the companion exists. |
| Unit tests | `apps/web/lib/companion-logic.test.ts` (204 lines) | Pure logic only. No e2e spec for the companion was found in the tracked files (per `INTEGRATION_MAP.md` §8; not re-searched). |

## Discrepancy to correct
`design/living-companion/human-first-handoff/` and `INTEGRATION_MAP.md` give different sprite counts (15 and 10 in the pack, 25 files in the map). The count on `main` is 13 waist-up WebP, 11 full-body WebP, and 1 JPG. The pack's counts should not be used as a source.

## Not done in this session (blocked or needs a person)
- **Screenshots at 375, 390, 768, 1024, and 1440 wide:** requires a signed-in Studigo session. Not attempted.
- **Nav→strip→rail geometry:** requires a rendered page. Not measured.
- **Film archive (partial):** the sandbox cannot reach the CloudFront host (HTTP 403). The owner uploaded files instead. Recorded from the uploads, 2026-11-15:

  | File in repo | Concept | Size | SHA-256 | Probe |
  |---|---|---|---|---|
  | `design/living-companion/assets/video/studigo-floating-dock-concept.mp4` | V2, floating dock | 752,554 B | `7e3010798a7d98e36681992ffcc58f7a49ea67376c2aaebd3f6d6afcfe8606d3` | H.264, 1912x1080, 12.04 s |
  | `design/living-companion/assets/video/studigo-fixed-strip-concept.mp4` | V3, fixed strip | 8,281,714 B | `6dc5a8fb40ce8fa3ab792f8a07524816ae0bbf5a12d2bd410a435249af2ef84d` | H.264, 1912x1080, 12.04 s |

  | `design/living-companion/assets/video/studigo-character-concept.mp4` | V1, character only | 15,755,703 B | `a34b444eccc9e0e36cfe747b4b4e1d37f6fa4ea7fcd15a0ce46f30f322232a37` | H.264, 1440x1440, 12.04 s |

  Two V3 uploads were byte-identical copies, so only one is kept. All three films are now archived. Repo size policy for MP4s is OPEN (plan says Git LFS, Drive, or repo; see `assets/ASSET_MANIFEST.md`), so these files are not committed.
- **Flags on production:** not read. Vercel env var values are not exposed through the tool, and the plan says the flag is build-time.

## Next
1. Person: download the three films and record SHA-256 (`sha256sum`), or give them to the repo.
2. Person or browser session: five-width screenshots plus geometry with the companion on and off.
3. Then close LC-0 and start LC-0b (stall measurement).
