# LC authoritative sources

Tags: **verified** (checked against the source on the date) · **assumption** · **open**. Checked 2026-10-25.

## Repository
| ID | Source | Tag | Notes |
|---|---|---|---|
| LC-SRC-001 | WGLewis0721/Studigo-ai `main` @ `056066fb2b13a0fe8a529bee74c630ea7c43e723` | verified | Integration map baseline. |
| LC-SRC-002 | `apps/web/components/companion/companion.tsx`, `engine.ts` (~724 lines) @ `056066fb2b13a0fe8a529bee74c630ea7c43e723` | verified | Context API, drag/resize/dock, pose swapping (15 WebP + eyelids). Paths: see INTEGRATION_MAP.md. |
| LC-SRC-003 | `read-aloud-control.tsx` @ `056066fb2b13a0fe8a529bee74c630ea7c43e723` | verified | Only voice on main is browser speech; no amplitude. |
| LC-SRC-004 | `docs/ROADMAP.md` @ `056066fb2b13a0fe8a529bee74c630ea7c43e723` | verified | Phase 4 = reliability, safety, cost. |
| LC-SRC-005 | Branch `research/phase4-coucou-rea-behavior-spec` @ `7831ec1` (PR #164) | verified | No shared history with `main`. |
| LC-SRC-006 | `guided-learn` branch | verified | Fully contained in `main` (main 499 commits ahead on Oct 25). |

## External
| ID | Source | License | Tag | Notes |
|---|---|---|---|---|
| LC-SRC-010 | https://github.com/WGLewis0721/coucou (fork of Coucou) | Code open source; Mochi art/likeness reserved | verified | Borrow structure/numbers, not art. |
| LC-SRC-011 | https://github.com/WGLewis0721/rea (REA fork) | see repo | verified | Low value for open-source targets. |
| LC-SRC-012 | https://github.com/smontlouis/bible-strong-avatar-lab | AGPL-3.0-only | verified | Reference only. No mouth/lip-sync, gaze-follow, RN, or state machine. |
| LC-SRC-013 | https://limora.ai | Commercial ($29/$59 mo) | verified (pricing) / open (ToS) | No link to Avatar Lab found. |
| LC-SRC-014 | Meta Muse agent + "Jolly" mascot | proprietary | assumption | Outfits, working animations, speech-synced face/hands/body. |
| LC-SRC-015 | OpenAI "dots" | proprietary | assumption | Customizable shape/color/eyes/accessories. |
| LC-SRC-016 | Pokémon GO buddy system | proprietary | verified (public help docs) | 5 moods, decay without interaction, AR petting. |
| LC-SRC-017 | Grok companions emotion list | proprietary | assumption (third-party extraction) | 7 emotions; affection meter excluded for kids. |
| LC-SRC-018 | Grok Bot mascot head turn / gaze | proprietary | open | No public description found. |
| LC-SRC-019 | Rive runtime / editor | Rive ToS | assumption | Performance on low-end Android unproven until spike. |
| LC-SRC-020 | Higgsfield | Higgsfield ToS | assumption | Flat image/video output; layer separation needed. |
| LC-SRC-021 | Owner handoff artifact "Studigo_v2_Phase4_Grok_Handoff" (private, not committed) | — | verified | Approved decisions summarized in DECISIONS.md only. |
