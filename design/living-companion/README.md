# Living Companion (LC) knowledge base

**Purpose:** retrieval-first source of truth for any LLM/agent working on Studigo's animated companion. Retrieve the relevant page(s) below, cite their stable IDs (e.g. `LC-DEC-004`), and verify live repo state before acting. Live code on `main` always beats these docs.

**Status:** PLANNED, NOT IMPLEMENTED. Track renamed from "Phase 4" to "Living Companion (LC)" because `docs/ROADMAP.md` Phase 4 means "Reliability, safety, cost" (LC-DEC-001).

**Branch note:** this research branch (`research/phase4-coucou-rea-behavior-spec`, PR #164) shares no git history with `main`. Implementation branches start from `main` (LC-DEC-005); cherry-pick or copy these docs, do not merge this branch.

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
| [../../implementation/LIVING_COMPANION_V1_PLAN.md](../../implementation/LIVING_COMPANION_V1_PLAN.md) | Executable plan: definition of done, tasks LC-0..LC-10, estimates | plan, task, LC-0, LC-10, acceptance |

## Retrieval rules
1. Pick pages by keyword; each section is self-contained with a stable heading.
2. Cite IDs (`LC-DEC-nnn`, `LC-SRC-nnn`, task `LC-n`) in PRs and reports.
3. Claims tagged `assumption` or `open` in SOURCES.md must not be stated as fact.
4. Superseded: `implementation/PHASE4_LIVING_COMPANION_PLAN.md` and `design/phase4/` are historical; LC docs win on conflict.
