# Studigo V5 — Home, Room Entry & Onboarding Execution

**State:** implementation candidate; not yet an approved production release.
**Base:** V4 merged in PR #234 at `6d4ae86`, Vercel Ready `dpl_7CgHQvnDxKxEQ56JGaEhkjpo5L5d`.
**Design authority:** `docs/DESIGN_SYSTEM.md`, existing Home/first-room components, approved Study Room chrome and `STUDIGO_CROSS_DEVICE_VISUAL_UNIFICATION_PLAN.md`.

## Net-new implementation

| Surface | Behavior and source | Acceptance |
|---|---|---|
| First-run source decision | `app-home.tsx`: sample and own-file routes no longer share invented sample content; own-file path creates source-empty room and lands at Materials | No sample subject/topic/answer on own-file route; honest next upload; no mastery claims |
| First-run choices | `app-home.tsx`: radio-like goal choices have keyboard arrows, Home/End and roving focus | Same selected/keyboard/visual state, 44px-class targets |
| First-room destination | `first-run.ts`: only an own-file room gets `?mode=materials`; sample preserves existing default | No new routing/API, blank title remains optional |
| Returning room creation | `create-room-form.tsx`, `app-home.css`: prefilled editable room name; secondary details disclosed natively | One first decision; keyboard focus and optional data remain available |
| Regression coverage | `v5-home-onboarding-qa.mjs` in existing visual workflow; `first-run.test.ts` | 320/390/820/1440, source honesty, goal keyboard, disclosure, no overflow, sample path and correct route |

## Existing interfaces deliberately retained

- Room card metadata and source counts remain derived from real room data; `RoomCardLink` routing and `HomeHero` recommendation are unchanged.
- App shell and room rail already share desktop collapse semantics and responsive mobile navigation; do not duplicate or replace them.
- `RoomSettings` owns explanation level, test date, color and companion settings; no duplicate setting storage.
- Login/signup stay inside their existing authenticated form and provider boundaries, including any explicitly displayed beta retention policy.
- `StudigoStage` uses canonical companion sprites. The room `Companion` collision resolver and V4's new content-safe zones remain the authority.
- No Supabase migration, student data reset, grading/reward change, new learner telemetry, assets, fonts or dependencies.

## Exit criteria and evidence

- [ ] CI validate/typecheck/unit/build.
- [ ] PostgreSQL/security contention.
- [ ] Four-width synthetic Home/first-run, browser focus, overflow and existing V1–V4 gates.
- [ ] Merge exact green PR head into main.
- [ ] Verify Vercel Ready production alias on exact merge SHA.
- [ ] Owner checks actual first-time registration, own PDF upload → first useful explanation, room persistence and returning state.
- [ ] Hardware iPhone/iPadOS Safari keyboard/safe areas, 200% text and VoiceOver. Synthetic/WebKit are not hardware certification.

Remaining owner/hardware acceptance should not be mislabeled as failed implementation or a passed gate.
