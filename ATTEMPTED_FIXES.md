# Attempted Fixes — Coach "Give me N questions"

Chronological log of changes made while diagnosing the coach narration bug
described in [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md). Each entry records
what was changed, why, and what it proved or ruled out. Keep this updated as the
investigation continues — it is the audit trail, not marketing copy.

## 1. Recommendation engine with explicit intent routing

- **Change:** Added `apps/web/lib/recommendation-engine.ts` — a single decision
  layer that classifies the learner message (grounded question vs. request to
  generate a practice set), selects topics, calls grounded generation, formats,
  and assembles citations as one pipeline. Wired into `apps/web/lib/engine.ts`.
- **Why:** Root causes 1 and 2 — the coach never recognized "give me N
  questions" as a generation intent, and there was no orchestrator.
- **Result:** The coach now routes a practice request into generation instead of
  the narration/refusal path. This is the primary fix for the reported symptom.

## 2. Fixture engine + account-free coach test surface

- **Change:** Added `apps/web/lib/fixture-engine.ts`,
  `apps/web/lib/fixture-materials.ts`, `apps/web/app/api/dev/coach/route.ts`,
  and the `/dev/study` page. Later removed the `development`-only `notFound()`
  guard so the fixture coach is reachable on the deployed site for testing
  without an account or Supabase.
- **Why:** The real coach lives inside a Study Room (Supabase + account). A
  synthetic, RLS-free surface was needed to exercise the shared engine over
  known chunks and reproduce the bug deterministically.
- **Result:** Reproduced the bug and then confirmed the intent-routing fix on a
  path with no account/Supabase dependency.

## 3. Distinct-question fixtures + dedup verification

- **Change:** Updated `apps/web/lib/recommendation-engine.test.ts` so the
  "unique material" tests generate genuinely distinct questions, and added an
  end-to-end pipeline test (intent → topic selection → generation → formatting
  → citations). 25 tests total.
- **Why:** Root cause 3 — earlier fixtures differed only by an index number, so
  near-duplicate collapse made "10 questions" return fewer. That was a fixture
  defect, not a dedup defect.
- **Result:** Full web suite green (52 tests) and stable across 10 consecutive
  runs, per the standing "pass 10× in a row" requirement.

## 4. AI Gateway fallback in the model client

- **Change:** `packages/ai/src/client.ts` now uses the direct OpenAI path
  byte-for-byte when `OPENAI_API_KEY` is present, and falls back to the Vercel
  AI Gateway OpenAI-compatible endpoint only when the raw key is absent.
- **Why:** Root cause 4 — the sandbox dev server could not see
  `OPENAI_API_KEY`, so generation failed with "not configured".
- **Result:** Additive and production-safe (deploy path unchanged). In the
  sandbox it surfaced a `403 AI Gateway requires a credit card`, which is a
  **team billing limitation**, not a code defect. It also proved the request now
  reaches the model transport / generation step rather than narrating.

## 5. Login gate removed for open testing

- **Change:** `middleware.ts` `PROTECTED_PREFIXES` emptied; `requireUser()` in
  `apps/web/lib/auth.ts` returns a read-only **guest identity** instead of
  redirecting to `/login`; `apps/web/lib/rooms.ts` `listRooms()` degrades
  gracefully to an empty list when Supabase env is unavailable.
- **Why:** Let a tester open `/app` and the coach without creating an account.
- **Result:** `/app` renders a read-only guest shell (footer shows
  `guest@studigo.local`). Write APIs stay protected (401) because they are
  RLS-scoped to a signed-in user. **This is a TEMP testing bypass and must be
  reverted before launch.**

## Known limitations / open items

- **Sandbox model transport.** Real generation cannot be fully verified inside
  the v0 preview sandbox (env injection + AI Gateway billing). It must be
  verified on the deployed Vercel app, where `OPENAI_API_KEY` is present.
- **Guest bypass is temporary.** Items 5 above weaken auth for testing only.
  Restore the login gate (`PROTECTED_PREFIXES`, `requireUser()` redirect) and
  re-guard the fixture surfaces before beta.
- **Fixture coach is a test surface**, not a product feature. It should not ship
  as a learner-facing entry point.

## Reversion checklist (before launch)

- [ ] Restore `PROTECTED_PREFIXES = ["/app"]` in `middleware.ts`.
- [ ] Restore the redirect-to-`/login` behavior in `requireUser()`.
- [ ] Re-add the `development`-only guard on `/dev/study` and `/api/dev/coach`
      (or remove those surfaces entirely).
- [ ] Confirm the AI Gateway fallback in `packages/ai/src/client.ts` is desired
      long-term, or gate it to non-production.
