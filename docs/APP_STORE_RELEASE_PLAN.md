# Studigo App Store Release Plan

**Decision date:** October 1, 2026

This document is the canonical iOS/iPadOS App Store delivery plan for the Studigo learning app. It applies to the learning app, not the separate Moon Keep/Core Clash game.

## Chosen architecture

Studigo will ship one universal iPhone/iPad client using **Expo / React Native**
while keeping the hosted Studigo backend, Supabase identity/data model,
deterministic adaptive game director, and grounded AI architecture.

```text
Expo / React Native iOS + iPadOS app
        |
        +--> Supabase Auth (same Studigo user)
        |
        +--> authenticated hosted Studigo API
                 |
                 +--> Supabase Postgres + RLS
                 +--> Supabase private Storage
                 +--> deterministic adaptive game director
                 +--> grounded RAG / GenAI service
                           |
                           +--> OpenAI API (server-side key only)
                           +--> optional Python/LangChain/ML service
                                when evals justify it
```

The Apple app is a client of the existing product, not a second implementation
of Studigo. The OpenAI service key never belongs in the app binary.

### Non-negotiables

- Do not ship a thin WebView wrapper of the web app as the primary iOS product.
- Do not create a second user/account system.
- Do not duplicate mastery, Coach progression, learner state, RAG, or entitlement logic in the mobile client.
- Never embed OpenAI keys, Supabase service-role keys, Apple signing secrets, or other privileged credentials in the app.
- Preserve Supabase RLS and private document storage.
- Preserve the existing web/PWA product while the native client is built.
- Keep `study_rooms.explain_level` as the global room-wide explanation setting.
- Keep progression/mastery deterministic; GenAI renders and interprets but does not own the learning policy.
- Benchmark Python/LangChain against the current TypeScript RAG path before adding operational complexity.

## Authentication

Use the same **Supabase Auth user** on web and iOS.

Required native work:

- native-safe Supabase session persistence;
- deep-link / callback handling;
- Sign in with Apple when required by the final App Store authentication configuration;
- Google and other supported providers only where the native flow is reliable;
- email fallback;
- account deletion and data deletion from inside the product;
- logout/session-expiry testing on a physical device.

## Payments and entitlements

Studigo has two payment rails but one access model.

```text
Web purchase                 iOS purchase
    |                            |
  Stripe                  StoreKit / Apple
    |                            |
    |                       RevenueCat
    |                            |
    +------------+---------------+
                 |
                APEX
                 |
        canonical entitlement
                 |
              Studigo
```

Rules:

- **Stripe** remains the web payment rail.
- **StoreKit** is the iOS payment rail for digital Studigo subscriptions/features.
- **RevenueCat** handles mobile purchase/receipt/subscription state to reduce StoreKit plumbing.
- **APEX remains the source of truth for Studigo entitlements and usage.**
- A web purchase and an App Store purchase must resolve to the same Studigo account without double-granting.
- Add Restore Purchases.
- Reconcile purchase, renewal, cancellation, billing retry, refund, and revocation events server-side.
- Payment events must be idempotent and auditable.

## Current web readiness snapshot — October 2, 2026

The adaptive web beta is now deployed on `main`. Atomic Coach and adaptive-session
paths are enabled in production and exact-main CI/production smoke passed.
Two-user/source isolation and retry/idempotency behavior have automated and hosted
synthetic coverage. Physical iPhone testing has also already found and driven one
real recovery improvement: **Refresh study guide** for stale derived topic scope.

This does **not** close the App Store gate. Still outstanding are the durable
large-document worker, atomic durable-session/Coach lifecycle linkage, independently
reviewed live RAG and provider performance/cost evidence, full mobile PDF
open/share/print acceptance, privacy/minor-data/vendor work, commerce/APEX setup,
and the Expo/TestFlight client itself.

## Release sequence

### 0. Web/backend readiness before charging

