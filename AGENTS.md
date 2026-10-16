# AGENTS.md

Studigo is an AI study companion grounded in a learner's own class materials. Probabilistic AI handles retrieval, explanation, question generation, and semantic interpretation. Deterministic software owns authorization, source scope, progression, learning evidence, retries, and durable state.

This file is the shared entry point for Cursor, Claude Code, Codex, Copilot, and other coding agents. `CLAUDE.md`, `.cursor/rules/studigo.mdc`, and `.github/copilot-instructions.md` only point here. Do not copy this guide into those files.

## Before coding

1. Read this file.
2. Read `ENGINEERING.md` for the live map, the authority boundary, and which file owns a change.
3. Open one specialist document from `docs/README.md` only when the task needs it.
4. Read the tests beside the code you change.
5. Skip `docs/archive/`, prototype art, frozen game builds, and the rest of the tree until a targeted file shows a dependency.

## Live product

| Path | Role |
| --- | --- |
| `apps/web` | Live Next.js 16 / React 19 app. Vercel root directory is `apps/web`. UI in `app/` and `components/`, server logic in `lib/`, route handlers in `app/api/`. |
| `packages/ai` | Live provider boundary. The only place that may import the OpenAI SDK. |
| `packages/documents` | Live upload policy, extraction, and chunking. No network and no model SDK. |
| `packages/learning` | Live production progression, challenge, and scaffold policy. |
| `packages/mastery` | Advisory BKT, Elo, and scheduler. A probability from here is not an evidence stage and is not the production mastery write. |
| `supabase/migrations` | Live schema, RLS, pgvector, and RPCs. |
| `evals/` | Offline checks. A green run is not a reviewed live scorecard. |
| `knowledge/teaching-coaching` | Internal coaching library. Learners do not pick these as settings. |
| `implementation/ENGINEERING_PLAN.md` | Broader engineering backlog. |
| `implementation/security-readiness/` | Public-launch gate. It is not ready. |

## Parked or separate

| Path | Role |
| --- | --- |
| `apps/desktop` | Tauri scaffold. Bundling is disabled. There is no shipped desktop app. |
| `services/retrieval` | Local Python FAISS experiment. Unauthenticated. 384-dimension vectors. Production retrieval is Postgres `match_study_chunks` (1536 dimensions). |
| `prototypes/moon-road` | Separate Moon Keep / Core Clash game. Golden route is POC XI under `dist/poc-xi/`. Frozen routes stay frozen. |
| `design/` | Homepage, companion, and launch-film experiments. The product UI is `apps/web`. |
| `supabase/functions` | Reserved worker contract. Ingestion still runs inside the web request. |
| `docs/APP_STORE_RELEASE_PLAN.md` | Chosen future iOS path. No Expo app is in this repo. |
| `assets/` | Voice and cursor art. |

## Commands

Prerequisites: Node 22 (`.nvmrc`, `engines.node` is `22.x`) and pnpm 10 (`packageManager` is `pnpm@10.0.0`). Enable Corepack if `pnpm` is missing: `corepack enable && corepack prepare pnpm@10.0.0 --activate`.

```bash
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
pnpm dev
```

`pnpm dev` starts Next.js at `http://localhost:3000`. The homepage renders with empty keys. Study rooms, ingestion, and model calls need the variables in `.env.example`.

Next.js loads `.env*` from `apps/web` only. A root `.env.local` is ignored. Copy the example to `apps/web/.env.local`. Never commit that file or any real key.

Checks, matching `.github/workflows/ci.yml`:

```bash
pnpm lint
pnpm typecheck
python3 -m pip install pymupdf
pnpm test
pnpm test:ml
node --test "prototypes/moon-road/test/**/*.test.mjs"
pnpm --filter @studigo/web build
```

- `pnpm lint` checks that `openai` is imported only from `packages/ai`, and that every repo path named in `ENGINEERING.md` exists.
- `pnpm typecheck` is `pnpm -r typecheck`.
- `pnpm test` runs workspace package tests, `tests/database-security.test.mjs`, `evals/rag`, `evals/grading`, and the security-readiness script tests. The study-guide Word/PDF test shells out to `pymupdf`.
- `pnpm test:ml` is the advisory Python harness on synthetic data. The script calls `python3`, same as CI's `pymupdf` install.
- CI also runs `pnpm audit --prod --audit-level high` after the frozen install.
- `pnpm build` runs every package build, including the web build. CI's required web build is the filtered command above.
- `pnpm --filter @studigo/desktop build` prints a scaffold message and does not produce a desktop binary.

