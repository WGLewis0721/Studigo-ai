# Studigo Explore — seven-phase execution ledger

**Status:** implementation on isolated branch; default authenticated Learn remains unchanged.  
**Baseline:** `main` at `b677a2c29b6dfd1d4532d989cfca4f613a8ae581` (2026-10-16).  
**Design authority:** `docs/DESIGN_SYSTEM.md`, `docs/brand/README.md`, live room components, and `design/phase3/` on `feature/phase3-ui-foundation`. Do not merge historical prototype assets wholesale.

## Reference lock

- Primary: current Studigo room shell, Learn teal, Snow canvas, matte reading cards, molded keys, Figtree/Bricolage, one canonical companion; **no new art language**.
- Refero: [MasterClass expandable curriculum](https://refero.design/screens/4afa2954-1b0f-483e-8c70-ab3476e74a20) supplies collapsed/expanded chapter pattern; [Runes course completion flow](https://refero.design/flows/9907) supplies return-to-journal continuity; [Preply web learning-plan screen](https://refero.design/pages/8d17cf60-e52b-4ea3-af22-360dd7e59cab) supplies compact topic rows.
- External research: [WoW quest log organization](https://warcraft.wiki.gg/wiki/Quest_Log), [Classic split quest log](https://www.curseforge.com/wow/addons/kerzo-classic-quest-log), and [Duolingo's path rationale](https://blog.duolingo.com/new-duolingo-home-screen-design/) inform navigation only. No outside assets or styles are copied.
- Pinterest: prior accepted Phase 3 reference ledger includes https://www.pinterest.com/pin/gamified-learning-app-ui-in-2025--229472543509420844/ as a **layout-only** sketch; no unlicensed artwork imported.
- Existing React/CSS and APIs remain source of truth. Only propose an element when existing code cannot supply it.

## Seven execution phases and gates

| Phase | Deliverable | Acceptance / stop |
|---|---|---|
| 1. Audit | Current routes, authority, assets, source/lesson data map | Identify real APIs and owner of each state. No invented chapter–topic mapping. |
| 2. Research & lock | This bounded reference ledger, keep/adapt/create map | Approved Studigo tokens prevail over all external references. |
| 3. Quest model | Deterministic journal from authorized topics, optional exact-match guide chapter labels | No invented chapter membership, grades, or completed history. |
| 4. Explore UI | Journal, selected quest detail, Original/Explore toggle within existing Learn, lesson return | Stable keyboard interactions; responsive at 320/390/820/1440. |
| 5. Guided Learn link | Reuse mission start/restart/resume; preserve current source check, voice/read-aloud and feedback | No second lesson or assessment engine; no overwrite of unfinished lesson on an unrelated quest. |
| 6. Validation | Pure unit cases, typecheck/build, same-SHA visual and authenticated private room checks | A green CI build alone does not establish signed-in or device acceptance. |
| 7. Isolated canary | Existing private server-side `PHASE3_ROOM2_ROOM_IDS` + explicit `?guided=1`; authorized tester room, real guide, rollback proof | Only after authenticated end-to-end, source revision, persistence and four-width gates. Do not turn on global flag or touch another owner's room. |

## Verified backend boundary and remaining work

- `topics` gives UUID, objective, `order_index`; it does **not** give a chapter key. `StudyGuideContent.chapters` has authored chapter titles and evidence, but no general mapping to `topics.id`. A chapter-to-quest relationship may be shown only after a unique exact title/objective match; other topics stay in the honest `Guide topics` group. Stale guide editions are not authoritative.
- `/api/learn/mission` and `learn_mission_cursors` keep **one** room-wide cursor (primary key owner + room), not a saved cursor per quest. The UI must show only the currently verifiable state. It cannot claim past completions or seamless back-and-forth multi-quest resumption. New per-quest persistence needs a separate reviewed additive model and RLS/source-revision testing before Phase 7 acceptance.
- `/api/learn` performs a grounded start; `commit_learn_mission` checks the current document/chunk and request revision. A new quest would use restart and displace an unfinished cursor, so the initial journal must block that displacement, not quietly destroy progress.
- No user-owned test room/guide is selected in this branch; no production or Supabase mutation is authorized by this ledger. Actual canary link requires an authenticated user-owned room and verified environment allowlist.

## Keep / adapt / create

- **Keep:** shared 5-section navigation, Coach proportions, original Learn, existing Guided Learn player, source sheet, taps/voice/read-aloud, companion, backend admission and grade paths.
- **Adapt:** `coach-panel.tsx` for a locally controlled Original/Explore selection when the existing canary is authorized; `learn-mission.tsx` for a journal entry/return action.
- **Create:** small accessible Explore journal, deterministic view model, scoped CSS and focused tests. No new dependencies, custom icons, imagery, fonts, rewards, global routes or companion controllers.

## Evidence log

- Phase 1/2: examined `workspace.tsx`, `coach-panel.tsx`, `learn-mission.tsx`, `rooms.ts`, `guide-preview.ts`, `guide-content.ts`, `api/guides/edition`, `api/learn/mission`, and `20261015010000_learn_mission_cursor.sql`; consulted Refero screens/flow and public quest pattern references.
- Phase 3–7: record actual commit SHAs, CI, screenshots, authenticated access and missing evidence in PR; never substitute synthetic fixture success for a release gate.
