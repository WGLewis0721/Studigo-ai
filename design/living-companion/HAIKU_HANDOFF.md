# Haiku Handoff — Studigo Living Companion (LC) Animation Groundwork

You are Claude Haiku operating on the owner's LOCAL laptop and existing Studigo repository. Execute the setup autonomously, minimize user interaction, preserve every working feature, and STOP before implementing the new animation engine. Your job is **remote/local foundation + verified archive upload + local reference hydration + source audit**.

## Existing remote resources

Repo: https://github.com/WGLewis0721/Studigo-ai
Remote branch ALREADY CREATED: feat/studigo-v2-phase4-animation-foundation
Created from main SHA 056066fb2b13a0fe8a529bee74c630ea7c43e723 (verify today's HEAD).
Other research: WGLewis0721/coucou and WGLewis0721/rea.
Existing planning PR #164 is separate and may still be draft; DO NOT merge it to main.

Committed to your target branch already:
- implementation/LIVING_COMPANION_V1_PLAN.md
- design/living-companion/COUCOU_REA_BEHAVIOR_EXTRACTION.md
- design/living-companion/README.md and the canonical LC knowledge-base files: DECISIONS, SOURCES, STACK, INTEGRATION_MAP, STUDIGO_EXPRESSIVENESS_SPEC, MOOD_METER, SHARED_COMPANION_EVENTS, RECONCILIATION, AGENT_RUNBOOK and asset manifest
- design/living-companion/handoff/README.md
- design/living-companion/manifests/reference-sources.json
- design/living-companion/.gitignore
- scripts/living-companion/prepare_workspace.py

READ root AGENTS.md, ENGINEERING.md, the canonical LC README/DECISIONS and the current LC v1 plan first. The old October 16 Phase 4 plan inside the historical ZIP is SUPERSEDED: do not use it as active implementation authority. The product owner subsequently approved 14 expressions, 12 beats, an in-memory mood meter, seven school-subject outfits, a Rive-vs-Canvas feasibility bake-off, and a later provider-agnostic MouthDriver/voice path. See LC-DEC IDs and LC-0..LC-10; nothing has shipped merely because it is planned. ROADMAP already uses Phase 4 for Reliability/Safety/Cost, so treat this as LC groundwork while preserving the user's original label as a historical reference. Current code/real tests are authoritative over dated assumptions.

## Mission A — Safely locate and mirror the remote branch on local

1. Discover the existing local Studigo repo by git remote -v; don't clone a second copy by default.
2. Record git status --short --branch and current commit. Preserve uncommitted work. No reset --hard, git clean, force push, or sweeping stash.
3. Fetch the remote branch. Use git switch --track origin/feat/studigo-v2-phase4-animation-foundation if absent locally, or git switch then git pull --ff-only if present. If switching would disturb other local changes, create a lightweight git worktree anchored to this same repo rather than destroying the existing work.
4. Confirm the checked-out branch is feat/studigo-v2-phase4-animation-foundation; verify all above files are present. Compare against origin/main, and record what has changed since the Phase 3 release.
5. Use the already committed scaffold and manifest. Do not invent a second folder structure or duplicate roadmap.

## Mission B — Copy, checksum, unzip, and PUSH the original ZIP to GitHub

Required exact archive filename: Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip
Expected bytes: 5775271
Expected SHA256: 6408d7a7bd5a24bebc5fdfe04447b91392e7b97a47d9675bba90f1d2a8a040b0
Destination INSIDE REPO: design/living-companion/handoff/Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip

1. Look for this downloaded file only in Downloads, Desktop or an explicitly supplied path. The ChatGPT sandbox path is NOT directly readable from the laptop. If absent, request this one file/path and complete other independent tasks.
2. Do not trust a similarly named archive whose SHA256 differs. Inspect the checked-in setup script first. Run it from repo root:

Windows PowerShell:
    py -3 scripts/living-companion/prepare_workspace.py --archive "$HOME/Downloads/Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip"

macOS/Linux:
    python3 scripts/living-companion/prepare_workspace.py --archive "$HOME/Downloads/Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip"

Adjust the archive path. This script uses the Python standard library only. It checks archive integrity and path traversal, copies the original ZIP into the tracked context folder, extracts top-level handoff into ignored workspace/context/unpacked, mirrors curated local Studigo code/art/docs, downloads SHA-pinned Coucou/REA code references and writes a manifest with file hashes.
3. The nested REA machine evidence ZIP stays compressed to save disk. Do not execute scripts from inside the imported archive.
4. Inspect design/living-companion/workspace/evidence/reference-hydration.json. If downloads failed, report exact failures, repair only necessary small steps; rerun using --offline if network unavailable but DO NOT claim hydration complete.
5. Stage only the exact ZIP and necessary setup corrections. The entire design/living-companion/workspace/ is ignored. Verify Git's diff does not include private student content, third-party character artwork, large caches or unintended runtime files.
6. Commit and push to origin/feat/studigo-v2-phase4-animation-foundation with a clear message such as docs(lc): add verified context ZIP.
7. VERIFY THE REMOTE BINARY FILE WAS PUSHED. Confirm GitHub branch path and local remote blob content/sha. If not actually pushed, explicitly report ZIP not yet on remote. Do not claim upload merely from local copy.

## Mission C — Populate the local reference folder structure

The committed script creates the following only-local hierarchy (do not commit it):

design/living-companion/workspace/
    context/unpacked/Studigo_v2_Phase4_Grok_Handoff/
    references/studigo/<original Studigo relative paths>
    references/coucou/<pinned Coucou code relative paths>
    references/rea/<pinned REA reference relative paths>
    references/approved-concept-videos/URLS.json
    rig-prototypes/
    evidence/reference-hydration.json

Hydrate the specific source file list and pinned SHAs in design/living-companion/manifests/reference-sources.json. Copy Studigo mascot reference sheets, companion sprites, current engine and tests, the Phase 3 frame/strip and approved plans from the CURRENT LOCAL REPO; do not treat mirrored copies as source of truth. Fetch only approved Coucou animation logic (engine, spring/easing, state machine, greeting choreography, Swift timeline, licenses), not the full repo or Mochi art, audio or branded character assets. Fetch REA usage docs, not an entire second clone. The REA machine-data ZIP is already inside the source archive.

Preserve the 3 approved concept videos by their original URLs in the manifest. Download them ONLY if space and URLs permit by rerunning the preparation script with --videos; note any failed URLs. The user prefers minimal storage and the original REA archive is sufficient without expanding a second copy.

## Mission D — Build a grounded readiness inventory, NOT the animation upgrade

Inspect current app files: apps/web/components/companion/{engine.ts,companion.tsx,companion.css,stage.tsx}, apps/web/components/room/{workspace.tsx,mode-header.tsx}, apps/web/lib/{companion-logic.ts,companion-prefs.ts,companion-logic.test.ts}. Summarize existing owners, preferences, pointer/drag/resize/docking, lifecycle, and event contract.

Inspect canonical art and identify what's reusable for a rig and what's missing: independent eyes/pupils/lids, head, face, ivory frills, forearms/paws, vest, body, crayon tail/flame and 2-3 view pivots. The dragon is WINGLESS; no new wings.

Record the owner's approved TWO modes: (1) floating framed dock that can be repositioned as one unit and stays safe around controls; (2) fixed dragon inside the header strip between nav bar and colored divider with restrained life and Phase 3 100%→60% tuck/expand preserved. ONE shared companion, no duplicate runtime.

Write ONLY a focused design/living-companion/FOUNDATION_AUDIT.md with verified code paths, source hashes, existing/pending assets, risk matrix and smallest next LC-0 / LC-1 groundwork slice. Do not write a competing implementation plan.

NO actual changes to companion runtime, UI, styling, business logic, grades, RLS, uploads, CI or production. No install of heavy animation tools or generation of arbitrary new mascot images. Do not open a PR or merge to main unless asked. Existing Phase 3 tests and signed-in evidence still need verification before UI integration. LC-1 renderer identity and Rive-vs-Canvas approval require William's explicit sign-off; do not implement before authorization.

## Final acceptance / report format

Report:
- Remote branch and exact pushed commit SHA
- Local repo/worktree path, branch and status
- ZIP uploaded to remote? YES/NO with SHA256, byte size, and verified GitHub path
- ZIP unpacked locally? YES/NO, source integrity
- Number of hydrated Studigo/Coucou/REA files and any failures
- Whether concept MP4s were actually downloaded or just URL-indexed
- Tracked vs ignored folder status, no third-party protected art, no app runtime edits
- New FOUNDATION_AUDIT.md link or exact path
- Tests/validation actually run and any remaining blockers

Keep the work reversible, lean, evidence-driven and loyal to Studigo's approved character identity and Phase 3 geometry. The goal here is to prepare the foundation without changing the site.
