# Studigo Desktop Shell

This directory reserves the desktop executable layer using Tauri v2.

## Current status

Scaffold only. Production bundling is deliberately disabled in `tauri.conf.json`.

During development, run the web app on `http://localhost:3000`, then run the Tauri shell. The shell should remain a thin client; it must not embed OpenAI keys, Supabase service-role keys, or a second copy of Studigo's business logic.

## Before enabling builds

1. Decide the production API/base URL strategy.
2. Ensure auth works correctly inside the webview.
3. Decide whether the desktop shell loads a deployed frontend or a separately compiled client bundle.
4. Add icons, signing identities, updater configuration, CSP, and platform permissions.
5. Enable `bundle.active` only after those choices are implemented and tested.

The PWA remains the first installable delivery target.
