# Studigo Authentication Architecture

## Decision

Studigo uses **Supabase Auth** as the canonical identity layer across the web/PWA product and any future native shell.

The product should not add Clerk, Auth0, Firebase Auth, or a second identity system unless a future requirement clearly exceeds what Supabase Auth provides.

## Launch provider order

1. **Google** — primary social sign-in.
2. **Apple** — high priority for iPhone/iPad/macOS users.
3. **Microsoft (Azure / Entra ID)** — high priority for school, district, and Microsoft 365 users.
4. **Email fallback** — email/password, magic link, or OTP depending on the final onboarding choice.
5. **Facebook** — supported as a later provider, but lower priority for Studigo's initial student use case.

Google One Tap may be evaluated after standard Google OAuth is stable.

## UX direction

Authentication should feel like Studigo, but the provider controls themselves should remain immediately recognizable and trustworthy.

Use a branded Studigo authentication shell with:

- warm paper / field-guide background treatment
- Studigo companion used lightly, not as a distraction
- clear heading such as `Welcome to Studigo`
- short supporting copy focused on getting back to studying
- provider buttons in the order Google, Apple, Microsoft
- email fallback below a visible `or` divider
- minimal legal/privacy copy below the form

Provider buttons should follow the visual conventions expected by each provider. Do not over-style them into generic Studigo keys or obscure provider identity.

Recommended default surface:

```text
               Studigo ✦

        Welcome to Studigo
   Your study companion is ready.

   [ G  Continue with Google ]
   [   Continue with Apple  ]
   [ ▦  Continue with Microsoft ]

                — or —

          Email address
   [                         ]
   [ Continue with email     ]
```

The surrounding page can use Studigo's design system; the provider buttons should prioritize familiarity, accessibility, and trust.

## Web / PWA flow

Studigo uses Supabase social OAuth with PKCE/cookie-based SSR for Next.js.

```text
Student
  |
  v
Studigo /login
  |
  | signInWithOAuth(provider)
  v
Supabase Auth
  |
  +--> Google
  +--> Apple
  +--> Microsoft / Azure
  +--> Facebook (later)
  |
  v
Provider consent/authentication
  |
  v
Supabase Auth callback
  |
  v
Studigo /auth/callback
  |
  | exchange OAuth code
  | establish server-readable session cookie
  v
Onboarding or /app
```

The application callback route should validate the redirect destination and exchange the OAuth code for a Supabase session. The authenticated Supabase user ID is the identity used by RLS-protected Studigo data.

## Supabase provider configuration

Provider credentials belong in **Supabase Auth provider configuration**, not in browser source code.

External provider setup typically includes:

- provider application/client ID
- provider application secret or signing credential
- Supabase Auth callback URL
- approved production and preview redirect URLs

The standard Supabase provider callback is:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Studigo should separately allow its application callback URLs, for example:

```text
http://localhost:3000/auth/callback
https://<production-domain>/auth/callback
https://<approved-preview-domain>/auth/callback
```

Do not use wildcard redirect patterns more broadly than required.

## Provider-specific notes

### Google

Use `provider: "google"` with Supabase OAuth. Google is the default social action in the Studigo login UI.

Standard Google OAuth should ship before Google One Tap. Add One Tap only after the normal callback/session path is verified in production.

### Apple

Use `provider: "apple"` for the web OAuth flow.

Apple's web OAuth response does not reliably provide the user's full name. Studigo must not depend on Apple OAuth for profile naming; collect a display name during onboarding when needed.

Any Apple private signing key must remain outside source control and be handled as a secret.

### Microsoft

Supabase uses the `azure` provider for Microsoft authentication. Request the `email` scope because Supabase Auth requires a usable email address for this provider.

The default launch intent should allow normal Microsoft accounts unless a future school/district deployment explicitly restricts sign-in to one tenant.

### Facebook

Facebook is a supported Supabase social provider but is not a launch-critical provider for Studigo. Add it after Google, Apple, Microsoft, and email fallback are production-stable.

## Session model

- Use `@supabase/ssr` for server/client helpers in the Next.js App Router.
- Keep the authenticated session available to server routes through cookies.
- Refresh sessions using the supported Next.js/Supabase SSR pattern.
- Protect authenticated app routes such as `/app`, `/rooms`, and future dashboard surfaces.
- Redirect unauthenticated users to `/login`.
- Redirect authenticated users away from `/login` when appropriate.
- Never use editable `user_metadata` claims for authorization decisions.

## Authorization model

Authentication answers **who the user is**. Postgres RLS answers **which Studigo data that user may access**.

All user-owned records must continue to enforce ownership at the database layer.

Typical rule:

```text
auth.uid() == row.user_id
```

Do not weaken RLS because a request came through a server route.

## Profile data

Use Supabase Auth for identity and a Studigo-owned profile table for product profile fields such as:

- display name
- grade / education level when voluntarily supplied
- avatar preference
- onboarding state
- accessibility preferences
- study preferences

Do not treat social-provider profile metadata as authoritative application authorization data.

## First-login flow

Recommended flow:

```text
OAuth success
  -> callback
  -> valid Studigo session
  -> profile/onboarding check
      -> incomplete: /onboarding
      -> complete: /app
```

Onboarding should be short. The MVP should not require unnecessary demographic information before a student can create a Study Room.

## Native / executable future

The PWA/web app remains the canonical identity implementation.

If Tauri or a future mobile shell is enabled, it should authenticate against the same Supabase project and user identities. Do not create separate native-only Studigo accounts.

Apple may later use a native Sign in with Apple flow when a true native Apple client exists, but it must resolve to the same Supabase user/account model.

## Security guardrails

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/native client code.
- Provider secrets and Apple signing keys never enter source control.
- OAuth state/PKCE protections must remain enabled.
- Validate redirect destinations; do not create an open redirect through `next`/`redirect` query parameters.
- Use HTTPS in production.
- Keep RLS enabled on all user-owned data.
- Do not authorize from editable user metadata.
- Test account linking/duplicate-email behavior before public beta.
- Test sign-out and session expiration across browser tabs.
- Test preview/production redirect allowlists independently.

## Acceptance criteria for auth MVP

1. New user can sign in with Google.
2. New user can sign in with Apple.
3. New user can sign in with Microsoft.
4. Email fallback works.
5. OAuth callback returns the user to Studigo with a persistent session.
6. First-time user reaches onboarding; returning user reaches `/app`.
7. Unauthenticated access to private Study Room routes is blocked.
8. Two different users cannot read/write each other's Study Rooms or documents.
9. Sign-out clears the usable Studigo session.
10. Auth works locally and on the production Vercel domain.

## Current documentation references

Verify implementation details against current Supabase documentation before coding because auth APIs and provider setup can change:

- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/auth/social-login
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://supabase.com/docs/guides/auth/social-login/auth-azure
- https://supabase.com/docs/guides/auth/social-login/auth-facebook
