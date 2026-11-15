# GitHub and local reference workspace

> **Repository revision, 2026-11-15:** the archive pin now points at `Studigo_Living_Companion_Human_First_Context_2026-11-14.zip` (SHA-256 `34c5c99b3d045504c5d487b277721abe85eb3174baa34fe44aa160052bbbc4b4`), per the owner's instruction. The archive itself is unchanged. The source of truth for pins is `design/living-companion/manifests/reference-sources.json`.

## The repository

**Repo:** https://github.com/WGLewis0721/Studigo-ai

**Remote foundation branch:** `feat/studigo-v2-phase4-animation-foundation` (verified at `4f3f63d38f98b068a9dbba9194003fbda4ab246b` during this November 14 handoff). This branch was created from main and contains the current Living Companion reference docs plus a setup script. It is a **setup/research branch**, not the deployed animation upgrade. Confirm today's Git state before relying on any SHA.

**Canonical LC docs:** `design/living-companion/` and `implementation/LIVING_COMPANION_V1_PLAN.md`.

**Earlier research PR:** https://github.com/WGLewis0721/Studigo-ai/pull/164 — historically useful, still draft in the last live check; its commit history is not a safe direct merge base. Its old `design/phase4` and `implementation/PHASE4_LIVING_COMPANION_PLAN.md` are superseded.

**Phase 3:** completion PR #197 and stacked Materials fix #200 were merged by October 25. The four-width visual evidence PR #196 was still open/draft in the last checked snapshot. Recheck rather than treating prior status as permanent.

## Local workspace, in human terms

The groundwork branch includes `scripts/living-companion/prepare_workspace.py`. It is intended to make a **small and reproducible local reference library** without cloning huge repositories or modifying the product.

It expects the **pinned context archive** with this exact filename and hash:

- `Studigo_Living_Companion_Human_First_Context_2026-11-14.zip`
- SHA-256: `34c5c99b3d045504c5d487b277721abe85eb3174baa34fe44aa160052bbbc4b4`
- Size: `5,805,718` bytes.

Use the archive as delivered. Do not unpack or rename it. The original 2026-10-25 handoff is nested inside, byte-identical, at `historical/ORIGINAL_2026-10-25_HANDOFF.zip` (SHA-256 `6408d7a7bd5a24bebc5fdfe04447b91392e7b97a47d9675bba90f1d2a8a040b0`). The superseded pin is kept in the manifest for provenance only.

Example commands after safely switching to the existing foundation branch, from the Studigo repo root:

Windows PowerShell:

    py -3 scripts/living-companion/prepare_workspace.py --archive "$HOME/Downloads/Studigo_Living_Companion_Human_First_Context_2026-11-14.zip"

macOS/Linux:

    python3 scripts/living-companion/prepare_workspace.py --archive "$HOME/Downloads/Studigo_Living_Companion_Human_First_Context_2026-11-14.zip"

Review the script before executing it. It verifies the pinned archive, safely unpacks the top-level context, mirrors selected current Studigo files and downloads pinned, allowlisted Coucou/REA source references. It keeps the nested huge REA evidence compressed by default. It stages the archive in `design/living-companion/handoff/`. The archive is committed on the foundation branch. Any later change to it is a separate, explicit action.

### Where reference files live locally

    Studigo-ai/
      implementation/LIVING_COMPANION_V1_PLAN.md       [tracked]
      design/living-companion/                          [tracked LC documentation]
        handoff/                                        [pinned context archive goes here]
        manifests/reference-sources.json              [pinned source list]
        workspace/                                      [ignored, local-only]
          context/unpacked/                             [historical conversation text]
          references/studigo/...                        [copy of selected local source]
          references/coucou/...                         [pinned open-source technical reference]
          references/rea/...                            [REA usage/research reference]
          references/approved-concept-videos/URLS.json
          evidence/reference-hydration.json
          rig-prototypes/
      scripts/living-companion/prepare_workspace.py     [tracked]

## Source safety

- The hydrated reference mirror is not a second source-of-truth copy of the app.
- Only commit the pinned archive after validating its checksum, confirming the repository is intended to hold it and reviewing it for sensitive material.
- Do not commit the ignored workspace, private student content, Mochi artwork or audio, unapproved generated assets, or large tool caches.
- A clean local clone/worktree is preferable to overwriting an existing dirty checkout. Never use destructive Git resets or blanket clean commands.
- Separate real implementation work later into LC task branches off current main, with PRs and explicit test evidence.
