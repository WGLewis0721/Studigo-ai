<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Studigo web app

Live Next.js 16 / React 19 app. Vercel project root is this directory. Also follow the repo root `AGENTS.md` and `ENGINEERING.md`.

| Area | Path |
| --- | --- |
| Routes and pages | `app/` |
| API route handlers | `app/api/` |
| Server and domain logic | `lib/` |
| UI | `components/` |

```bash
pnpm --filter @studigo/web dev
pnpm --filter @studigo/web test
pnpm --filter @studigo/web typecheck
pnpm --filter @studigo/web build
```

- Copy env from the repo root `.env.example` to `apps/web/.env.local`. Next.js does not read a root `.env.local`.
- Call `@studigo/ai` for model work. Do not import `openai` here.
- Keep `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and other server secrets out of client components and `NEXT_PUBLIC_` variables.
- `/api/dev/coach` and `/api/dev/study-guide/download` return 404 unless `NODE_ENV=development`.
- `/api/local-beta/*` also requires `STUDIGO_LOCAL_BETA=1` and a localhost host (`lib/local-beta-access.ts`).
- `/dev/study` and `/dev/home` can also render on a Vercel preview when `NEXT_PUBLIC_STUDIGO_PHASE3_FOUNDATION_UI=1`. The rooms and evidence there are synthetic.
- Do not widen those surfaces. Do not put learning policy in components; `packages/learning` and `lib/learning/` own it.
