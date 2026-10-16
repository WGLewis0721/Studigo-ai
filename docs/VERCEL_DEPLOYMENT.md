# Vercel Deployment — Studigo

Studigo is a pnpm workspace monorepo. The deployable Next.js application is `apps/web`.

## Vercel project settings

Use one Vercel project for the web application with these settings:

- **Repository:** `WGLewis0721/Studigo-ai`
- **Framework Preset:** Next.js
- **Root Directory:** `apps/web`
- **Install Command:** leave Vercel default (`pnpm install`)
- **Build Command:** leave the Next.js default unless Vercel fails to resolve the workspace; if an override is required, use `cd ../.. && pnpm --filter @studigo/web build`
- **Output Directory:** leave default (`.next`)
- **Node.js:** 22.x
- **Include source files outside of the Root Directory in the Build Step:** enabled

The outside-root option is required because `apps/web` depends on workspace packages under `packages/`.

Do not point Vercel at the repository root as a generic Next.js project. The root `package.json` is the workspace orchestrator, not the Next.js application.

## First deployment goal

The current homepage is intentionally renderable without Supabase or OpenAI credentials, so the frontend can be deployed and reviewed before backend configuration.

A successful frontend deployment should make `/` publicly viewable and should also expose:

- `/manifest.webmanifest`
- `/api/health`

The authenticated/RAG API routes remain present but require their corresponding environment variables before they can be used.

## Environment variables

### Frontend-only preview

No secrets are required to render the current homepage.

Optionally set:

```text
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>
```

### Full application functionality

Set these in Vercel Project Settings → Environment Variables for Production and Preview as appropriate:

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
STUDIGO_MAX_RETRIEVAL_CHUNKS=8
STUDIGO_MIN_SIMILARITY=0.35
```

Security rules:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `OPENAI_API_KEY` is server-only.
- Never prefix either secret with `NEXT_PUBLIC_`.
- Use the deployed Vercel URL for `NEXT_PUBLIC_APP_URL` until a custom domain exists.

## Guided Learn preview flag

Guided Learn is off unless both of these are the exact string `1`:

```text
STUDIGO_GUIDED_LEARN=1
NEXT_PUBLIC_STUDIGO_GUIDED_LEARN=1
```

`STUDIGO_GUIDED_LEARN` is server-only. `NEXT_PUBLIC_STUDIGO_GUIDED_LEARN` is inlined into the client at build time, so changing it requires a new preview build.

To turn the flag on for a Vercel preview of `guided-learn`:

1. Open the Vercel project `studigo-ai` (team `gray-matter5`) → Settings → Environment Variables.
2. Add both variables for the **Preview** environment only. Do not add them to Production.
3. Redeploy the `guided-learn` branch. A push to that branch builds a preview; it does not deploy Production.
4. Open the stable branch preview: `https://studigo-ai-git-guided-learn-gray-matter5.vercel.app`. Preview deployments use Vercel Deployment Protection, so the URL answers with the team sign-in page until a project member is signed in.

The signed-in room shell exposes the result as `data-guided-learn="on"` only when both values are `1`. With either value unset, the attribute is `off` and Learn keeps the current lesson, chat, and topic scope. This foundation does not mount a new mission player when the flag is on. Later GL cards are what branch on it. Leave `PHASE3_ROOM2_ROOM_IDS` unset; that allowlist belongs to the paused Room 2 reading cursor, not this flag.

The stable alias pattern for any branch is `https://studigo-ai-git-<branch>-gray-matter5.vercel.app`, with `/` in the branch name written as `-`. Each deployment also has its own `https://studigo-<id>-gray-matter5.vercel.app` URL. Production stays `https://studigo-ai.vercel.app` and follows `main` only.

## Verification checklist

After Vercel reports `Ready`:

1. Open the production/preview URL and confirm the Studigo homepage renders.
2. Open `/api/health` and confirm an HTTP 200 response.
3. Confirm the Studigo companion, Study Room preview, mastery trail, Ask Studigo panel, citations, source-priority section, and responsive styles render correctly.
4. Test at desktop and mobile widths.
5. Check the browser console for fatal errors.
6. Check Vercel Runtime Logs after calling any server route.

## Common deployment failure

If Vercel shows the repository README, fails framework detection, or cannot find a `.next` output, the project is most likely targeting the repository root instead of `apps/web`.

Fix the Vercel project's Root Directory to `apps/web`, leave Output Directory at the framework default, and redeploy.

If workspace imports such as `@studigo/ai` or `@studigo/documents` cannot be resolved, verify **Include source files outside of the Root Directory in the Build Step** is enabled.

## Local build parity

From the repository root:

```bash
pnpm install
pnpm typecheck
pnpm build:web
```

The same web package is what Vercel should build.
