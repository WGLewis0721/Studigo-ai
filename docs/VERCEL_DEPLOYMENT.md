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
