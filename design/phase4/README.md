# Studigo v2 Phase 4 — Companion Animation Foundation

**Scope:** a documentation/reference-only setup for the owner-approved animation upgrade. It changes no application runtime code, migrations or production settings.

## Owner-approved UX contract

Studigo is one original, wingless orange dragon with two mutually exclusive Study Room homes:

1. A user-repositionable **floating dock**; its entire window (including the dragon) moves and persists a safe position, while the dragon independently animates inside.
2. A **fixed companion** at the right of the strip **between the navigation row and the colored divider**. The strip and divider do not follow content scrolling. Maintain existing Phase 3 tuck/expand geometry and iPhone composer space.

The same motion director supplies gaze, blinking, head tilt, paw gestures, tiny breathing, frill/tail follow-through and learning-context reactions in both locations. Do not generate new wings or change Studigo's canonical character identity.

## Source of truth and ordering

- [Full execution plan](../../implementation/PHASE4_LIVING_COMPANION_PLAN.md)
- [Coucou/REA source analysis](COUCOU_REA_BEHAVIOR_EXTRACTION.md)
- [Haiku setup and handoff](HAIKU_HANDOFF.md)
- [Pinned source+asset manifest](manifests/reference-sources.json)
- [Original conversation archive intake](context/README.md)
- [Root engineering rules](../../AGENTS.md), [live architecture](../../ENGINEERING.md)
- [Old companion parity contract](../../docs/COMPANION_PARITY_PLAN.md)

**Concept footage is direction, not proof of code execution.** Current branch and working main must be compared and verified before any application edits. Phase 4 PR #164 may still exist as draft; do not assume it was merged.

## Tracked foundation vs local hydrated workspace

```text
Studigo-ai/
├─ implementation/PHASE4_LIVING_COMPANION_PLAN.md    (tracked)
├─ design/phase4/
│  ├─ README.md, HAIKU_HANDOFF.md, .gitignore         (tracked)
│  ├─ COUCOU_REA_BEHAVIOR_EXTRACTION.md               (tracked)
│  ├─ manifests/reference-sources.json                (tracked)
│  ├─ context/
│  │  ├─ README.md                                    (tracked)
│  │  └─ Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip  (to be added by Haiku)
│  └─ workspace/                                      (gitignored, created locally)
│     ├─ context/unpacked/Studigo_v2_Phase4_Grok_Handoff/
│     ├─ references/studigo/<original-repo-paths>
│     ├─ references/coucou/<original-repo-paths>
│     ├─ references/rea/<original-repo-paths>
│     ├─ references/approved-concept-videos/URLS.json
│     ├─ rig-prototypes/
│     └─ evidence/reference-hydration.json
└─ scripts/phase4/prepare_workspace.py                (tracked)
```

The mirror deliberately preserves original source path hierarchy under each reference project; **reference files are read-only**, not duplicated application owners. No full 1,000+ file clone of Coucou or REA; only selected code/docs.

## One local setup command

After `git fetch origin` and checking out `feat/studigo-v2-phase4-animation-foundation`, save the context ZIP from ChatGPT to Downloads, then:

```powershell
py -3 scripts/phase4/prepare_workspace.py --archive "$HOME/Downloads/Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip"
```

On macOS/Linux, use `python3` and your actual archive path. The command checks the exact SHA-256, copies the ZIP into the tracked `context/` folder, safely unpacks it into the ignored `workspace/context/unpacked/`, mirrors local canonical Studigo files and downloads pinned Coucou/REA source references. The nested REA evidence ZIP stays compressed by default. To download the three concept MP4s as well, add `--videos` after checking disk space; they are optional and their manifest URLs are always preserved.

**The archive is not yet uploaded by this remote foundation commit.** The GitHub interface that created these source files cannot upload local binary bytes. On the local computer, Haiku must commit/push the verified archive to the same branch. Never claim this step succeeded without reading the remote file and confirming its hash.

## First deliverable, not implementation

1. Proven archive SHA-256 (see manifest); extracted 13 handoff files + nested evidence archive retained.
2. Hydrated selected source references with local SHA-256 ledger and file paths.
3. A local source/asset inventory listing usable and missing 2D dragon rig layers; no generation unless necessary.
4. Branch/working-tree status and a small commit containing the verified original ZIP, plus any genuinely necessary manifest improvements.
5. No edits to Coach, Learn, grading, database, production, or companion runtime in this first groundwork pass.
