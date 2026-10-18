# Studigo V5 — Home, Room Entry & Onboarding Execution

**State:** First V5 slice shipped in PR #235. Second closure candidate adds shell/settings/auth verification; do not claim final signed-in/hardware acceptance before observed.
**Original base:** V4 merged in PR #234 at `6d4ae86`. **New approved golden:** `daeaa67`, immutable Ready deployment `dpl_AcPtnhTyyYoSjWVJvn3NEFbrZnkb`, [golden runbook](GOLDEN_BASELINE_PRE_V5_V6_2026-10-18.md).
**Design authority:** `docs/DESIGN_SYSTEM.md`, existing Home/first-room components, approved Study Room chrome and `STUDIGO_CROSS_DEVICE_VISUAL_UNIFICATION_PLAN.md`.

## Net-new implementation

| Surface | Behavior and source | Acceptance |
|---|---|---|
| First-run source decision | `app-home.tsx`: sample and own-file routes no longer share invented sample content; own-file path creates source-empty room and lands at Materials | No sample subject/topic/answer on own-file route; honest next upload; no mastery claims |
| First-run choices | `app-home.tsx`: radio-like goal choices have keyboard arrows, Home/End and roving focus | Same selected/keyboard/visual state, 44px-class targets |
| First-room destination | `first-run.ts`: only an own-file room gets `?mode=materials`; sample preserves existing default | No new routing/API, blank title remains optional |
| Returning room creation | `create-room-form.tsx`, `app-home.css`: prefilled editable room name; secondary details disclosed natively | One first decision; keyboard focus and optional data remain available |
| Regression coverage | `v5-home-onboarding-qa.mjs` in existing visual workflow; `first-run.test.ts` | 320/390/820/1440, source honesty, goal keyboard, disclosure, no overflow, sample path and correct route |

## Second V5 slice — shell and settings acceptance

- `scripts/v5-shell-settings-auth-qa.mjs` exercises **shipped AppShell, RoomRail, RoomWorkspace and RoomSettings** at 320/390/820/1440 with anonymous synthetic room content. It checks exactly one room navigator, focus return, real settings footer reachability, the official nine-color palette, the **device-local** theme surviving reload, reachable rail toggles, and horizontal overflow.
- The same browser matrix opens actual anonymous `/login` and `/signup` GET pages and verifies email/password form affordances, error-free rendering and overflow. It **does not sign in or submit credentials** and cannot certify persistence of user accounts.
- Existing V1–V5, messenger, Explore, companion and auto-hide checks remain active in the same visual workflow. No second shell, new mobile nav, schema or customer telemetry is introduced.

## Existing interfaces deliberately retained

- Room card metadata and source counts remain derived from real room data; `RoomCardLink` routing and `HomeHero` recommendation are unchanged.
- App shell and room rail already share desktop collapse semantics and responsive mobile navigation; do not duplicate or replace them.
- `RoomSettings` owns explanation level, test date, color and companion settings; no duplicate setting storage.
- Login/signup stay inside their existing authenticated form and provider boundaries, including any explicitly displayed beta retention policy.
- `StudigoStage` uses canonical companion sprites. The room `Companion` collision resolver and V4's new content-safe zones remain the authority.
- No Supabase migration, student data reset, grading/reward change, new learner telemetry, assets, fonts or dependencies.

## Exit criteria and evidence

- [x] First V5 Home/first-run slice: PR #235 merged, original CI/security/four-width tests green and production Ready verified.
- [ ] Second slice CI validate/typecheck/unit/build and four-width shell/settings/auth acceptance.
- [ ] Second slice PostgreSQL/security contention and inherited visual gates.
- [ ] Merge second slice exact green head into main.
- [ ] Verify Vercel Ready production alias on exact second-slice merge SHA.
- [ ] Owner checks actual first-time registration, own PDF upload → first useful explanation, room persistence and returning state.
- [ ] Hardware iPhone/iPadOS Safari keyboard/safe areas, 200% text and VoiceOver. Synthetic/WebKit are not hardware certification.

Remaining owner/hardware acceptance should not be mislabeled as failed implementation or a passed gate.

## Explicit V5 boundaries

- Room color and companion preferences intentionally persist **on this device** in current app storage. They do not yet sync between browsers or appear in game sessions; do not report cross-device personalization sync as completed.
- Live signed-in onboarding, an actual authorized PDF through OCR/index/cited first explanation, return-to-room, room updates/deletion and provider sign-in require a disposable authorized session; CI fixtures cannot verify them.
- Native Safari hardware dynamic type/VoiceOver and child usability require device/owner validation. This is a release acceptance gap, not evidence that synthetic tests failed.
