# Local continuation prompt — Living Companion (LC)

Paste everything inside the fence below into Claude on the owner's laptop, started inside the existing Studigo checkout. It assumes [STATUS_2026-11-20.md](STATUS_2026-11-20.md) is on the branch (it will be, once Step 0 has pulled).

Design notes for the owner:
- The main session is the **orchestrator**. The bulk of the work is delegated to **Claude Haiku sub-sessions at max effort**, run in parallel where tasks are independent. "At max" is read as both: maximum effort per Haiku session, and as many parallel Haiku sessions as there are independent tasks (one worktree each). Change that line if you meant something narrower.
- Nothing merges to `main`. Every STOP line in the plan still stops the run.

```text
You are continuing the Living Companion (LC) animation upgrade for Studigo on my LOCAL laptop. You are the orchestrator. Delegate the bulk of the implementation to Claude Haiku sub-sessions, each running at MAX effort, in parallel wherever tasks are independent. You review everything they produce.

RULES THAT NEVER BEND
- Preserve all uncommitted local work. No `git reset --hard`, `git clean`, force push, or sweeping stash.
- Never merge to `main`, deploy, or enable a production flag. Draft PRs only.
- The companion never writes mastery, grades, progress or evidence. No camera, mic or pointer logging.
- Phase 3 header geometry (desktop 100% -> 60% tuck) and the rail do not change.
- `NEXT_PUBLIC_STUDIGO_COMPANION=off` and the WebP sprite renderer must keep working.
- Never commit: MP4s, `design/living-companion/workspace/`, secrets, private student content, third-party character art.
- Do not invent a new overview document (AGENTS.md). Update the existing plan, DECISIONS.md and evidence files.
- If current code contradicts the docs, current code wins. Stop and report.
- Never claim a check passed unless it ran. Record numbers with the device or test that produced them.

STEP 0 — UPDATE THIS LAPTOP TO THE LATEST (do this before anything else)
1. Find the existing Studigo repo with `git remote -v`. Do not clone a second copy. Record `git status --short --branch` and the current commit.
2. If the working tree is dirty, do not discard it. Use a git worktree for the branch below instead of switching.
3. `git fetch --all --prune`
4. Get onto the branch: `git switch claude/studigo-living-companion-upgrade-ee0706` (use `--track origin/...` if it does not exist locally), then `git pull --ff-only`. If that fails because of divergence, STOP and show me `git log --oneline --left-right HEAD...origin/claude/studigo-living-companion-upgrade-ee0706`.
5. Report how far the branch is from `origin/main`: `git rev-list --left-right --count origin/main...HEAD` and `git log --oneline HEAD..origin/main | head -30`. Do NOT merge main. If main has moved, list what changed in `apps/web/components/companion/`, `apps/web/lib/companion-*`, `mode-header.tsx` and the room header, and flag conflicts for me.
6. Confirm the files below exist; if one is missing, say so: `design/living-companion/STATUS_2026-11-20.md`, `design/living-companion/LOCAL_CONTINUATION_PROMPT.md`, `implementation/LIVING_COMPANION_V1_PLAN.md`, `apps/web/components/companion/rig-renderer.ts`, `apps/web/lib/companion-motion/director.ts`.
7. Update tooling to what the repo expects: Node per `.nvmrc`, `pnpm` per `package.json` (`packageManager`), then `pnpm install --frozen-lockfile`. Run `rive doctor` if the Rive CLI is installed and record the result (do not install or sign in to anything else).
8. Baseline, from the repo root, each with its exit code: `pnpm --filter @studigo/web typecheck`, `pnpm --filter @studigo/web lint`, the LC unit tests from `apps/web` (see STATUS section 6), `pnpm --filter @studigo/web build`. The known unrelated failure is `C19 ... pymupdf`; note it and move on.
9. Save these results to `design/living-companion/evidence/LC-1.md` under "Baseline on laptop <date>". Commit and push (fetch and merge first; another contributor, aws-dev-wgl, also commits to this branch).

STEP 1 — READ, IN THIS ORDER, AND NOTHING ELSE BY DEFAULT
AGENTS.md -> ENGINEERING.md -> design/living-companion/STATUS_2026-11-20.md -> implementation/LIVING_COMPANION_V1_PLAN.md -> design/living-companion/DECISIONS.md -> design/living-companion/STUDIGO_EXPRESSIVENESS_SPEC.md -> design/living-companion/INTEGRATION_MAP.md -> design/living-companion/evidence/*. Then only the code a task needs. Do not scan the whole repo.

STEP 2 — WRITE THE UPDATED PLAN
Using the baseline from Step 0 and STATUS sections 1, 5 and 6, update the "Start here" section of `implementation/LIVING_COMPANION_V1_PLAN.md`: mark each step done / partial / open with commit SHAs, and list the remaining steps in the order they will run, each with: owner (you, Haiku, or me), branch name, files allowed to change, a "done when" line, and the evidence entry. Mark anything needing me as STOP. Show me the plan in your reply, commit it, then continue immediately with every task that is not blocked.

STEP 3 — EXECUTE WITH HAIKU
Orchestration protocol:
- Create one git worktree and one branch per task: `lc/<step>-<slug>`, branched from `claude/studigo-living-companion-upgrade-ee0706`.
- Give each Haiku session a single task card: the goal, the exact files it may touch, the invariants above, the commands to run, the "done when" line, the evidence file to write, and "stop and report if anything is unclear or contradicts the code". Run Haiku at max effort. Run independent tasks in parallel; run tasks that touch the same files one at a time.
- When a Haiku session finishes, YOU review its diff against the invariants and its evidence honestly (did the checks actually run?). Reject or fix anything that fails. Only then merge its branch into `claude/studigo-living-companion-upgrade-ee0706` with `--no-ff`, re-run the LC tests, and push (fetch and merge first; never force-push).
- Do the judgement-heavy work yourself, not in Haiku: reviewing diffs, motion-feel decisions, anything touching the dragon's identity, reading Rive's terms, resolving merge conflicts.

Task cards for Haiku (from STATUS section 5; skip any already done on the branch):
 H-A  LC-1 measurements on the WebGL mesh rig: frame time, blend time (target <= 200 ms), bundle size, WebGL-failure fallback to sprites. Write a go/no-go RECOMMENDATION in evidence/LC-1.md. Physical-device rows stay `OPEN (human)`.
 H-B  Step 17 audit and wiring: table of which shared events (SHARED_COMPANION_EVENTS.md) are emitted, by what, and which are missing. Add the missing ones, including `stall` with placeholder thresholds L1 20-45 s and L2 = 2x. Add tests. Do not change learning logic.
 H-C  Playwright specs for UI01-UI10, L01-L07, A01-A09 (desktop plus emulated phone), using fixtures such as `/dev/study` and `/dev/home`. Visual V rows produce screenshots for me. Record pass/fail honestly.
 H-D  Calm mode and prefers-reduced-motion checks (A02 and related).
 H-E  Outfit tests and per-outfit frame-time delta. Do not judge the art.
 H-F  Rollback rehearsal: motion flag off -> sprites return; companion off -> he is gone. Evidence in `evidence/LC-9.md`.
 H-G  Docs hygiene: add a PROPOSAL row to DECISIONS.md recording that the mesh rig is the de-facto renderer and Rive is undecided (needs my approval); update the README index and status line; fill step SHAs in the plan.

STEP 4 — STOP AND ASK ME (do not guess; batch these into one message)
H1 expression and beat approval; H5 signed-in screenshots at 375/390/768/1024/1440; H6 production flag names; the renderer decision (mesh rig vs Rive vs both); the Rive `.riv` commercial-terms check; outfit art approvals; stall thresholds from real data; identity and "feels alive" sign-off; opening the draft PR to main; voice narration.

STEP 5 — REPORT
When you stop: what ran and what passed (with exit codes), what failed, what is `OPEN`, the branch SHA you pushed, and the exact questions for me. Open the draft PR to `main` only after I say so. Be honest about anything unverified.
```
