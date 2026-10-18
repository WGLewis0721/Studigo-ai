# Studigo — golden production baseline before V5/V6 closure (2026-10-18)

**Release policy:** This is a frozen source/deployment rollback anchor, not a new runtime design. Do not mutate the golden branch, reset main, or assume a code rollback restores Supabase data.

## Recovery anchors — verified before development

| Item | Frozen identity |
|---|---|
| Repository | `WGLewis0721/Studigo-ai` |
| Exact source/production SHA | [`daeaa67f32db2e981595515f62f9ed4b6487bbcc`](https://github.com/WGLewis0721/Studigo-ai/commit/daeaa67f32db2e981595515f62f9ed4b6487bbcc) |
| Immutable source branch | [`golden/pre-v5-v6-2026-10-18-daeaa67`](https://github.com/WGLewis0721/Studigo-ai/tree/golden/pre-v5-v6-2026-10-18-daeaa67) |
| Immutable Vercel deployment | `dpl_AcPtnhTyyYoSjWVJvn3NEFbrZnkb` |
| Deployment address | https://studigo-mv6kuofzc-gray-matter5.vercel.app |
| Production alias | https://studigo-ai.vercel.app |
| Deployment observation | `READY`; production alias and source SHA matched on 2026-10-18 before taking the snapshot |
| Previous V0 golden | `golden/pre-v1-2026-10-17-726b1e7` and `dpl_aw3c2RDmDPkQYWZcsR28e8RC8Wdn`; **do not delete** |

The new baseline includes the owner-approved three-second Show-only drawer, left companion-style glowing tab, Coach/Practice idle-timer fix, Progress companion summon fix, readable Materials/Explore source passages, and current Home presentation (through PR #249). This is the **pre-V5/V6 closing state**, not evidence that V5/V6 acceptance is complete.

## Visual evidence and honest limits

- The gated `phase3-visual-evidence` workflow checks out this exact golden content (docs/CI PR only; no runtime changes) and captures four synthetic real-component Study Rooms at 320, 390, 820 and 1440 CSS pixels. It also includes Coach, Practice, Progress, Materials, Plan, Learn/Explore, first-run, drawer and companion interaction checks, using synthetic test content.
- `scripts/capture-golden-2026-10-18-public.mjs` separately takes eight screenshots of the **immutable Ready production deployment**: actual public Home and /signup at 320×720, 390×844, 820×1180 and 1440×900. The manifest records production SHA, deployment ID, route, status and filename; each context is anonymous.
- Artifacts are retained by GitHub Actions for 90 days, not indefinitely. Archive separately before expiry. No private learner files, authenticated rooms or real student outcomes are captured.
- **Screenshot verification (passed):** [Phase 3 golden capture workflow #39126602974](https://github.com/WGLewis0721/Studigo-ai/actions/runs/39126602974) completed successfully on the frozen source tree. Its uploaded `phase3-visual-evidence` artifact is **12135449939**, 57,775,086 bytes, retained through **2027-01-16**. Both the synthetic Study Room screenshot matrix and the immutable real-public Home/signup capture steps finished with success. The actual public-page manifest and PNGs are inside the artifact. These are not authenticated-room captures.

## Safe recovery

1. Stop merges on a critical break, note failing route/device and post-change production SHA; do not delete real learner state.
2. Verify `dpl_AcPtnhTyyYoSjWVJvn3NEFbrZnkb` is still `READY` and the original `daeaa67` source SHA matches.
3. Use the supported Vercel **production rollback/promote** operation to move only the Studigo production alias to that immutable deployment. No direct database or account reset.
4. Verify alias, public Home and signup and a real, authorized disposable signed-in Study Room; recheck auth, uploaded source, cited Learn/Explore, Coach, Progress and Materials.
5. If a source revert is needed, use a targeted PR or the frozen branch as reference; never force-reset `main`. Compare current DB schema to this code; rollback cannot revert migrations or reconstruct uploaded data.
6. Record incident, rollback deployment and checks. **No production rollback was exercised during the freeze**, since intentionally reverting healthy production would disrupt users.

## Gate to begin V5/V6

- [x] GitHub branch pinned at the exact observed production SHA
- [x] Vercel Ready deployment matches branch and production alias
- [x] Four-width synthetic and actual public production screenshot artifacts successfully uploaded (run #39126602974; artifact #12135449939)
- [x] Freeze [PR #250](https://github.com/WGLewis0721/Studigo-ai/pull/250) merged without changing runtime at `69c7038a58b75c62d7353272cc76007ebd9c1e6a`
- [ ] V5/V6 implementation branches begin only after the evidence is green