- [ ] Finish the physical iPhone/Safari production validation already listed in the roadmap.
- [ ] Add two-user RLS isolation tests.
- [ ] Move large-document ingestion to a durable retryable worker.
- [ ] Finish production RAG/citation, prompt-injection, parser/file, rate-limit, and observability work required by the commercialization gate.
- [ ] Publish privacy policy, terms, support contact, retention policy, and account/data deletion behavior.
- [ ] Freeze the initial paid plan(s), limits, and entitlement names in APEX.

### 1. Create the native client

- [ ] Add an Expo/React Native application to the monorepo.
- [ ] Establish shared types/contracts without importing server-only implementation into the mobile bundle.
- [ ] Configure bundle ID, app display name, version/build numbering, icons, splash/launch assets, safe areas, and release profiles.
- [ ] Implement Supabase authentication using the existing Studigo identity model.
- [ ] Implement the Study Room navigation model phone-first, with deliberate iPadOS layouts rather than a stretched phone UI.
- [ ] Connect the app to the hosted Studigo API.
- [ ] Prove the native client never receives the OpenAI API key or other privileged service credentials.
- [ ] Reuse the server-owned adaptive state and V3 Coach mode/explanation-level contracts rather than reimplementing them in React Native.

### 2. Reach native feature parity for the core paid loop

The first App Store client does not need every future feature, but it must support the paid core loop:

- [ ] create/open/delete Study Rooms;
- [ ] upload and manage study materials;
- [ ] Coach and Learn;
- [ ] Quiz, Flashcards, and Practice Test;
- [ ] Progress / mastery / weak areas;
- [ ] Plan / Cram;
- [ ] Materials and cited source opening;
- [ ] downloadable study guide PDF with native open/share behavior;
- [ ] background/resume and poor-network recovery.

### 3. Add iOS commerce

- [ ] Configure App Store products/subscriptions.
- [ ] Integrate RevenueCat with StoreKit.
- [ ] Send normalized mobile entitlement events into APEX.
- [ ] Implement Restore Purchases.
- [ ] Implement App Store Server Notifications / reconciliation.
- [ ] Prove purchase, renewal, cancellation, billing retry, refund, revocation, restore, and cross-device access.

### 4. App Store compliance and QA

- [ ] Privacy manifest / required-reason API review as applicable.
- [ ] App privacy answers match the shipped binary.
- [ ] Age rating and education/minor-data review.
- [ ] Account deletion available in-app.
- [ ] Accessibility pass: VoiceOver, Dynamic Type/text scaling, contrast, touch targets, Reduce Motion, keyboard behavior.
- [ ] Physical-device pass for supported iPhone and iPad sizes included at launch.
- [ ] Validate auth callbacks, file picker, upload, PDF open/share, keyboard, safe areas, interruptions, offline/poor network, and background/resume.

### 5. TestFlight and release

- [ ] Internal TestFlight build.
- [ ] External beta with real learners.
- [ ] Crash/performance and release-blocker triage.
- [ ] Final App Store metadata, screenshots, privacy/support URLs, review credentials/instructions, and IAP metadata.
- [ ] Submit release candidate.
- [ ] Resolve App Review findings.
- [ ] Release only after the production backend and APEX entitlement path are already proven.

## Adaptive/GenAI release gate

Before App Store submission, the native client must demonstrate the same learning
contract as the web product:

- identical room/source authorization;
- identical global explanation level;
- identical Coach-mode semantics;
- Challenge Director remains server-owned and deterministic;
- citations open the learner's permitted source;
- unsupported material abstains honestly;
- native retry/resume cannot double-record learning evidence;
- model/provider failure cannot silently advance mastery.

The staged build/audit plan is in the root `IMPLEMENTATION.md`.

## 1.0 exit condition

Studigo is App Store ready when a new customer can install the iOS app, create/sign into the same Studigo account used on the web, pay through Apple, receive the correct APEX entitlement exactly once, complete the core study loop, restore access on another device, cancel/refund without stale access, delete their account/data, and get support.
