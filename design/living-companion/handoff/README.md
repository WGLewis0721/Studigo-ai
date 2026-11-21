# Living Companion — Incoming conversation context archive

**Pinned context archive (human-first package, dated 2026-11-14):**
- Filename: `Studigo_Living_Companion_Human_First_Context_2026-11-14.zip`
- Expected size: `5,805,718` bytes
- SHA-256: `34c5c99b3d045504c5d487b277721abe85eb3174baa34fe44aa160052bbbc4b4`
- Repository destination: `design/living-companion/handoff/Studigo_Living_Companion_Human_First_Context_2026-11-14.zip`

It supersedes the earlier pin for `Studigo_v2_Phase4_Full_Chat_Context_for_Grok.zip` (SHA-256 `6408d7a7bd5a24bebc5fdfe04447b91392e7b97a47d9675bba90f1d2a8a040b0`, 5,775,271 bytes). That original is kept byte-identical inside this package at `historical/ORIGINAL_2026-10-25_HANDOFF.zip`.

The package is a reconstructed, tool-agnostic handoff, not a verbatim transcript. Its October 16 Phase 4 roadmap is historical. After October 25, the active plan and design authority live in `implementation/LIVING_COMPANION_V1_PLAN.md` and `design/living-companion/`.

`scripts/living-companion/prepare_workspace.py` validates the archive, copies it into this folder, and extracts its top-level contents under the ignored `design/living-companion/workspace/context/unpacked/`. The nested REA evidence stays ZIP-compressed. No commands or scripts from the archive are executed.