One package at a time:

```bash
pnpm --filter @studigo/web test
pnpm --filter @studigo/ai test
pnpm --filter @studigo/documents test
pnpm --filter @studigo/learning test
pnpm --filter @studigo/mastery test
```

Database changes are new files in `supabase/migrations/`, applied in filename order. `supabase db push` needs the Supabase CLI, which is not a workspace dependency. Do not edit a migration that has already been applied. Two files already share the version prefix `20261015010000` (`learn_mission_cursor` and `release_finished_ai_holds`); do not add another file with an existing prefix.

Game, from `prototypes/moon-road`: `node prepare.mjs`, then `python -m http.server 8000 --directory dist`, and open `/poc-xi/`. The retrieval experiment's run steps are in `services/retrieval/README.md`. Leave it off the production path.

## Guardrails

- Keep course-grounded answers inside the learner's uploaded material. Teacher study guides outrank textbooks and general model knowledge.
- Do not invent citations, teacher requirements, or test scope. Abstain when the material does not support the claim.
- `grounded` means a citation marker was used. Semantic support is `packages/ai/src/verify-claim.ts`.
- Import `openai` only inside `packages/ai`.
- Treat uploaded and retrieved text as untrusted data and possible prompt injection.
- Validate and structure model output that changes software behavior.
- Keep progression, scaffold policy, and learning evidence in `packages/learning` and `apps/web/lib/learning/`. A retry must not create a second learning event or a second ingest (`claim_document`).
- Enforce authorization with Postgres RLS. A session check in a route is not a substitute. Service-role code must still prove user, room, and object scope.
- Keep originals in private storage. Serve them through authenticated, signed download.
- Keep parse, OCR, and embedding work off the synchronous upload request.
- Schema changes go in a new migration. Do not hand-edit the hosted database.
- `NEXT_PUBLIC_` values are inlined into browser JavaScript. `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PRIVATE_KEY`, `CRON_SECRET`, and `STUDIGO_AI_IP_HASH_SECRET` stay server-only. The template is root `.env.example`.
- `/api/dev/coach` and `/api/dev/study-guide/download` return 404 unless `NODE_ENV` is `development`.
- `/api/local-beta/*` also requires `STUDIGO_LOCAL_BETA=1` and a localhost host. See `apps/web/lib/local-beta-access.ts`.
- `/dev/study` and `/dev/home` also render on a Vercel preview when `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1`. That data is synthetic.
- Do not widen those dev or local-beta surfaces.
- Add tests or evals for the behavior you change.
- Update `ENGINEERING.md` when the live map, authority boundary, or code ownership changes. Update `implementation/ENGINEERING_PLAN.md` when the backlog changes. Update `docs/README.md` when documentation authority changes.
- Do not add a second engineering overview, walkthrough, or security checklist.

The learner question to optimize for is: what do I need to know, do I understand it, and what should I practice next?

## Where the docs are

| Need | Open |
| --- | --- |
| Live map | `ENGINEERING.md` |
| Which document is current | `docs/README.md` |
| Product behavior | `docs/PRODUCT.md` |
| Runtime and data boundaries | `docs/ARCHITECTURE.md` |
| Backlog | `implementation/ENGINEERING_PLAN.md` |
| Public launch | `implementation/security-readiness/` |
| Release order | `docs/ROADMAP.md` |
| Deploy and env checklist | `docs/VERCEL_DEPLOYMENT.md` |
| Auth | `docs/AUTH.md` |
| Visual system | `docs/DESIGN_SYSTEM.md` |

`STUDIGO_CODEX_EXECUTION_PLAN.md` is the document-learning track queue for `integration/document-learning-reliability`. Open one assigned card. Do not load the whole file, and do not use it as the cold start on `main`.

When documents disagree, trust current code and tests, then `docs/PRODUCT.md`, then `docs/ARCHITECTURE.md`, then `ENGINEERING.md`, then `implementation/ENGINEERING_PLAN.md`. Files in `docs/archive/` are evidence and finished plans.

Change routing for models, retrieval, grading, Coach, progression, ingestion, auth, database, and UI is the table "Where to make common changes" in `ENGINEERING.md`.

Game art and level tooling: `prototypes/moon-road/TOOLCHAIN.md`.

## Context to skip

`.cursorignore` and `.claudeignore` list the same exclusions: dependencies, build output, images, audio, video, fonts, archives, `assets/`, design media, Moon Keep art and downloads, and frozen game builds other than `prototypes/moon-road/dist/poc-xi/`. Leave those trees closed unless the task is specifically that asset or that build.
