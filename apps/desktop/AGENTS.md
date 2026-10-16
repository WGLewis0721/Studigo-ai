# @studigo/desktop

Parked Tauri scaffold. Bundling is disabled. There is no shipped desktop app, and this tree is not the iOS plan (`docs/APP_STORE_RELEASE_PLAN.md`).

`pnpm --filter @studigo/desktop build` prints a scaffold message. It does not run `tauri build`.

The live client is `apps/web`. Do not add a second backend or put provider keys in a desktop bundle.
