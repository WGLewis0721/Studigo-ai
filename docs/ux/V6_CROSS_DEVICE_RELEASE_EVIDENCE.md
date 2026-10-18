# Studigo V6 — Cross-device integration and release evidence

**Status:** Release candidate. Never infer real signed-in/iOS hardware/VoiceOver acceptance from anonymous synthetic browser screenshots.

## Immutable approved baseline

- **Golden source:** `daeaa67f32db2e981595515f62f9ed4b6487bbcc` (owner-accepted drawer/companion and Explore/Materials through #249)
- **Golden branch:** [`golden/pre-v5-v6-2026-10-18-daeaa67`](https://github.com/WGLewis0721/Studigo-ai/tree/golden/pre-v5-v6-2026-10-18-daeaa67)
- **Golden Vercel Ready deployment:** `dpl_AcPtnhTyyYoSjWVJvn3NEFbrZnkb`. [Capture and rollback record](GOLDEN_BASELINE_PRE_V5_V6_2026-10-18.md)
- **Golden snapshot workflow:** [#39126602974](https://github.com/WGLewis0721/Studigo-ai/actions/runs/39126602974), artifact `12135449939` (90-day retention, until 2027-01-16), 8 anonymous real-public screenshots and multi-width synthetic room/screenshots. The original V0 golden is preserved.

## V6 implementation boundaries

- `scripts/v6-cross-device-parity-qa.mjs` tests nine existing Study Room routes/subpages at 320/390/820/1440 against **identical fixture data**, recording 5 accessible navigation destinations, selected section, 44px class hit targets, no horizontal overflow, correct phone-bottom vs desktop-top navigation, and correct source/shell identity.
- Plan actions are explicitly checked at 44px, including Start/Mark done/Skip; 200% **simulated browser text** reflow is probed on Materials and Plan (not equivalent to OS Dynamic Type).
- CI captures representative Coach, Plan, Materials and enlarged-text screenshots, and saves a parity `report.json`. Existing V1–V5, Explore, WebKit smoke, security and messenger-specific gates remain mandatory.
- Retire obsolete `CoachAside` source (not imported or rendered since #233). Remove a few V3 CSS declarations provably superseded by shipped V4/V5 rules. **No** app shell redesign, mascot redraw, schema changes, or removal of the approved three-second drawer.
- Existing deliberate adaptations are preserved: mobile bottom navigation and touch-first actions; desktop top header/drawer; phone stacked reading and desktop wider panes; one canonical orange dragon and identical source-backed facts.

## Screen-by-screen release matrix

| Area | Automated synthetic evidence | Real signed-in/hardware gap |
|---|---|---|
| Home and returning room picker | V5 home QA + shell/settings/auth matrix at four widths | Actual user account/room persistence across browsers |
| Onboarding | Sample vs own source, goal keyboard/route, 320/390/820/1440 | Owned PDF upload, OCR/reindex, cited first Learn explanation |
| Coach and Learn/Explore | V3, messenger, drawer and source reader QA | Real learner context, voice permissions and iOS keyboard |
| Practice (Quiz, Cards, Test, Cram) | V3 graded UI / answer control tests, same-state V6 navigation | Real billing/generation and saved graded attempts |
| Progress and weak areas | V4 evidence/provenance tests, V6 nav and companion checks | Cross-device persisted real mastery data |
| Plan | V4 action routing, V6 44px buttons, long-heading/text reflow | Owner test-date, real actions and saved plan updates |
| Materials and citations | Source fidelity, V2 and V6 reading/reflow tests | Original user PDF, stale revisions, download/print and authorization |
| Room settings/companion | V5 footer/focus/theme checks, drawer/summon tests | Hardware Safari, VoiceOver, OS 200% settings and cross-device customization |

## Interpretation of differences

- **Intentional:** phone bottom navigation vs desktop header, stacked vs split information, mobile keyboard-aware dock, touch versus mouse companion interaction, adaptive document reading. These may look different but must offer the same actions and meaning.
- **Overlooked and addressed by prior releases:** Coach messenger misalignment (#232–#233), redundant information rail (#233), unreadable Materials/Explore source text (#238/#241/#244/#249), drawer placement and focus defects (#240/#243/#245/#248), first-run synthetic/sample ambiguity (#235), clipped settings footer (#238), Home device mockup offsets (#246/#247).
- **Evidence limitations:** image captures and synthetic testing never certify the behavior of actual private student documents or hardware screen readers. Owner approved the desktop Show-only drawer and summon behavior, **not every screen of V6**.

## Required release and rollback checklist

- [ ] CI typecheck, tests, production build, provider/design lint
- [ ] PostgreSQL/security contention and AI admission checks
- [ ] V1–V6 Chromium + WebKit interactive tests at 320/390/820/1440
- [ ] Side-by-side baseline vs final screenshots reviewed for major component changes, with no open P0/P1 defect
- [ ] Merge exact passing V6 head after V5 into `main` and verify matching Vercel Ready production alias
- [ ] Real signed-in new/returning account flow with authorized PDF, source citations, grading, persistence, permissions, errors
- [ ] Real iPhone/iPadOS Safari portrait/landscape keyboard safe areas, 200% text/zoom, VoiceOver, reduced motion
- [ ] Exercise rollback on a safe preview or maintenance window; **do not promote the golden deployment in healthy production just to claim a rehearsal**
- [ ] Archive 90-day artifacts if long-lived pixel reference is required

**Release policy:** Mark the V6 engineering implementation shipped only after green gates, merge and Ready deployment. Report hardware/private-source/owner signoff separately, even if the automated release is green. The prior snapshot is a code/deployment recovery point, not a database or student-content backup.
