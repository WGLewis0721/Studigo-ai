# Studigo App Store Release Plan

**Decision date:** October 1, 2026

This document is the canonical iOS/App Store delivery plan for the Studigo learning app. It applies to the learning app, not the separate Moon Keep/Core Clash game.

## Chosen architecture

Studigo will ship a real iOS client using **Expo / React Native** while keeping the existing hosted Studigo backend, Supabase identity/data model, learning engine, and grounded AI architecture.

```text
Expo / React Native iOS app
        |
        +--> Supabase Auth (same Studigo user)
        |
        +--> hosted Studigo API
                 |
                 +--> Supabase Postgres + RLS
                 +--> Supabase private Storage
                 +--> existing learning/adaptive engine
                 +--> existing grounded AI layer
```

The iOS app is a client of the existing product, not a second implementation of Studigo.

### Non-negotiables

- Do not ship a thin WebView wrapper of the web app as the primary iOS product.
- Do not create a second user/account system.
- Do not duplicate mastery, Coach progression, learner state, RAG, or entitlement logic in the mobile client.
- Never embed OpenAI keys, Supabase service-role keys, Apple signing secrets, or other privileged credentials in the app.
- Preserve Supabase RLS and private document storage.
- Preserve the existing web/PWA product while the native client is built.

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
- [ ] Implement the Study Room navigation model for iPhone first.
- [ ] Connect the app to the hosted Studigo API.

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
- [ ] Physical-device pass for supported iPhone sizes and any iPad sizes included at launch.
- [ ] Validate auth callbacks, file picker, upload, PDF open/share, keyboard, safe areas, interruptions, offline/poor network, and background/resume.

### 5. TestFlight and release

- [ ] Internal TestFlight build.
- [ ] External beta with real learners.
- [ ] Crash/performance and release-blocker triage.
- [ ] Final App Store metadata, screenshots, privacy/support URLs, review credentials/instructions, and IAP metadata.
- [ ] Submit release candidate.
- [ ] Resolve App Review findings.
- [ ] Release only after the production backend and APEX entitlement path are already proven.

## 1.0 exit condition

Studigo is App Store ready when a new customer can install the iOS app, create/sign into the same Studigo account used on the web, pay through Apple, receive the correct APEX entitlement exactly once, complete the core study loop, restore access on another device, cancel/refund without stale access, delete their account/data, and get support.
