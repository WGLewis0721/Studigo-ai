# Living Companion (LC) knowledge base

**Purpose:** retrieval-first source of truth for any LLM/agent working on Studigo's animated companion. Retrieve the relevant page(s) below, cite their stable IDs (e.g. `LC-DEC-004`), and verify live repo state before acting. Live code on `main` always beats these docs.

**Status:** IN PROGRESS. Motion director, mood meter, prefs v2, MouthDriver, WebGL mesh rig renderer (behind `NEXT_PUBLIC_STUDIGO_COMPANION_MOTION`), dock, strip, outfits and Calm mode are on the `claude/studigo-living-companion-upgrade-ee0706` branch; QA, renderer sign-off and voice are open. See [STATUS_2026-11-20.md](STATUS_2026-11-20.md). Track renamed from "Phase 4" to "Living Companion (LC)" because `docs/ROADMAP.md` Phase 4 means "Reliability, safety, cost" (LC-DEC-001).

**Branch note:** the *original research branch* (`research/phase4-coucou-rea-behavior-spec`, PR #164) has unrelated history and must not be merged into `main` directly. This **foundation branch** (`feat/studigo-v2-phase4-animation-foundation`) was created from `main` and copied the LC knowledge-base content. Subsequent implementation task branches follow LC-DEC-005 and start from current `main`.

## Index (one line + retrieval keywords per doc)

| Doc | Summary | Keywords |
|---|---|---|
| [DECISIONS.md](DECISIONS.md) | Dated decision log: owner-approved / proposal / open, IDs LC-DEC-nnn | decision, approved, voice, outfits, mood meter, branch, stack |
| [SOURCES.md](SOURCES.md) | Authoritative sources with SHAs/URLs/licenses and a status per claim | source, citation, license, SHA, verified, assumption |
| [GLOSSARY.md](GLOSSARY.md) | Terms: LC, dock, strip, MouthDriver, CompanionRenderer, stall, beat | definition, term, jargon |
| [STACK.md](STACK.md) | Rive + Higgsfield + Claude Code + GitHub; who does what; layer-separation risk | Rive, Higgsfield, Claude Code, pipeline, layers |
| [INTEGRATION_MAP.md](INTEGRATION_MAP.md) | How LC plugs into current companion code on main (`056066fb2b13a0fe8a529bee74c630ea7c43e723`) | companion.tsx, engine.ts, renderer, prefs, flag, rollback |
| [REFERENCES_ANALYSIS.md](REFERENCES_ANALYSIS.md) | Muse, Dots, Pokémon GO, Grok companions, Coucou, REA, Avatar Lab, Limora with licenses | reference, inspiration, AGPL, Coucou, Avatar Lab |
| [STUDIGO_EXPRESSIVENESS_SPEC.md](STUDIGO_EXPRESSIVENESS_SPEC.md) | 14 expressions, 12 beats, gaze, idle, personality, springs, Calm mode | expression, emotion, gaze, head turn, idle, personality, Sonic, Frizzle, Pikachu, Krypto |
| [MOOD_METER.md](MOOD_METER.md) | Per-session in-memory mood meter; mistakes never lower it | mood, meter, session, decay |
| [SHARED_COMPANION_EVENTS.md](SHARED_COMPANION_EVENTS.md) | One event list shared with Guided Learn GL08, incl. `stall` | event, hit, miss, streak, stall, GL08 |
| [RECONCILIATION.md](RECONCILIATION.md) | Handoff artifact vs. expressiveness spec vs. current code | reconcile, conflict, handoff |
| [COUCOU_REA_BEHAVIOR_EXTRACTION.md](COUCOU_REA_BEHAVIOR_EXTRACTION.md) | Coucou open-source behavior numbers (springs, idle, dock) | Coucou, REA, spring, extraction |
| [assets/ASSET_MANIFEST.md](assets/ASSET_MANIFEST.md) | Assets, outfits, license rules | asset, outfit, license, art |
| [AGENT_RUNBOOK.md](AGENT_RUNBOOK.md) | Loop an agent follows until v1 is done | runbook, agent, workflow, stop conditions |
| [STATUS_2026-11-20.md](STATUS_2026-11-20.md) | Where the work stands per plan step, the renderer as built, Rive licence findings, the new video reference, remaining work split owner / Haiku | status, remaining, Rive, mesh rig, Haiku, video |
| [LOCAL_CONTINUATION_PROMPT.md](LOCAL_CONTINUATION_PROMPT.md) | Paste-ready prompt: sync the laptop, re-plan, then work through Haiku sessions at max effort | handoff, prompt, local, Haiku, orchestrator |
| [HAIKU_HANDOFF.md](HAIKU_HANDOFF.md) | Local repo groundwork, exact historical handoff ZIP upload, reference mirror | local, Haiku, setup, archive, SHA256, hydration |
| [manifests/reference-sources.json](manifests/reference-sources.json) | SHA-pinned code references, approved concept URLs and archive checksum | manifest, references, videos, Coucou, REA, provenance |
| [QA_RELEASE_ACCEPTANCE.md](QA_RELEASE_ACCEPTANCE.md) | QA rows V01-V08, UI01-UI10, L01-L07, A01-A09 and the release gate (restored from the historical handoff) | QA, acceptance, matrix, release gate, V02 |
| [evidence/LC-1.md](evidence/LC-1.md) | Laptop baseline, mesh-rig measurements and the LC-1 recommendation | baseline, measurements, frame time, recommendation |
| [evidence/rive-licensing-notes.md](evidence/rive-licensing-notes.md) | Rive plans, `.riv` export and licensing research (unverified items marked) | Rive, license, pricing, export, splash |
| [../../implementation/LIVING_COMPANION_V1_PLAN.md](../../implementation/LIVING_COMPANION_V1_PLAN.md) | Executable plan: definition of done, tasks LC-0..LC-10, estimates | plan, task, LC-0, LC-10, acceptance |

## Retrieval rules
1. Pick pages by keyword; each section is self-contained with a stable heading.
2. Cite IDs (`LC-DEC-nnn`, `LC-SRC-nnn`, task `LC-n`) in PRs and reports.
3. Claims tagged `assumption` or `open` in SOURCES.md must not be stated as fact.
4. Superseded: `implementation/PHASE4_LIVING_COMPANION_PLAN.md` and `design/phase4/` are historical; LC docs win on conflict.

## Phase 4 label and local groundwork (2026-11-14)

The owner may still call this the “Studigo v2 Phase 4 animation upgrade.” In this repository the current canonical track is **Living Companion (LC)** so it does not conflict with the engineering roadmap's Phase 4 reliability work. This main-based foundation branch is `feat/studigo-v2-phase4-animation-foundation`; follow the **LC** task IDs and the current LC v1 plan. The older October handoff ZIP and old phase4 plan are historical references.

Local intake and source hydration are documented in [HAIKU_HANDOFF.md](HAIKU_HANDOFF.md), [handoff/README.md](handoff/README.md), the pinned [manifest](manifests/reference-sources.json), and [scripts/living-companion/prepare_workspace.py](../../scripts/living-companion/prepare_workspace.py). This branch adds source docs and scripts only; **the original user-downloaded ZIP must still be copied, checksum-validated and committed by the local Haiku session**. Downloaded reference mirrors live under ignored `design/living-companion/workspace/`; no original mascot files, runtime implementation or production configuration are modified by the setup script.
